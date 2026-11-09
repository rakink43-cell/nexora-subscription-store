-- ===========================================================================
-- NEXORA · 0004 — Privileges + Row Level Security
-- Principle: RLS on every table, deny-by-default. Writes to money/order tables
-- happen only through SECURITY DEFINER RPCs or admin policies.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can call them safely
-- without recursive policy lookups on user_roles)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_super_admin() to anon, authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Base privileges (Supabase grants these by default; explicit for portability)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to authenticated, service_role;

-- Explicit write grants for the few tables the public may insert into.
-- RLS policies still gate every row; these just allow the attempt to reach RLS.
grant insert on public.analytics_events to anon, authenticated;
grant insert on public.support_messages to anon, authenticated;
grant usage on sequence public.analytics_events_id_seq to anon, authenticated;

-- enable + force RLS on every table
alter table public.profiles             enable row level security;
alter table public.profiles             force  row level security;
alter table public.user_roles           enable row level security;
alter table public.user_roles           force  row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.coupons              enable row level security;
alter table public.orders               enable row level security;
alter table public.orders               force  row level security;
alter table public.order_items          enable row level security;
alter table public.payments             enable row level security;
alter table public.payments             force  row level security;
alter table public.order_status_history enable row level security;
alter table public.website_settings     enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.promotions           enable row level security;
alter table public.faqs                 enable row level security;
alter table public.reviews              enable row level security;
alter table public.support_messages     enable row level security;
alter table public.notifications        enable row level security;
alter table public.analytics_events     enable row level security;
alter table public.admin_audit_log      enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read own"      on public.profiles;
drop policy if exists "profiles: admin read all" on public.profiles;
drop policy if exists "profiles: update own"    on public.profiles;
drop policy if exists "profiles: admin update"  on public.profiles;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admin read all" on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Column-level hardening: customers can never change their own role flags
revoke update on public.profiles from authenticated;
grant update (full_name, phone, address, city, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- user_roles — read own role; only admins may grant/revoke
-- ---------------------------------------------------------------------------
drop policy if exists "roles: read own"     on public.user_roles;
drop policy if exists "roles: admin manage" on public.user_roles;

create policy "roles: read own" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "roles: admin manage" on public.user_roles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- categories — public read of active rows
-- ---------------------------------------------------------------------------
drop policy if exists "categories: public read" on public.categories;
drop policy if exists "categories: admin write"  on public.categories;

create policy "categories: public read" on public.categories
  for select to anon, authenticated
  using (is_active or public.is_admin());

create policy "categories: admin write" on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- products — public read of active rows, admin full control
-- ---------------------------------------------------------------------------
drop policy if exists "products: public read" on public.products;
drop policy if exists "products: admin write"  on public.products;

create policy "products: public read" on public.products
  for select to anon, authenticated
  using (is_active or public.is_admin());

create policy "products: admin write" on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- coupons — never publicly readable; validation goes through an RPC
-- ---------------------------------------------------------------------------
drop policy if exists "coupons: admin only" on public.coupons;
create policy "coupons: admin only" on public.coupons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- orders — customers see only their own; admins see everything
-- No client INSERT: orders are created by the place_order() RPC.
-- ---------------------------------------------------------------------------
drop policy if exists "orders: read own"     on public.orders;
drop policy if exists "orders: admin read"   on public.orders;
drop policy if exists "orders: admin update" on public.orders;

create policy "orders: read own" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "orders: admin read" on public.orders
  for select to authenticated
  using (public.is_admin());

create policy "orders: admin update" on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
drop policy if exists "order_items: read own"   on public.order_items;
drop policy if exists "order_items: admin read" on public.order_items;

create policy "order_items: read own" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid())
  ));

create policy "order_items: admin read" on public.order_items
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
drop policy if exists "payments: read own"     on public.payments;
drop policy if exists "payments: admin read"   on public.payments;
drop policy if exists "payments: admin update" on public.payments;

create policy "payments: read own" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = payments.order_id and o.user_id = (select auth.uid())
  ));

create policy "payments: admin read" on public.payments
  for select to authenticated
  using (public.is_admin());

create policy "payments: admin update" on public.payments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- order_status_history — internal notes stay internal
-- ---------------------------------------------------------------------------
drop policy if exists "history: read own"   on public.order_status_history;
drop policy if exists "history: admin read" on public.order_status_history;

create policy "history: read own" on public.order_status_history
  for select to authenticated
  using (
    not is_internal
    and exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id and o.user_id = (select auth.uid())
    )
  );

create policy "history: admin read" on public.order_status_history
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- website_settings — public rows only (payment instructions are public-ish,
-- internal keys are flagged is_public = false)
-- ---------------------------------------------------------------------------
drop policy if exists "settings: public read" on public.website_settings;
drop policy if exists "settings: admin write" on public.website_settings;

create policy "settings: public read" on public.website_settings
  for select to anon, authenticated
  using (is_public or public.is_admin());

create policy "settings: admin write" on public.website_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- payment_methods
-- ---------------------------------------------------------------------------
drop policy if exists "payment_methods: public read" on public.payment_methods;
drop policy if exists "payment_methods: admin write" on public.payment_methods;

create policy "payment_methods: public read" on public.payment_methods
  for select to anon, authenticated
  using (is_active or public.is_admin());

create policy "payment_methods: admin write" on public.payment_methods
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- promotions / faqs
-- ---------------------------------------------------------------------------
drop policy if exists "promotions: public read" on public.promotions;
drop policy if exists "promotions: admin write" on public.promotions;
create policy "promotions: public read" on public.promotions
  for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "promotions: admin write" on public.promotions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "faqs: public read" on public.faqs;
drop policy if exists "faqs: admin write" on public.faqs;
create policy "faqs: public read" on public.faqs
  for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "faqs: admin write" on public.faqs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- reviews — approved reviews are public; users may submit their own
-- ---------------------------------------------------------------------------
drop policy if exists "reviews: public read"  on public.reviews;
drop policy if exists "reviews: insert own"   on public.reviews;
drop policy if exists "reviews: admin manage" on public.reviews;

create policy "reviews: public read" on public.reviews
  for select to anon, authenticated
  using (is_approved or public.is_admin());

create policy "reviews: insert own" on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()) and is_approved = false);

create policy "reviews: admin manage" on public.reviews
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- support_messages — anyone may contact support; read own or admin
-- ---------------------------------------------------------------------------
drop policy if exists "support: insert anyone" on public.support_messages;
drop policy if exists "support: read own"      on public.support_messages;
drop policy if exists "support: admin manage"  on public.support_messages;

create policy "support: insert anyone" on public.support_messages
  for insert to anon, authenticated
  with check (
    length(name) between 2 and 120
    and length(subject) between 2 and 200
    and length(message) between 5 and 5000
  );

create policy "support: read own" on public.support_messages
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "support: admin manage" on public.support_messages
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications / audit log — admin eyes only
-- ---------------------------------------------------------------------------
drop policy if exists "notifications: admin" on public.notifications;
create policy "notifications: admin" on public.notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "audit: admin read" on public.admin_audit_log;
create policy "audit: admin read" on public.admin_audit_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- analytics_events — write-only for the public, read by admins
-- ---------------------------------------------------------------------------
drop policy if exists "analytics: insert anyone" on public.analytics_events;
drop policy if exists "analytics: admin read"    on public.analytics_events;

create policy "analytics: insert anyone" on public.analytics_events
  for insert to anon, authenticated
  with check (true);

create policy "analytics: admin read" on public.analytics_events
  for select to authenticated
  using (public.is_admin());
