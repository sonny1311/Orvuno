import pg from "pg";

const { Pool } = pg;

const sourceUrl = String(process.env.SUPABASE_DATABASE_URL || "").trim();
const targetUrl = String(process.env.DATABASE_URL || "").trim();

if (!sourceUrl) throw new Error("SUPABASE_DATABASE_URL fehlt");
if (!targetUrl) throw new Error("DATABASE_URL fehlt");

const source = new Pool({
  connectionString: sourceUrl,
  ssl: { rejectUnauthorized: false }
});

const target = new Pool({
  connectionString: targetUrl
});

let targetClient;
try {
  const sourceResult = await source.query(`
    select
      id as auth_user_id,
      encrypted_password,
      email_confirmed_at,
      last_sign_in_at
    from auth.users
    where encrypted_password is not null
      and encrypted_password <> ''
  `);

  const rows = sourceResult.rows;
  if (!rows.length) throw new Error("Keine Supabase-Passworthashes gefunden");
  if (rows.some(row => !String(row.encrypted_password || "").startsWith("$2"))) {
    throw new Error("Mindestens ein Hash ist kein bcrypt-Hash; Migration abgebrochen");
  }

  targetClient = await target.connect();
  await targetClient.query("begin");

  let updated = 0;
  let missing = 0;

  for (const row of rows) {
    const result = await targetClient.query(
      `update public.users
          set password_hash=$1,
              email_verified_at=coalesce(email_verified_at,$2),
              last_login_at=coalesce(greatest(last_login_at,$3),last_login_at,$3)
        where auth_user_id=$4
        returning id`,
      [
        row.encrypted_password,
        row.email_confirmed_at || null,
        row.last_sign_in_at || null,
        row.auth_user_id
      ]
    );

    if (result.rowCount === 1) updated += 1;
    else missing += 1;
  }

  if (updated === 0) throw new Error("Kein Hetzner-Spieler konnte zugeordnet werden");

  const verify = await targetClient.query(`
    select
      count(*)::int as total_users,
      count(*) filter (where password_hash like '$2%')::int as bcrypt_users,
      count(*) filter (where password_hash='SUPABASE_AUTH')::int as unmigrated_users
    from public.users
    where deleted_at is null
  `);

  await targetClient.query("commit");

  console.log(JSON.stringify({
    sourceUsers: rows.length,
    updated,
    missing,
    verification: verify.rows[0]
  }, null, 2));
} catch (error) {
  if (targetClient) {
    try { await targetClient.query("rollback"); } catch {}
  }
  throw error;
} finally {
  targetClient?.release();
  await source.end();
  await target.end();
}
