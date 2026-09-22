-- ORVUNO Hetzner auth cutover prerequisites.
-- Run once on the Hetzner PostgreSQL database before enabling local password login.

create extension if not exists pgcrypto;

create index if not exists idx_orvuno_users_login_email_lower
  on public.users (lower(email));

create index if not exists idx_orvuno_users_login_username_lower
  on public.users (lower(username));

-- Existing Supabase bcrypt hashes are copied into public.users.password_hash by
-- server/hetzner/migrate-auth-from-supabase.mjs. No plaintext passwords are moved.
