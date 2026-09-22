const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "6mb" }));

const PORT = Number(process.env.PORT || 8791);
const SUPABASE_URL = "https://ojhaeccyulyrwoxgeurf.supabase.co";
const SUPABASE_KEY = "sb_publishable_JZH6Ker5-yZoNY6sQFhVTA_YKnImI3z";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LOCAL_SESSION_PREFIX = "orv1_";
const LOCAL_SESSION_HOURS = 2;

function sha(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError(401, "Nicht angemeldet");
  return match[1];
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function getAuthUser(req) {
  const token = bearerToken(req);
  if (token.startsWith(LOCAL_SESSION_PREFIX)) {
    throw httpError(401, "Supabase-Sitzung fuer Uebergabe erwartet");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) throw httpError(401, "Sitzung ungueltig");
  return response.json();
}

async function requireActiveGameUser(client, authId) {
  const result = await client.query(
    `select id,status
       from public.users
      where auth_user_id=$1
        and deleted_at is null
      limit 1`,
    [authId]
  );

  const user = result.rows[0];
  if (!user) throw httpError(403, "Kein verknuepfter Spielaccount");
  if (user.status !== "active") {
    throw httpError(403, "Account ist nicht zum Spielen freigegeben");
  }
  return user;
}

async function createLocalSession(client, userId, req) {
  const token = `${LOCAL_SESSION_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + LOCAL_SESSION_HOURS * 60 * 60 * 1000);

  await client.query(
    `delete from public.auth_sessions
      where user_id=$1
        and (expires_at <= now() or revoked_at is not null)`,
    [userId]
  );

  await client.query(
    `insert into public.auth_sessions
      (id,user_id,token_hash,ip_hash,user_agent_hash,expires_at)
      values($1,$2,$3,$4,$5,$6)`,
    [
      crypto.randomUUID(),
      userId,
      sha(token),
      sha(req.ip || req.socket?.remoteAddress || ""),
      sha(req.headers["user-agent"] || ""),
      expiresAt
    ]
  );

  return { token, expiresAt: expiresAt.toISOString() };
}

async function resolveLocalSession(client, token) {
  const result = await client.query(
    `select u.*,s.id as local_session_id
       from public.auth_sessions s
       join public.users u on u.id=s.user_id
      where s.token_hash=$1
        and s.revoked_at is null
        and s.expires_at>now()
        and u.deleted_at is null
      limit 1`,
    [sha(token)]
  );

  const user = result.rows[0];
  if (!user) throw httpError(401, "Lokale Spielsitzung ist abgelaufen");
  if (user.status !== "active") throw httpError(403, "Account ist nicht zum Spielen freigegeben");

  await client.query(
    "update public.auth_sessions set last_seen_at=now() where id=$1",
    [user.local_session_id]
  );

  return {
    auth: {
      id: user.auth_user_id,
      email: user.email,
      email_confirmed_at: user.email_verified_at
    },
    gameUser: user
  };
}

async function resolveRequestUser(req, client) {
  const token = bearerToken(req);

  if (token.startsWith(LOCAL_SESSION_PREFIX)) {
    return resolveLocalSession(client, token);
  }

  const auth = await getAuthUser(req);
  await syncEntitlementsFromSupabase(client, auth.id, token);
  const gameUser = await requireActiveGameUser(client, auth.id);
  return { auth, gameUser };
}

async function withUser(req, fn) {
  const client = await pool.connect();
  try {
    const { auth, gameUser } = await resolveRequestUser(req, client);
    return await fn({ client, auth, gameUser });
  } finally {
    client.release();
  }
}

function sendError(res, error) {
  console.error(error);
  const status =
    Number(error?.status) >= 400 && Number(error?.status) <= 599
      ? Number(error.status)
      : 500;

  res.status(status).json({
    success: false,
    error: status === 500 ? (error?.message || "Serverfehler") : error.message
  });
}

function normalizeUser(user, auth) {
  return {
    ...user,
    authId: auth.id,
    emailConfirmedAt: auth.email_confirmed_at || null,
    premiumUntil: user.premium_until ? new Date(user.premium_until).getTime() : 0,
    premiumPlan: user.premium_plan || null,
    premiumAutoRenew: !!user.premium_auto_renew,
    tutorialSeenAt: user.tutorial_seen_at ? new Date(user.tutorial_seen_at).getTime() : 0,
    tutorialCompletedAt: user.tutorial_completed_at ? new Date(user.tutorial_completed_at).getTime() : 0
  };
}

app.get("/api/orvuno/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({
      ok: true,
      service: "orvuno-api",
      database: "worldprojekt",
      mode: "hetzner-gameplay-ready"
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/session/exchange", async (req, res) => {
  const client = await pool.connect();
  try {
    const supabaseToken = bearerToken(req);
    if (supabaseToken.startsWith(LOCAL_SESSION_PREFIX)) {
      throw httpError(400, "Supabase-Sitzung fuer Uebergabe erwartet");
    }

    const auth = await getAuthUser(req);
    await syncEntitlementsFromSupabase(client, auth.id, supabaseToken);
    const gameUser = await requireActiveGameUser(client, auth.id);
    const session = await createLocalSession(client, gameUser.id, req);

    res.json({
      success: true,
      source: "hetzner",
      token: session.token,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    sendError(res, error);
  } finally {
    client.release();
  }
});

app.post("/api/orvuno/session/logout", async (req, res) => {
  const client = await pool.connect();
  try {
    const token = bearerToken(req);
    if (token.startsWith(LOCAL_SESSION_PREFIX)) {
      await client.query(
        "update public.auth_sessions set revoked_at=now() where token_hash=$1 and revoked_at is null",
        [sha(token)]
      );
    }
    res.json({ success: true, source: "hetzner" });
  } catch (error) {
    sendError(res, error);
  } finally {
    client.release();
  }
});

async function fetchSupabaseProfileAndWallet(authId, token) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
  };

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?auth_user_id=eq.${encodeURIComponent(authId)}&select=*`,
    { headers, cache: "no-store" }
  );
  if (!profileRes.ok) throw httpError(502, "Supabase-Profil konnte nicht geladen werden");
  const profiles = await profileRes.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) throw httpError(403, "Spielerprofil wurde noch nicht angelegt");

  const walletRes = await fetch(
    `${SUPABASE_URL}/rest/v1/coin_wallets?user_id=eq.${encodeURIComponent(profile.id)}&select=balance&limit=1`,
    { headers, cache: "no-store" }
  );
  if (!walletRes.ok) throw httpError(502, "Supabase-Coin-Wallet konnte nicht geladen werden");
  const wallets = await walletRes.json();
  const coinBalance = Number((Array.isArray(wallets) ? wallets[0]?.balance : 0) || 0);

  return { profile, coinBalance };
}

