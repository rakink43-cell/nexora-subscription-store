-- ===========================================================================
-- NEXORA · 0008 — Secure initial admin setup
--
-- HOW TO BECOME ADMIN (one time, no public admin registration exists):
--   1) Create your account normally at /register (or Supabase → Authentication).
--   2) Set a private bootstrap secret once, below (Settings → replace the value).
--   3) Run:  select public.bootstrap_admin('you@example.com', 'YOUR-SECRET');
--   4) Delete the setting afterwards so nobody can reuse it:
--      delete from public.admin_bootstrap where id = true;
--
-- The function is SECURITY DEFINER, revocable, and only promotes an EXISTING
-- auth user. It cannot be called once the bootstrap row is removed, so the
-- window of exposure is controlled entirely by you.
-- ===========================================================================

create table if not exists public.admin_bootstrap (
  id          boolean primary key default true check (id),
  secret_hash text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.admin_bootstrap enable row level security;
-- No policies at all → invisible/unreadable to anon & authenticated.
revoke all on public.admin_bootstrap from anon, authenticated;

-- Insert the secret hash (replace CHANGE_ME_BEFORE_RUNNING with your own
-- long random string, keep a copy, then run this statement BEFORE step 3):
--   insert into public.admin_bootstrap (id, secret_hash)
--   values (true, encode(extensions.digest('CHANGE_ME_BEFORE_RUNNING', 'sha256'), 'hex'));

create or replace function public.bootstrap_admin(_email text, _secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   public.admin_bootstrap;
  v_user  uuid;
begin
  select * into v_row from public.admin_bootstrap where id = true;
  if not found then
    raise exception 'Admin bootstrap is disabled on this project.' using errcode = '42501';
  end if;
  if v_row.used_at is not null then
    raise exception 'Admin bootstrap has already been used.' using errcode = '42501';
  end if;
  if encode(extensions.digest(_secret, 'sha256'), 'hex') <> v_row.secret_hash then
    raise exception 'Invalid bootstrap secret.' using errcode = '42501';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(_email));
  if v_user is null then
    raise exception 'No account found for that email. Register first.' using errcode = 'P0001';
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user, 'admin')
  on conflict (user_id, role) do nothing;

  update public.admin_bootstrap set used_at = now() where id = true;

  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (v_user, 'bootstrap_admin', 'user_roles', v_user::text,
          jsonb_build_object('email', _email));

  return jsonb_build_object('ok', true, 'user_id', v_user, 'role', 'admin');
end;
$$;

revoke all on function public.bootstrap_admin(text, text) from public;
grant execute on function public.bootstrap_admin(text, text) to anon, authenticated;

-- Helper for an existing admin to promote/demote others (server-side checked).
create or replace function public.admin_set_role(_email text, _role public.app_role)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only an administrator can change roles.' using errcode = '42501';
  end if;
  if _role = 'admin' and (select count(*) from public.user_roles where role = 'admin') >= 5 then
    raise exception 'Admin seats are limited. Remove an admin first.' using errcode = 'P0001';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(_email));
  if v_user is null then
    raise exception 'No account found for that email.' using errcode = 'P0001';
  end if;

  if _role = 'customer' then
    delete from public.user_roles where user_id = v_user;
  else
    insert into public.user_roles (user_id, role)
    values (v_user, _role)
    on conflict (user_id, role) do update set role = excluded.role;
  end if;

  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_role', 'user_roles', v_user::text,
          jsonb_build_object('email', _email, 'role', _role));

  return jsonb_build_object('ok', true, 'email', _email, 'role', _role);
end;
$$;

revoke all on function public.admin_set_role(text, public.app_role) from public;
grant execute on function public.admin_set_role(text, public.app_role) to authenticated;
