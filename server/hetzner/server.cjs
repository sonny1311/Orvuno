const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "6mb" }));

const PORT = Number(process.env.PORT || 8791);
const SUPABASE_URL = "https://ojhaeccyulyrwoxgeurf.supabase.co";
const SUPABASE_KEY = "sb_publishable_JZH6Ker5-yZoNY6sQFhVTA_YKnImI3z";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LOCAL_SESSION_PREFIX = "orv1_";
const LOCAL_SESSION_HOURS = 24 * 7;
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const ORVUNO_PUBLIC_URL = String(process.env.ORVUNO_PUBLIC_URL || "https://www.orvuno.de").replace(/\/$/, "");
const ORVUNO_MAIL_FROM = String(process.env.ORVUNO_MAIL_FROM || "ORVUNO <noreply@nadena.de>").trim();
const AUTH_RATE_LIMITS = new Map();

function sha(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim();
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function enforceAuthRateLimit(req, action, max, windowMs) {
  const now = Date.now();
  const key = `${action}:${String(req.ip || req.socket?.remoteAddress || "")}`;
  let hit = AUTH_RATE_LIMITS.get(key);
  if (!hit || now >= hit.resetAt) hit = { count: 0, resetAt: now + windowMs };
  hit.count += 1;
  AUTH_RATE_LIMITS.set(key, hit);
  if (hit.count > max) throw httpError(429, "Zu viele Versuche. Bitte spaeter erneut versuchen.");
}

function validateRegistration(data = {}) {
  const username = normalizeUsername(data.username);
  const email = normalizeEmail(data.email);
  const password = String(data.password || "");
  const errors = [];
  if (username.length < 3 || username.length > 40) errors.push("Benutzername muss 3 bis 40 Zeichen haben");
  if (!/^[A-Za-z0-9_.-]+$/.test(username)) errors.push("Benutzername enthaelt ungueltige Zeichen");
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("E-Mail-Adresse ist ungueltig");
  if (password.length < 10) errors.push("Passwort muss mindestens 10 Zeichen haben");
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.push("Passwort muss Buchstaben und Zahlen enthalten");
  if (!data.termsAccepted) errors.push("AGB muessen akzeptiert werden");
  if (!data.privacyAccepted) errors.push("Datenschutz muss akzeptiert werden");
  return { username, email, password, errors };
}

async function sendOrvunoMail({ to, subject, html, text }) {
  if (!RESEND_API_KEY) throw httpError(503, "Mailversand ist noch nicht konfiguriert");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: ORVUNO_MAIL_FROM,
      to: [to],
      subject,
      html,
      text
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Resend mail failed", response.status, body.slice(0, 500));
    throw httpError(502, "E-Mail konnte nicht versendet werden");
  }
}

function verificationMail(languageCode, url) {
  const de = String(languageCode || "de").toLowerCase().startsWith("de");
  if (de) return {
    subject: "ORVUNO - E-Mail-Adresse bestaetigen",
    text: `Bestaetige deine E-Mail-Adresse fuer ORVUNO: ${url}\n\nDer Link ist 24 Stunden gueltig.`,
    html: `<p>Willkommen bei <strong>ORVUNO</strong>.</p><p><a href="${url}">E-Mail-Adresse bestaetigen</a></p><p>Der Link ist 24 Stunden gueltig.</p>`
  };
  return {
    subject: "ORVUNO - Confirm your email address",
    text: `Confirm your email address for ORVUNO: ${url}\n\nThe link is valid for 24 hours.`,
    html: `<p>Welcome to <strong>ORVUNO</strong>.</p><p><a href="${url}">Confirm email address</a></p><p>The link is valid for 24 hours.</p>`
  };
}

function resetMail(languageCode, url) {
  const de = String(languageCode || "de").toLowerCase().startsWith("de");
  if (de) return {
    subject: "ORVUNO - Passwort zuruecksetzen",
    text: `Setze dein ORVUNO-Passwort hier neu: ${url}\n\nDer Link ist 1 Stunde gueltig. Falls du das nicht angefordert hast, ignoriere diese E-Mail.`,
    html: `<p>Du kannst dein <strong>ORVUNO</strong>-Passwort hier neu setzen:</p><p><a href="${url}">Neues Passwort festlegen</a></p><p>Der Link ist 1 Stunde gueltig. Falls du das nicht angefordert hast, ignoriere diese E-Mail.</p>`
  };
  return {
    subject: "ORVUNO - Reset your password",
    text: `Reset your ORVUNO password here: ${url}\n\nThe link is valid for 1 hour. If you did not request this, ignore this email.`,
    html: `<p>You can reset your <strong>ORVUNO</strong> password here:</p><p><a href="${url}">Set a new password</a></p><p>The link is valid for 1 hour. If you did not request this, ignore this email.</p>`
  };
}

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError(401, "Nicht angemeldet");
  return match[1];
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password || ""), salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt);
  return ["scrypt", salt.toString("base64url"), derived.toString("base64url")].join(String.fromCharCode(36));
}

