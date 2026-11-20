-- NEXORA 0012: Single administrator username login and one-time password setup.
-- This keeps the existing Supabase Auth user and admin role. No second admin account is created.

create table if not exists public.admin_login_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username) and length(username) between 4 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_password_setup_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_login_credentials enable row level security;
alter table public.admin_password_setup_tokens enable row level security;
revoke all on public.admin_login_credentials from anon, authenticated;
revoke all on public.admin_password_setup_tokens from anon, authenticated;
grant all on public.admin_login_credentials to service_role;
grant all on public.admin_password_setup_tokens to service_role;

do $$
declare
  v_admin_count integer;
  v_admin_id uuid;
begin
  select count(distinct user_id), min(user_id::text)::uuid
    into v_admin_count, v_admin_id
  from public.user_roles
  where role = 'admin';

  if v_admin_count <> 1 then
    raise exception 'Expected exactly one existing NEXORA admin; found %', v_admin_count;
  end if;

  insert into public.admin_login_credentials(user_id, username)
  values (v_admin_id, 'nexora_admin')
  on conflict (user_id) do update set username = excluded.username;
end $$;

-- One-time bootstrap token. Only its SHA-256 hash is stored in the database.
insert into public.admin_password_setup_tokens(token_hash, user_id, expires_at)
select '408c41f4dda3d3a163865f7dec1952cc8a63f462d22a3f6d7b721b4acb7953e8',
       c.user_id,
       now() + interval '24 hours'
from public.admin_login_credentials c
where c.username = 'nexora_admin'
on conflict (token_hash) do nothing;
