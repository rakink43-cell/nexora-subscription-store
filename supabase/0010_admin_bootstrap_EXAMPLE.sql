-- ===========================================================================
-- NEXORA — SECURE INITIAL ADMIN SETUP (one time)
-- ===========================================================================
-- WHY THIS IS SAFE
--   • There is NO public admin registration. `is_admin()` reads only the
--     `user_roles` table, which customers can never insert into (RLS denies it).
--   • This script promotes an EXISTING auth user. It cannot create accounts.
--   • The secret is stored as a SHA-256 hash, never in plain text.
--   • bootstrap_admin() is single-use: it stamps `used_at` on success, and
--     refuses to run once stamped.
--   • After use you delete the row, which disables the function permanently.
--
-- WHAT YOU MUST DO
--   1. Register a normal account in the storefront (or Supabase → Auth → Add user).
--      Whatever e-mail you use here becomes the administrator.
--   2. Replace the two placeholders below: YOUR-ADMIN-EMAIL and YOUR-LONG-SECRET.
--      Use a long random secret (32+ chars) that is NOT reused anywhere.
--   3. Run this whole file in the Supabase SQL Editor.
--   4. Verify the output says {"ok": true, "role": "admin"}.
--   5. Delete the bootstrap row (last statement in this file — run it).
--
-- NEVER send the secret through chat, e-mail or a support ticket.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 · enable the one-time bootstrap with YOUR secret (hashed)
-- ---------------------------------------------------------------------------
delete from public.admin_bootstrap;  -- clear any previous attempt

insert into public.admin_bootstrap (id, secret_hash)
values (
  true,
  encode(extensions.digest('YOUR-LONG-SECRET', 'sha256'), 'hex')
);

-- ---------------------------------------------------------------------------
-- STEP 2 · promote your existing account to admin
-- ---------------------------------------------------------------------------
select public.bootstrap_admin('YOUR-ADMIN-EMAIL', 'YOUR-LONG-SECRET') as result;

-- Expect: {"ok": true, "user_id": "…", "role": "admin"}
-- If you get "No account found for that email", register first, then re-run
-- from STEP 1 (the failed attempt does not consume the bootstrap).

-- ---------------------------------------------------------------------------
-- STEP 3 · verify the promotion actually happened
-- ---------------------------------------------------------------------------
select
  u.email                    as admin_email,
  r.role                     as role,
  r.created_at               as granted_at
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role in ('admin', 'staff');

-- ---------------------------------------------------------------------------
-- STEP 4 · CLOSE THE DOOR — run this after a successful promotion
-- (removes the secret; bootstrap_admin() will then always refuse)
-- ---------------------------------------------------------------------------
delete from public.admin_bootstrap;

-- Sanity check: this must now raise
--   "Admin bootstrap is disabled on this project."
-- select public.bootstrap_admin('someone@else.com', 'anything');