async function verifyPasswordHash(password, hash) {
  const stored = String(hash || "");

  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    const actual = await scrypt(password, salt);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  if (stored.startsWith("$2")) {
    const result = await pool.query(
      "select crypt($1,$2)=$2 as ok",
      [String(password || ""), stored]
    );
    return result.rows[0]?.ok === true;
  }

  return false;
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
      database: "orvuno",
      mode: "hetzner-gameplay-ready"
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/orvuno/auth/register", async (req, res) => {
  const client = await pool.connect();
  let committed = false;
  try {
    enforceAuthRateLimit(req, "register", 5, 60 * 60 * 1000);
    const check = validateRegistration(req.body || {});
    if (check.errors.length) throw httpError(400, check.errors.join("; "));

    const existing = await client.query(
      `select id from public.users
        where deleted_at is null
          and (lower(email)=lower($1) or lower(username)=lower($2))
        limit 1`,
      [check.email, check.username]
    );
    if (existing.rows[0]) throw httpError(409, "Benutzername oder E-Mail bereits vergeben");

    const passwordHash = await createPasswordHash(check.password);
    const authUserId = crypto.randomUUID();
    const publicId = crypto.randomUUID();
    const countryCode = String(req.body?.countryCode || "DE").trim().slice(0, 2).toUpperCase() || "DE";
    const languageCode = String(req.body?.languageCode || "de").trim().slice(0, 10) || "de";
    const token = randomToken();

    await client.query("begin");
    const inserted = await client.query(
      `insert into public.users
        (public_id,auth_user_id,username,email,password_hash,status,country_code,language_code,
         email_verified_at,terms_accepted_at,privacy_accepted_at,terms_version,privacy_version)
       values($1,$2,$3,$4,$5,'verification_pending',$6,$7,null,now(),now(),'1.0','1.0')
       returning *`,
      [publicId, authUserId, check.username, check.email, passwordHash, countryCode, languageCode]
    );
    await client.query(
      "insert into public.coin_wallets(user_id,balance) values($1,0) on conflict (user_id) do nothing",
      [inserted.rows[0].id]
    );
    await client.query(
      "insert into public.email_verification_tokens(user_id,token_hash,expires_at) values($1,$2,now()+interval '24 hours')",
      [inserted.rows[0].id, sha(token)]
    );
    await client.query("commit");
    committed = true;

    const verifyUrl = `${ORVUNO_PUBLIC_URL}/api/orvuno/auth/verify-email?token=${encodeURIComponent(token)}`;
    const mail = verificationMail(languageCode, verifyUrl);
    await sendOrvunoMail({ to: check.email, ...mail });

    res.status(201).json({
      success: true,
      source: "hetzner",
      confirmationRequired: true,
      user: normalizeUser(inserted.rows[0], {
        id: authUserId,
        email: check.email,
        email_confirmed_at: null
      })
    });
  } catch (error) {
    if (!committed) {
      try { await client.query("rollback"); } catch {}
    }
    if (error?.code === "23505") return sendError(res, httpError(409, "Benutzername oder E-Mail bereits vergeben"));
    sendError(res, error);
  } finally {
    client.release();
  }
});

app.get("/api/orvuno/auth/verify-email", async (req, res) => {
  const client = await pool.connect();
  try {
    const token = String(req.query?.token || "");
    if (!token) throw httpError(400, "Bestaetigungslink ist ungueltig");

    const found = await client.query(
      `select t.id,t.user_id
         from public.email_verification_tokens t
        where t.token_hash=$1
          and t.used_at is null
          and t.expires_at>now()
        limit 1`,
      [sha(token)]
    );
    if (!found.rows[0]) {
      return res.redirect(303, `${ORVUNO_PUBLIC_URL}/?email_verification=invalid`);
    }

    await client.query("begin");
    await client.query("update public.email_verification_tokens set used_at=now() where id=$1", [found.rows[0].id]);
    await client.query(
      `update public.users
          set email_verified_at=coalesce(email_verified_at,now()),
              status=case when status='verification_pending' then 'active' else status end
        where id=$1`,
      [found.rows[0].user_id]
    );
    await client.query("commit");
    res.redirect(303, `${ORVUNO_PUBLIC_URL}/?email_verified=1`);
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    console.error(error);
    res.redirect(303, `${ORVUNO_PUBLIC_URL}/?email_verification=invalid`);
  } finally {
    client.release();
  }
});