async function syncEntitlementsFromSupabase(client, authId, token) {
  const { profile, coinBalance } = await fetchSupabaseProfileAndWallet(authId, token);

  let localUser = await client.query(
    "select id from public.users where auth_user_id=$1 limit 1",
    [authId]
  );

  if (!localUser.rows[0]) {
    const boot = await client.query(
      "select orvuno_api.bootstrap_user_from_supabase($1::jsonb,$2) as id",
      [JSON.stringify(profile), coinBalance]
    );
    localUser = { rows: [{ id: boot.rows[0].id }] };
  }

  const userId = Number(localUser.rows[0].id);
  await client.query(
    "select orvuno_api.apply_supabase_entitlements($1,$2,$3,$4,$5,$6,$7) as result",
    [
      userId,
      coinBalance,
      profile.premium_plan || null,
      profile.premium_until || null,
      !!profile.premium_auto_renew,
      profile.status || null,
      profile.deleted_at || null
    ]
  );

  return userId;
}

app.get("/api/orvuno/account", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, auth, gameUser }) => {
      const userResult = await client.query(
        "select * from public.users where id=$1 limit 1",
        [gameUser.id]
      );

      const companiesResult = await client.query(
        `select *
           from public.companies
          where user_id=$1
            and closed_at is null
          order by slot_no asc,created_at asc`,
        [gameUser.id]
      );

      const walletResult = await client.query(
        "select balance from public.coin_wallets where user_id=$1 limit 1",
        [gameUser.id]
      );

      return {
        success: true,
        source: "hetzner",
        user: normalizeUser(userResult.rows[0], auth),
        companies: companiesResult.rows,
        wallet: { balance: Number(walletResult.rows[0]?.balance || 0) }
      };
    });

    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/api/orvuno/profile", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, auth, gameUser }) => {
      const d = req.body || {};
      const allowed = {
        country_code: d.countryCode,
        language_code: d.languageCode,
        display_name: d.displayName,
        profile_image_url: d.profileImageUrl
      };

      const fields = [];
      const values = [];
      let i = 1;

      for (const [col, value] of Object.entries(allowed)) {
        if (value !== undefined) {
          fields.push(`${col}=$${i++}`);
          values.push(value);
        }
      }

      if (!fields.length) {
        const r = await client.query("select * from public.users where id=$1", [gameUser.id]);
        return { success: true, user: normalizeUser(r.rows[0], auth), source: "hetzner" };
      }

      values.push(gameUser.id);
      const r = await client.query(
        `update public.users
            set ${fields.join(",")}
          where id=$${i}
          returning *`,
        values
      );

      return { success: true, user: normalizeUser(r.rows[0], auth), source: "hetzner" };
    });

    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/tutorial", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select orvuno_api.set_tutorial_state($1,$2) as result",
        [gameUser.id, !!req.body?.completed]
      );
      return { ...r.rows[0].result, source: "hetzner" };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/save-game-state", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select (orvuno_api.save_player_game_state($1,$2::jsonb)).*",
        [gameUser.id, JSON.stringify(req.body?.state || {})]
      );
      return { success: true, source: "hetzner", company: r.rows[0] };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/save-business-state", async (req, res) => {
  try {
    const companyId = Number(req.body?.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw httpError(400, "Ungueltige Betriebs-ID");
    }

    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select (orvuno_api.save_player_business_state($1,$2,$3::jsonb)).*",
        [gameUser.id, companyId, JSON.stringify(req.body?.state || {})]
      );
      return { success: true, source: "hetzner", company: r.rows[0] };
    });

    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/business/ensure", async (req, res) => {
  try {
    const d = req.body || {};
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select (orvuno_api.ensure_player_company($1,$2,$3,$4)).*",
        [gameUser.id, d.name || null, d.industry || null, d.companyType || d.type || null]
      );
      return { success: true, source: "hetzner", company: r.rows[0] };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/business/create", async (req, res) => {
  try {
    const d = req.body || {};
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select (orvuno_api.create_player_business($1,$2,$3,$4,$5::smallint)).*",
        [
          gameUser.id,
          d.name || null,
          d.industry || null,
          d.companyType || d.type || null,
          Number(d.slotNo)
        ]
      );
      return { success: true, source: "hetzner", company: r.rows[0] };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/business/create-paid", async (req, res) => {
  try {
    const d = req.body || {};
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select (orvuno_api.create_player_business_paid($1,$2,$3,$4,$5::smallint,$6,$7,$8,$9)).*",
        [
          gameUser.id,
          d.name || null,
          d.industry || null,
          d.companyType || d.type || null,
          Number(d.slotNo),
          Number(d.sourceCompanyId),
          d.locationClass || "smallTown",
          d.propertyMode === "buy" ? "buy" : "rent",
          Math.max(1, Number(d.propertySizeLevel || 1))
        ]
      );
      return { success: true, source: "hetzner", company: r.rows[0] };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/business/setup", async (req, res) => {
  try {
    const d = req.body || {};
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select (orvuno_api.update_player_business_setup($1,$2,$3,$4::jsonb)).*",
        [
          gameUser.id,
          Number(d.companyId),
          d.setupPhase,
          JSON.stringify(d.buildingState || {})
        ]
      );
      return { success: true, source: "hetzner", company: r.rows[0] };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/business/process-finances", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select orvuno_api.process_player_business_finances($1) as result",
        [gameUser.id]
      );
      return { ...r.rows[0].result, success: true, source: "hetzner" };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/business/transfer", async (req, res) => {
  try {
    await withUser(req, async () => true);
    res.status(409).json({
      success: false,
      error: "Alle eigenen Betriebe verwenden dasselbe Firmenkonto; ein Geldtransfer zwischen eigenen Betrieben ist nicht erforderlich"
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/orvuno/business/transfers", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select * from public.business_internal_transfers where user_id=$1 order by created_at desc limit 100",
        [gameUser.id]
      );
      return { success: true, source: "hetzner", rows: r.rows };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/orvuno/business/loans", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select * from public.business_expansion_loans where user_id=$1 order by created_at desc",
        [gameUser.id]
      );
      return { success: true, source: "hetzner", rows: r.rows };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/business/loan", async (req, res) => {
  try {
    const d = req.body || {};
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select orvuno_api.take_expansion_loan($1,$2,$3,$4) as result",
        [
          gameUser.id,
          Number(d.companyId),
          Number(d.amount),
          Number(d.termMonths)
        ]
      );
      return { success: true, source: "hetzner", loan: r.rows[0].result };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/orvuno/coins/orders", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client }) => {
      const r = await client.query(
        "select * from public.coin_market_orders where status='open' order by price_per_coin asc,created_at asc"
      );
      return { success: true, source: "hetzner", rows: r.rows };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/coins/order/create", async (req, res) => {
  try {
    await withUser(req, async () => true);
    res.status(409).json({
      success: false,
      error: "Coin-Spielermarkt ist bis zur serverautoritativen Wirtschaft deaktiviert"
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/coins/order/buy", async (req, res) => {
  try {
    await withUser(req, async () => true);
    res.status(409).json({
      success: false,
      error: "Coin-Spielermarkt ist bis zur serverautoritativen Wirtschaft deaktiviert"
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/coins/order/cancel", async (req, res) => {
  try {
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select orvuno_api.cancel_coin_sell_order($1,$2) as balance",
        [gameUser.id, Number(req.body?.orderId)]
      );
      return { success: true, source: "hetzner", balance: Number(r.rows[0].balance || 0) };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});


app.post("/api/orvuno/coins/exchange", async (req, res) => {
  try {
    const d = req.body || {};
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select orvuno_api.exchange_coins_for_company_money_v2($1,$2,$3) as result",
        [gameUser.id, String(d.tier || ""), String(d.requestId || "")]
      );
      return { ...r.rows[0].result, source: "hetzner" };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/coins/time-reduction", async (req, res) => {
  try {
    const d = req.body || {};
    const out = await withUser(req, async ({ client, gameUser }) => {
      const r = await client.query(
        "select orvuno_api.shorten_company_timed_action($1,$2,$3,$4,$5,$6) as result",
        [
          gameUser.id,
          Number(d.companyId),
          String(d.actionKind || ""),
          String(d.actionId || ""),
          Math.max(1, Number(d.hours || 1)),
          d.maxCoins == null ? null : Number(d.maxCoins)
        ]
      );
      return { ...r.rows[0].result, source: "hetzner" };
    });
    res.json(out);
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Orvuno API listening on 127.0.0.1:${PORT}`);
});