app.post("/api/orvuno/auth/resend-verification", async (req, res) => {
  const client = await pool.connect();
  try {
    enforceAuthRateLimit(req, "resend-verification", 6, 60 * 60 * 1000);
    const email = normalizeEmail(req.body?.email);
    if (!email) throw httpError(400, "E-Mail-Adresse fehlt");
    const found = await client.query(
      "select id,email,language_code,email_verified_at from public.users where lower(email)=lower($1) and deleted_at is null limit 1",
      [email]
    );
    const user = found.rows[0];
    if (user && !user.email_verified_at) {
      const token = randomToken();
      await client.query("delete from public.email_verification_tokens where user_id=$1 and used_at is null", [user.id]);
      await client.query(
        "insert into public.email_verification_tokens(user_id,token_hash,expires_at) values($1,$2,now()+interval '24 hours')",
        [user.id, sha(token)]
      );
      const verifyUrl = `${ORVUNO_PUBLIC_URL}/api/orvuno/auth/verify-email?token=${encodeURIComponent(token)}`;
      await sendOrvunoMail({ to: user.email, ...verificationMail(user.language_code, verifyUrl) });
    }
    res.json({ success: true, source: "hetzner" });
  } catch (error) {
    sendError(res, error);
  } finally {
    client.release();
  }
});

app.post("/api/orvuno/auth/password-reset/request", async (req, res) => {
  const client = await pool.connect();
  try {
    enforceAuthRateLimit(req, "password-reset", 6, 60 * 60 * 1000);
    const email = normalizeEmail(req.body?.email);
    if (!email) throw httpError(400, "E-Mail-Adresse fehlt");

    const found = await client.query(
      "select id,email,language_code from public.users where lower(email)=lower($1) and deleted_at is null limit 1",
      [email]
    );
    const user = found.rows[0];
    if (user) {
      const token = randomToken();
      await client.query("delete from public.password_reset_tokens where user_id=$1 and used_at is null", [user.id]);
      await client.query(
        "insert into public.password_reset_tokens(user_id,token_hash,expires_at) values($1,$2,now()+interval '1 hour')",
        [user.id, sha(token)]
      );
      const resetUrl = `${ORVUNO_PUBLIC_URL}/?orvuno_reset=${encodeURIComponent(token)}`;
      await sendOrvunoMail({ to: user.email, ...resetMail(user.language_code, resetUrl) });
    }

    res.json({ success: true, source: "hetzner" });
  } catch (error) {
    sendError(res, error);
  } finally {
    client.release();
  }
});

app.post("/api/orvuno/auth/password-reset/confirm", async (req, res) => {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    enforceAuthRateLimit(req, "password-reset-confirm", 12, 60 * 60 * 1000);
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    if (!token) throw httpError(400, "Reset-Link ist ungueltig");
    if (password.length < 10) throw httpError(400, "Passwort muss mindestens 10 Zeichen haben");
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw httpError(400, "Passwort muss Buchstaben und Zahlen enthalten");
    }

    const found = await client.query(
      `select t.id,t.user_id
         from public.password_reset_tokens t
        where t.token_hash=$1
          and t.used_at is null
          and t.expires_at>now()
        limit 1`,
      [sha(token)]
    );
    if (!found.rows[0]) throw httpError(400, "Reset-Link ist ungueltig oder abgelaufen");

    const passwordHash = await createPasswordHash(password);
    await client.query("begin");
    inTransaction = true;
    await client.query(
      "update public.users set password_hash=$2,failed_login_count=0,locked_until=null where id=$1",
      [found.rows[0].user_id, passwordHash]
    );
    await client.query("update public.password_reset_tokens set used_at=now() where id=$1", [found.rows[0].id]);
    await client.query(
      "update public.auth_sessions set revoked_at=now() where user_id=$1 and revoked_at is null",
      [found.rows[0].user_id]
    );
    await client.query("commit");
    inTransaction = false;

    const refreshed = await client.query("select * from public.users where id=$1 limit 1", [found.rows[0].user_id]);
    const user = refreshed.rows[0];
    if (!user || user.status !== "active" || !user.email_verified_at) {
      return res.json({ success: true, source: "hetzner", session: null });
    }

    const session = await createLocalSession(client, user.id, req);
    res.json({
      success: true,
      source: "hetzner",
      user: normalizeUser(user, {
        id: user.auth_user_id,
        email: user.email,
        email_confirmed_at: user.email_verified_at
      }),
      session: {
        access_token: session.token,
        token_type: "bearer",
        expires_at: Math.floor(new Date(session.expiresAt).getTime() / 1000),
        expiresAt: session.expiresAt,
        provider: "hetzner"
      }
    });
  } catch (error) {
    if (inTransaction) {
      try { await client.query("rollback"); } catch {}
    }
    sendError(res, error);
  } finally {
    client.release();
  }
});

app.post("/api/orvuno/auth/login", async (req, res) => {
  const client = await pool.connect();
  try {
    const emailOrUsername = String(req.body?.email || req.body?.emailOrUsername || "").trim();
    const password = String(req.body?.password || "");

    if (!emailOrUsername || !password) {
      throw httpError(400, "E-Mail/Benutzername und Passwort erforderlich");
    }

    const found = await client.query(
      `select *
         from public.users
        where deleted_at is null
          and (lower(email)=lower($1) or lower(username)=lower($1))
        limit 1`,
      [emailOrUsername]
    );

    const user = found.rows[0];
    if (!user) throw httpError(401, "E-Mail/Benutzername oder Passwort falsch");

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw httpError(423, "Account voruebergehend gesperrt");
    }

    const hash = String(user.password_hash || "");
    if (hash === "SUPABASE_AUTH" || !hash) {
      throw httpError(503, "Account ist noch nicht auf Hetzner-Login migriert");
    }

    const ok = await verifyPasswordHash(password, hash);
    if (!ok) {
      const failed = Number(user.failed_login_count || 0) + 1;
      await client.query(
        `update public.users
            set failed_login_count=$2,
                locked_until=case when $2>=5 then now()+interval '15 minutes' else locked_until end
          where id=$1`,
        [user.id, failed]
      );
      throw httpError(401, "E-Mail/Benutzername oder Passwort falsch");
    }

    if (!user.email_verified_at) throw httpError(403, "Bitte zuerst die E-Mail-Adresse bestaetigen");
    if (user.status !== "active") throw httpError(403, `Accountstatus: ${user.status}`);

    await client.query(
      `update public.users
          set failed_login_count=0,
              locked_until=null,
              last_login_at=now(),
              last_seen_at=now()
        where id=$1`,
      [user.id]
    );

    const session = await createLocalSession(client, user.id, req);

    res.json({
      success: true,
      source: "hetzner",
      user: normalizeUser(user, {
        id: user.auth_user_id,
        email: user.email,
        email_confirmed_at: user.email_verified_at
      }),
      session: {
        access_token: session.token,
        token_type: "bearer",
        expires_at: Math.floor(new Date(session.expiresAt).getTime() / 1000),
        expiresAt: session.expiresAt,
        provider: "hetzner"
      }
    });
  } catch (error) {
    sendError(res, error);
  } finally {
    client.release();
  }
});

app.post("/api/orvuno/auth/adopt-password", async (req, res) => {
  const client = await pool.connect();
  try {
    const supabaseToken = bearerToken(req);
    if (supabaseToken.startsWith(LOCAL_SESSION_PREFIX)) {
      throw httpError(400, "Supabase-Sitzung fuer Passwortuebernahme erwartet");
    }

    const password = String(req.body?.password || "");
    if (!password) throw httpError(400, "Passwort fehlt");

    const auth = await getAuthUser(req);
    if (!auth?.email) throw httpError(400, "Supabase-Account hat keine E-Mail-Adresse");

    const verifyResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: auth.email, password })
    });

    if (!verifyResponse.ok) {
      throw httpError(401, "Passwort konnte nicht bestaetigt werden");
    }

    await syncEntitlementsFromSupabase(client, auth.id, supabaseToken);
    const gameUser = await requireActiveGameUser(client, auth.id);
    const passwordHash = await createPasswordHash(password);

    await client.query(
      `update public.users
          set password_hash=$2,
              failed_login_count=0,
              locked_until=null,
              last_login_at=now(),
              last_seen_at=now(),
              email_verified_at=coalesce(email_verified_at,$3)
        where id=$1`,
      [gameUser.id, passwordHash, auth.email_confirmed_at || null]
    );

    const session = await createLocalSession(client, gameUser.id, req);
    const refreshed = await client.query(
      "select * from public.users where id=$1 limit 1",
      [gameUser.id]
    );

    res.json({
      success: true,
      source: "hetzner-adopted",
      user: normalizeUser(refreshed.rows[0], auth),
      session: {
        access_token: session.token,
        token_type: "bearer",
        expires_at: Math.floor(new Date(session.expiresAt).getTime() / 1000),
        expiresAt: session.expiresAt,
        provider: "hetzner"
      }
    });
  } catch (error) {
    sendError(res, error);
  } finally {
    client.release();
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
