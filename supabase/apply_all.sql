-- ===========================================================================
-- NEXORA — COMPLETE DATABASE SETUP (single-file bundle)
-- Generated from supabase/migrations/0001…0009
--
-- HOW TO RUN (recommended):
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Paste this ENTIRE file, press Run
--   3. It is idempotent — safe to run again.
--   4. Then run supabase/migrations/0010_admin_bootstrap_EXAMPLE.sql
--      (edit the e-mail + secret first, see docs/SETUP.md)
--
-- This file is a convenience bundle of:
--   0001_extensions_and_enums.sql
--   0002_core_tables.sql
--   0003_content_tables.sql
--   0004_grants_and_rls.sql
--   0005_triggers.sql
--   0006_rpc_functions.sql
--   0007_seed_data.sql
--   0008_admin_setup.sql
--   0009_storage.sql
-- ===========================================================================


-- ===========================================================================
-- >>> 0001_extensions_and_enums.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · 0001 — Extensions, enums, shared helpers
-- Run order: 0001 → 0008 (Supabase SQL editor, or `supabase db push`)
-- ===========================================================================

create extension if not exists "pgcrypto" schema extensions;
create extension if not exists "pg_trgm" schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'staff', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending_payment',
    'payment_submitted',
    'payment_verified',
    'processing',
    'completed',
    'cancelled',
    'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('bkash', 'nagad', 'bank_transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'submitted', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.coupon_type as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_status as enum ('open', 'replied', 'closed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Order number generator: NX-YYMMDD-XXXXX (random, collision-checked)
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 10001;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  candidate text;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    candidate := 'NX-' || to_char(now(), 'YYMMDD') || '-' ||
                 lpad((nextval('public.order_number_seq') % 100000)::text, 5, '0');
    exit when not exists (select 1 from public.orders where order_number = candidate);
    if attempt > 20 then
      raise exception 'Could not generate a unique order number';
    end if;
  end loop;
  return candidate;
end;
$$;

-- ===========================================================================
-- >>> 0002_core_tables.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · 0002 — Core commerce tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  address     text,
  city        text,
  avatar_url  text,
  is_blocked  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Customer profile data. Never exposes auth secrets.';

create index if not exists idx_profiles_email_lower on public.profiles (lower(email));

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles — separate table (privilege escalation safe)
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null default 'customer',
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists idx_user_roles_user on public.user_roles (user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  icon        text default 'Sparkles',
  image_url   text,
  accent      text default 'blue',
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid references public.categories (id) on delete set null,
  name               text not null,
  slug               text not null unique,
  brand              text,
  short_description  text,
  description        text,
  image_url          text,
  gallery            jsonb not null default '[]'::jsonb,
  duration           text not null default '1 Month',
  original_price     numeric(12, 2) not null default 0 check (original_price >= 0),
  discounted_price   numeric(12, 2) not null default 0 check (discounted_price >= 0),
  delivery_info      text default 'Instant delivery after payment verification.',
  delivery_time      text default 'Within 1–30 minutes',
  availability       text not null default 'in_stock',   -- in_stock | limited | out_of_stock
  is_featured        boolean not null default false,
  is_active          boolean not null default true,
  badge              text,
  rating             numeric(2, 1) default 4.8 check (rating >= 0 and rating <= 5),
  rating_count       int not null default 0,
  sales_count        int not null default 0,
  sort_order         int not null default 0,
  admin_note         text,                                -- never exposed publicly
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.products.admin_note is 'Internal only. Excluded from public_products view.';

create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_active on public.products (is_active) where is_active;
create index if not exists idx_products_featured on public.products (is_featured) where is_featured;
create index if not exists idx_products_price on public.products (discounted_price);
create index if not exists idx_products_sales on public.products (sales_count desc);
create index if not exists idx_products_name_trgm on public.products
  using gin (name extensions.gin_trgm_ops);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Public-safe projection (no admin_note). security_invoker keeps RLS of caller.
create or replace view public.public_products
with (security_invoker = true) as
select
  id, category_id, name, slug, brand, short_description, description,
  image_url, gallery, duration, original_price, discounted_price,
  delivery_info, delivery_time, availability, is_featured, is_active,
  badge, rating, rating_count, sales_count, sort_order, created_at, updated_at
from public.products;

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  description   text,
  type          public.coupon_type not null default 'percentage',
  value         numeric(12, 2) not null check (value > 0),
  min_order     numeric(12, 2) not null default 0,
  max_discount  numeric(12, 2),
  usage_limit   int,
  used_count    int not null default 0,
  starts_at     timestamptz not null default now(),
  expires_at    timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists idx_coupons_code_lower on public.coupons (lower(code));

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique default public.generate_order_number(),
  -- Guest checkout: a random secret that lets the buyer (no account needed)
  -- track & submit payment for this order. Rotated/kept out of public queries.
  access_token    uuid not null default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete set null,
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text not null,
  customer_note   text,
  subtotal        numeric(12, 2) not null default 0,
  discount        numeric(12, 2) not null default 0,
  total           numeric(12, 2) not null default 0,
  coupon_code     text,
  payment_method  public.payment_method not null default 'bkash',
  status          public.order_status not null default 'pending_payment',
  admin_note      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders (user_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status, created_at desc);
create index if not exists idx_orders_number on public.orders (order_number);
create index if not exists idx_orders_email on public.orders (customer_email);
create index if not exists idx_orders_email_lower on public.orders (lower(customer_email));

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items (price snapshots — history never mutates with product edits)
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,
  product_image text,
  duration      text,
  unit_price    numeric(12, 2) not null default 0,
  quantity      int not null default 1 check (quantity > 0),
  line_total    numeric(12, 2) not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_product on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- payments (manual verification: bKash / Nagad / Bank transfer)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  method         public.payment_method not null,
  amount         numeric(12, 2) not null default 0,
  sender_number  text,
  transaction_id text,
  proof_url      text,
  status         public.payment_status not null default 'pending',
  admin_note     text,
  verified_by    uuid references auth.users (id) on delete set null,
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_payments_status on public.payments (status);
create index if not exists idx_payments_txn on public.payments (transaction_id);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_status_history (audit trail shown on the tracking page)
-- ---------------------------------------------------------------------------
create table if not exists public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  note       text,
  is_internal boolean not null default false,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_history_order on public.order_status_history (order_id, created_at);

-- ===========================================================================
-- >>> 0003_content_tables.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · 0003 — Content, settings & support tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- website_settings — single-row style key/value store managed by admin
-- ---------------------------------------------------------------------------
create table if not exists public.website_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  label       text,
  group_name  text default 'general',
  is_public   boolean not null default true,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_website_settings_updated_at on public.website_settings;
create trigger trg_website_settings_updated_at
  before update on public.website_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_methods — admin-managed manual payment destinations
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  method        public.payment_method not null,
  display_name  text not null,
  account_name  text,
  account_number text not null,
  account_type  text,                 -- Personal / Merchant / Current
  bank_name     text,
  branch        text,
  routing_number text,
  instructions  text,
  logo_url      text,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_payment_methods_updated_at on public.payment_methods;
create trigger trg_payment_methods_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- promotions (exclusive offers strip / homepage banners)
-- ---------------------------------------------------------------------------
create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  description text,
  image_url   text,
  badge       text,
  cta_label   text default 'Shop Now',
  cta_link    text default '/products',
  discount_text text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_promotions_updated_at on public.promotions;
create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- faqs
-- ---------------------------------------------------------------------------
create table if not exists public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  category   text default 'General',
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_faqs_updated_at on public.faqs;
create trigger trg_faqs_updated_at
  before update on public.faqs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reviews (customer testimonials; moderated by admin)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete set null,
  product_id   uuid references public.products (id) on delete cascade,
  customer_name text not null,
  customer_city text,
  rating       int not null default 5 check (rating between 1 and 5),
  comment      text not null,
  avatar_url   text,
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_reviews_product on public.reviews (product_id, is_approved);
create index if not exists idx_reviews_approved on public.reviews (is_approved, created_at desc);

-- ---------------------------------------------------------------------------
-- support_messages — contact form + customer support threads
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null,
  email       text not null,
  phone       text,
  subject     text not null,
  message     text not null,
  order_number text,
  status      public.support_status not null default 'open',
  admin_reply text,
  replied_at  timestamptz,
  replied_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_support_status on public.support_messages (status, created_at desc);

drop trigger if exists trg_support_updated_at on public.support_messages;
create trigger trg_support_updated_at
  before update on public.support_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications — in-app admin alerts (new order / payment submitted)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text not null default 'order',
  title      text not null,
  body       text,
  link       text,
  order_id   uuid references public.orders (id) on delete cascade,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_unread on public.notifications (is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- analytics_events — lightweight first-party funnel tracking (no PII)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id         bigserial primary key,
  event_name text not null,
  path       text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_event on public.analytics_events (event_name, created_at desc);

-- ---------------------------------------------------------------------------
-- admin_audit_log — who changed what (payments & orders)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_entity on public.admin_audit_log (entity, created_at desc);

-- ===========================================================================
-- >>> 0004_grants_and_rls.sql
-- ===========================================================================
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

-- ===========================================================================
-- >>> 0005_triggers.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · 0005 — Auth triggers & automatic bookkeeping
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- New auth user → profile row ("customer" role is intentionally NOT inserted
-- here: roles are resolved with a safe fallback so a missing row can never
-- lock anyone out, and only admins/staff actually need a row.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep profiles.email in sync with auth.users.email
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ---------------------------------------------------------------------------
-- Every order status change writes an audit row (public timeline)
-- ---------------------------------------------------------------------------
create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, status, note)
    values (new.id, new.status, 'Order created');
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, note, changed_by)
    values (new.id, new.status, null, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_status_log on public.orders;
create trigger trg_order_status_log
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- ---------------------------------------------------------------------------
-- New order → admin notification (in-app)
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (type, title, body, link, order_id)
  values (
    'order',
    'New order ' || new.order_number,
    new.customer_name || ' · ৳' || to_char(new.total, 'FM999999990.00'),
    '/admin/orders?order=' || new.order_number,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_order on public.orders;
create trigger trg_notify_new_order
  after insert on public.orders
  for each row execute function public.notify_new_order();

-- ---------------------------------------------------------------------------
-- Payment submitted → admin notification
-- ---------------------------------------------------------------------------
create or replace function public.notify_payment_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if new.status = 'submitted' and coalesce(old.status::text, '') <> 'submitted' then
    select * into v_order from public.orders where id = new.order_id;
    insert into public.notifications (type, title, body, link, order_id)
    values (
      'payment',
      'Payment submitted · ' || coalesce(v_order.order_number, ''),
      initcap(new.method::text) || ' · TrxID ' || coalesce(new.transaction_id, '—'),
      '/admin/orders?order=' || coalesce(v_order.order_number, ''),
      new.order_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_payment on public.payments;
create trigger trg_notify_payment
  after update of status on public.payments
  for each row execute function public.notify_payment_submitted();

-- ---------------------------------------------------------------------------
-- Increment product sales_count when an order is completed
-- ---------------------------------------------------------------------------
create or replace function public.bump_product_sales()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.products p
       set sales_count = p.sales_count + oi.qty
      from (
        select product_id, sum(quantity)::int as qty
          from public.order_items
         where order_id = new.id and product_id is not null
         group by product_id
      ) oi
     where p.id = oi.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_sales on public.orders;
create trigger trg_bump_sales
  after update of status on public.orders
  for each row execute function public.bump_product_sales();

-- ===========================================================================
-- >>> 0006_rpc_functions.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · 0006 — Secure RPC functions
--
-- All order / payment writes go through these SECURITY DEFINER functions.
-- They re-price every line from the products table, so a tampered browser
-- (fake price, fake total) can never create a cheap order.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- resolve_order_access: shared visibility test for order-scoped RPCs
-- ---------------------------------------------------------------------------
create or replace function public.can_access_order(_order public.orders)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_admin()
    or (_order.user_id is not null and _order.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- validate_coupon — safe public coupon check (never lists the coupons table)
-- ---------------------------------------------------------------------------
create or replace function public.validate_coupon(_code text, _subtotal numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c public.coupons;
  v_discount numeric := 0;
begin
  select * into c from public.coupons
   where lower(code) = lower(trim(_code)) and is_active = true;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Coupon code not found.');
  end if;
  if c.starts_at > now() then
    return jsonb_build_object('valid', false, 'message', 'This coupon is not active yet.');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
  end if;
  if _subtotal < c.min_order then
    return jsonb_build_object('valid', false,
      'message', 'Minimum order for this coupon is ৳' || to_char(c.min_order, 'FM999999990'));
  end if;

  if c.type = 'percentage' then
    v_discount := round(_subtotal * c.value / 100.0, 2);
    if c.max_discount is not null then
      v_discount := least(v_discount, c.max_discount);
    end if;
  else
    v_discount := least(c.value, _subtotal);
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', upper(c.code),
    'type', c.type,
    'value', c.value,
    'discount', v_discount,
    'description', c.description,
    'message', 'Coupon applied.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order — creates order + items atomically with server-side pricing
-- _items: [{"product_id": "...", "quantity": 1}]
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  _items          jsonb,
  _customer_name  text,
  _customer_email text,
  _customer_phone text,
  _payment_method public.payment_method,
  _coupon_code    text default null,
  _customer_note  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id   uuid;
  v_order_no   text;
  v_token      uuid;
  v_subtotal   numeric := 0;
  v_discount   numeric := 0;
  v_total      numeric := 0;
  v_item       jsonb;
  v_product    public.products;
  v_qty        int;
  v_lines      int := 0;
  v_coupon     jsonb;
  v_email      text;
begin
  -- ---- validation --------------------------------------------------------
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(_items) > 30 then
    raise exception 'Too many items in a single order.' using errcode = 'P0001';
  end if;
  if coalesce(trim(_customer_name), '') = '' or length(trim(_customer_name)) < 2 then
    raise exception 'Please provide your full name.' using errcode = 'P0001';
  end if;
  if coalesce(trim(_customer_phone), '') !~ '^(\+?88)?01[3-9][0-9]{8}$' then
    raise exception 'Please provide a valid Bangladeshi mobile number.' using errcode = 'P0001';
  end if;
  if coalesce(trim(_customer_email), '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'Please provide a valid email address.' using errcode = 'P0001';
  end if;
  v_email := trim(_customer_email);

  -- ---- price every line from the database -------------------------------
  for v_item in select * from jsonb_array_elements(_items)
  loop
    v_qty := greatest(1, least(coalesce((v_item ->> 'quantity')::int, 1), 20));

    select * into v_product
      from public.products
     where id = (v_item ->> 'product_id')::uuid
       and is_active = true;

    if not found then
      raise exception 'A product in your cart is no longer available.'
        using errcode = 'P0001';
    end if;
    if v_product.availability = 'out_of_stock' then
      raise exception '% is currently out of stock.', v_product.name using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_product.discounted_price * v_qty);
    v_lines := v_lines + 1;
  end loop;

  -- ---- coupon -----------------------------------------------------------
  if _coupon_code is not null and length(trim(_coupon_code)) > 0 then
    v_coupon := public.validate_coupon(trim(_coupon_code), v_subtotal);
    if (v_coupon ->> 'valid')::boolean then
      v_discount := (v_coupon ->> 'discount')::numeric;
    else
      raise exception '%', (v_coupon ->> 'message') using errcode = 'P0001';
    end if;
  end if;

  v_total := greatest(0, v_subtotal - v_discount);

  -- ---- create order ----------------------------------------------------
  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, customer_note,
    subtotal, discount, total, coupon_code, payment_method, status
  ) values (
    auth.uid(), trim(_customer_name), v_email, trim(_customer_phone), nullif(trim(_customer_note), ''),
    v_subtotal, v_discount, v_total,
    nullif(upper(trim(_coupon_code)), ''), _payment_method, 'pending_payment'
  )
  returning id, order_number, access_token into v_order_id, v_order_no, v_token;

  -- ---- create items with price snapshots --------------------------------
  for v_item in select * from jsonb_array_elements(_items)
  loop
    v_qty := greatest(1, least(coalesce((v_item ->> 'quantity')::int, 1), 20));
    select * into v_product from public.products
     where id = (v_item ->> 'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, product_name, product_image, duration,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.image_url, v_product.duration,
      v_product.discounted_price, v_qty, v_product.discounted_price * v_qty
    );
  end loop;

  -- ---- pending payment placeholder --------------------------------------
  insert into public.payments (order_id, method, amount, status)
  values (v_order_id, _payment_method, v_total, 'pending');

  -- ---- coupon usage -----------------------------------------------------
  if v_discount > 0 then
    update public.coupons set used_count = used_count + 1
     where lower(code) = lower(trim(_coupon_code));
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_no,
    'access_token', v_token,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_total,
    'items', v_lines
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_payment — customer submits TrxID + optional proof.
-- Moves order pending_payment → payment_submitted. NEVER marks it paid.
-- Access: authenticated (own order) OR anonymous with the order access token
-- (guest checkout that has not been claimed by an account).
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment(
  _order_number   text,
  _access_token   uuid,
  _method         public.payment_method,
  _transaction_id text,
  _sender_number  text default null,
  _amount         numeric default null,
  _proof_url      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order   public.orders;
  v_payment public.payments;
begin
  select * into v_order from public.orders where order_number = _order_number;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  -- authorisation: admin, owner account, or guest holding the token
  if not (public.is_admin()
          or (v_order.user_id is not null and v_order.user_id = auth.uid())
          or (v_order.user_id is null and v_order.access_token = _access_token)) then
    raise exception 'You are not allowed to update this order.' using errcode = 'P0001';
  end if;

  if v_order.status not in ('pending_payment') then
    raise exception 'Payment for this order has already been submitted.' using errcode = 'P0001';
  end if;

  if coalesce(trim(_transaction_id), '') !~ '^[A-Za-z0-9\-]{4,40}$' then
    raise exception 'Please enter a valid transaction ID (4–40 letters/numbers).' using errcode = 'P0001';
  end if;

  select * into v_payment from public.payments where order_id = v_order.id order by created_at limit 1;
  if not found then
    insert into public.payments (order_id, method, amount)
    values (v_order.id, _method, coalesce(_amount, v_order.total))
    returning * into v_payment;
  end if;

  update public.payments
     set method = _method,
         transaction_id = upper(trim(_transaction_id)),
         sender_number = nullif(trim(_sender_number), ''),
         amount = coalesce(_amount, v_order.total),
         proof_url = coalesce(nullif(trim(_proof_url), ''), proof_url),
         status = 'submitted'
   where id = v_payment.id;

  update public.orders
     set status = 'payment_submitted', payment_method = _method
   where id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'payment_submitted',
    'message', 'Payment submitted. Our team will verify it shortly.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_order (by number + token) — for guest tracking without an account
-- ---------------------------------------------------------------------------
create or replace function public.get_order(_order_number text, _access_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_items jsonb;
  v_payment jsonb;
  v_history jsonb;
begin
  select * into v_order from public.orders where order_number = _order_number;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;
  if not (public.is_admin()
          or (v_order.user_id is not null and v_order.user_id = auth.uid())
          or (v_order.user_id is null and v_order.access_token = _access_token)) then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
    into v_items from public.order_items i where i.order_id = v_order.id;

  select to_jsonb(p) - 'admin_note' into v_payment
    from public.payments p where p.order_id = v_order.id
    order by p.created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'note', h.note, 'created_at', h.created_at)
                            order by h.created_at), '[]'::jsonb)
    into v_history from public.order_status_history h
   where h.order_id = v_order.id and h.is_internal = false;

  return jsonb_build_object(
    'order', (to_jsonb(v_order) - 'access_token'),
    'items', v_items,
    'payment', v_payment,
    'history', v_history
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_update_order_status — admin only, writes audit log
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_order_status(
  _order_id uuid,
  _status   public.order_status,
  _note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = _order_id;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  update public.orders set status = _status where id = _order_id;

  if _note is not null and length(trim(_note)) > 0 then
    insert into public.order_status_history (order_id, status, note, changed_by)
    values (_order_id, _status, trim(_note), auth.uid());
  end if;

  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'update_status', 'orders', _order_id::text,
          jsonb_build_object('from', v_order.status, 'to', _status, 'note', _note));

  return jsonb_build_object('ok', true, 'status', _status);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_verify_payment — verify / reject a submitted payment.
-- Verifying sets the order to payment_verified (never "completed" silently).
-- ---------------------------------------------------------------------------
create or replace function public.admin_verify_payment(
  _payment_id uuid,
  _decision   public.payment_status,   -- 'verified' | 'rejected'
  _note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if _decision not in ('verified', 'rejected') then
    raise exception 'Decision must be verified or rejected.' using errcode = 'P0001';
  end if;

  select * into v_payment from public.payments where id = _payment_id;
  if not found then
    raise exception 'Payment not found.' using errcode = 'P0001';
  end if;

  update public.payments
     set status = _decision,
         admin_note = nullif(trim(_note), ''),
         verified_by = case when _decision = 'verified' then auth.uid() else null end,
         verified_at = case when _decision = 'verified' then now() else null end
   where id = _payment_id;

  update public.orders
     set status = case when _decision = 'verified' then 'payment_verified'::public.order_status
                       else 'pending_payment'::public.order_status end
   where id = v_payment.order_id;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (v_payment.order_id,
          case when _decision = 'verified' then 'payment_verified'::public.order_status
               else 'pending_payment'::public.order_status end,
          case when _decision = 'verified' then 'Payment verified by admin'
               else 'Payment rejected: ' || coalesce(nullif(trim(_note), ''), 'invalid transaction') end,
          auth.uid());

  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'verify_payment', 'payments', _payment_id::text,
          jsonb_build_object('decision', _decision, 'note', _note));

  return jsonb_build_object('ok', true, 'status', _decision);
end;
$$;

-- ---------------------------------------------------------------------------
-- lookup_guest_order — find an order by number + email (support flow)
-- ---------------------------------------------------------------------------
create or replace function public.lookup_guest_order(_order_number text, _email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders
   where order_number = _order_number
     and lower(customer_email::text) = lower(trim(_email))
   limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'total', v_order.total,
    'created_at', v_order.created_at,
    'access_token', v_order.access_token
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_guest_order — attach a guest order to the logged-in account
-- ---------------------------------------------------------------------------
create or replace function public.claim_guest_order(_order_number text, _email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;

  select * into v_order from public.orders
   where order_number = _order_number
     and lower(customer_email::text) = lower(trim(_email))
     and user_id is null;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No matching guest order found.');
  end if;

  update public.orders set user_id = auth.uid() where id = v_order.id;

  insert into public.payments (order_id, method, amount)
  select v_order.id, v_order.payment_method, v_order.total
  where not exists (select 1 from public.payments where order_id = v_order.id);

  return jsonb_build_object('ok', true, 'order_number', v_order.order_number);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_dashboard_stats — aggregate numbers for the admin overview
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_sales', coalesce((select sum(total) from public.orders
                              where status in ('completed', 'processing', 'payment_verified')), 0),
    'total_orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders
                        where status in ('pending_payment', 'payment_submitted')),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'total_customers', (select count(*) from public.profiles),
    'total_products', (select count(*) from public.products where is_active),
    'unread_notifications', (select count(*) from public.notifications where is_read = false),
    'open_support', (select count(*) from public.support_messages where status = 'open'),
    'revenue_today', coalesce((select sum(total) from public.orders
                                where status in ('completed', 'processing', 'payment_verified')
                                  and created_at >= date_trunc('day', now())), 0),
    'orders_today', (select count(*) from public.orders
                      where created_at >= date_trunc('day', now())),
    'sales_series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'total', coalesce(s.total, 0)) order by d)
      from generate_series((current_date - interval '13 days')::date, current_date, '1 day') d
      left join (
        select date_trunc('day', created_at)::date as day, sum(total) as total
          from public.orders
         where status in ('completed', 'processing', 'payment_verified')
           and created_at >= current_date - interval '13 days'
         group by 1
      ) s on s.day = d
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------
revoke all on function public.place_order(jsonb, text, text, text, public.payment_method, text, text) from public;
revoke all on function public.admin_dashboard_stats() from public;
revoke all on function public.admin_verify_payment(uuid, public.payment_status, text) from public;
revoke all on function public.admin_update_order_status(uuid, public.order_status, text) from public;

grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;
grant execute on function public.place_order(jsonb, text, text, text, public.payment_method, text, text) to anon, authenticated;
grant execute on function public.submit_payment(text, uuid, public.payment_method, text, text, numeric, text) to anon, authenticated;
grant execute on function public.get_order(text, uuid) to anon, authenticated;
grant execute on function public.lookup_guest_order(text, text) to anon, authenticated;
grant execute on function public.claim_guest_order(text, text) to authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_verify_payment(uuid, public.payment_status, text) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ===========================================================================
-- >>> 0007_seed_data.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · 0007 — Seed content (idempotent)
-- Catalogue lives in the database, never hardcoded in the frontend.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, description, icon, accent, sort_order) values
  ('OTT Subscriptions', 'ott-subscriptions',
   'Netflix, Prime Video, Disney+, Hoichoi and more — premium streaming at local prices.',
   'Clapperboard', 'red', 1),
  ('AI Premium Tools', 'ai-premium-tools',
   'ChatGPT Plus, Claude Pro, Gemini Advanced, Perplexity and creative AI suites.',
   'BrainCircuit', 'blue', 2),
  ('Educational Subscriptions', 'educational-subscriptions',
   'Coursera, Udemy, Skillshare and language learning to level up your career.',
   'GraduationCap', 'blue', 3),
  ('Software & Productivity', 'software-productivity',
   'Microsoft 365, Canva Pro, Adobe, Notion and the tools that get work done.',
   'Layers', 'blue', 4),
  ('Gaming & Entertainment', 'gaming-entertainment',
   'PlayStation Plus, Xbox Game Pass, Spotify and everything fun.',
   'Gamepad2', 'red', 5),
  ('Design & Creative', 'design-creative',
   'Figma, Envato Elements, Midjourney and premium creative assets.',
   'Palette', 'blue', 6)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      accent = excluded.accent,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
insert into public.products (
  category_id, name, slug, brand, short_description, description, duration,
  original_price, discounted_price, delivery_info, delivery_time, availability,
  is_featured, badge, rating, rating_count, sales_count, sort_order
)
select
  c.id, v.name, v.slug, v.brand, v.short_description, v.description, v.duration,
  v.original_price, v.discounted_price,
  'Instant delivery after payment verification. Login details are sent to your email and customer dashboard.',
  v.delivery_time, v.availability, v.is_featured, v.badge, v.rating, v.rating_count, v.sales_count, v.sort_order
from (values
  -- OTT
  ('ott-subscriptions', 'Netflix Premium 4K', 'netflix-premium-4k', 'Netflix',
   'Private 4K Ultra HD profile with your own PIN — works on TV, phone and laptop.',
   'Enjoy Netflix in stunning 4K Ultra HD on a private profile inside a Premium plan. You get your own profile with a personal PIN, so nobody else can touch your watchlist or recommendations. Supports up to 4 simultaneous screens on the main plan and works on Smart TV, Android, iOS, Windows and Fire Stick. Shared Premium plan — profile is private to you for the full duration.',
   '1 Month', 650, 390, 'Within 10–30 minutes', 'in_stock', true, 'Best Seller', 4.9, 1284, 2140, 1),

  ('ott-subscriptions', 'Netflix Premium 4K — 3 Months', 'netflix-premium-4k-3-months', 'Netflix',
   'Three months of private 4K Netflix at the best per-month price.',
   'The best value way to keep Netflix Premium 4K for a full quarter. Private profile with PIN, 4K Ultra HD streaming, and stable service backed by our replacement guarantee. Save over 40% compared to paying monthly.',
   '3 Months', 1800, 1050, 'Within 10–30 minutes', 'in_stock', true, 'Save 42%', 4.8, 642, 980, 2),

  ('ott-subscriptions', 'Amazon Prime Video', 'amazon-prime-video', 'Prime Video',
   'Full Prime Video access with your own profile — watch on any device.',
   'Amazon Prime Video with a private profile on a premium account. Watch Originals, movies and live sports in Full HD on up to 3 devices. Includes your own watchlist and parental controls.',
   '1 Month', 450, 249, 'Within 10–30 minutes', 'in_stock', false, null, 4.8, 512, 1190, 3),

  ('ott-subscriptions', 'Disney+ Premium', 'disney-plus-premium', 'Disney+',
   'Marvel, Star Wars, Pixar and National Geographic in one place.',
   'Disney+ Premium with 4K HDR streaming on a private profile. Includes Marvel, Star Wars, Pixar, Disney classics and National Geographic. Perfect for families — add profiles for the kids.',
   '1 Month', 500, 279, 'Within 10–30 minutes', 'in_stock', true, 'Family Favourite', 4.7, 388, 860, 4),

  ('ott-subscriptions', 'Hoichoi Premium', 'hoichoi-premium', 'Hoichoi',
   'The biggest Bengali OTT library — original series, films and web shows.',
   'Hoichoi Premium gives you unlimited access to Bengali original series, films, and exclusive web content in Full HD. Works on Android, iOS, Smart TV and web with downloads for offline viewing.',
   '1 Month', 300, 169, 'Within 10–30 minutes', 'in_stock', false, null, 4.8, 274, 720, 5),

  ('ott-subscriptions', 'Zee5 Premium', 'zee5-premium', 'ZEE5',
   'Indian and Bengali entertainment, originals and live TV channels.',
   'ZEE5 Premium subscription with access to Originals, movies, and 100+ live TV channels. Private profile, Full HD streaming, supports 2 devices at a time.',
   '1 Month', 350, 189, 'Within 10–30 minutes', 'limited', false, null, 4.6, 156, 340, 6),

  ('ott-subscriptions', 'Chorki Premium', 'chorki-premium', 'Chorki',
   'Bangladeshi original series and films in Full HD.',
   'Chorki Premium with unlimited access to Bangladeshi original series, films, and exclusive content. Full HD streaming with offline downloads supported.',
   '1 Month', 250, 149, 'Within 10–30 minutes', 'in_stock', false, null, 4.7, 198, 410, 7),

  -- AI
  ('ai-premium-tools', 'ChatGPT Plus', 'chatgpt-plus', 'OpenAI',
   'GPT-5 class models, advanced reasoning and priority access — private account.',
   'A private ChatGPT Plus account with access to the latest frontier models, advanced reasoning, file and image analysis, custom GPTs, and priority access during peak hours. Includes your own login credentials so your chat history stays completely private.',
   '1 Month', 2900, 1290, 'Within 15–45 minutes', 'in_stock', true, 'Trending', 4.9, 1042, 1830, 1),

  ('ai-premium-tools', 'ChatGPT Plus — 3 Months', 'chatgpt-plus-3-months', 'OpenAI',
   'A full quarter of ChatGPT Plus on a private account at a lower monthly rate.',
   'Three months of private ChatGPT Plus access with priority support and free replacement if anything goes wrong. Best option if you use AI daily for work or study.',
   '3 Months', 8700, 3490, 'Within 15–45 minutes', 'in_stock', true, 'Save 60%', 4.8, 415, 640, 2),

  ('ai-premium-tools', 'Claude Pro', 'claude-pro', 'Anthropic',
   'Anthropic Claude Pro with extended thinking and 5x higher usage limits.',
   'Claude Pro on a private account with access to the most capable Claude models, extended thinking, larger context windows, projects and artifacts. Ideal for long-document analysis, coding and writing.',
   '1 Month', 2800, 1190, 'Within 15–45 minutes', 'in_stock', true, null, 4.9, 386, 520, 3),

  ('ai-premium-tools', 'Google Gemini Advanced', 'google-gemini-advanced', 'Google',
   'Gemini Advanced with 2TB Google One storage included.',
   'Google Gemini Advanced subscription with access to Google''s most capable AI models, deep integration with Docs, Sheets, Gmail and 2TB of Google One cloud storage on your own Google account.',
   '1 Month', 2400, 990, 'Within 15–45 minutes', 'in_stock', false, null, 4.7, 248, 430, 4),

  ('ai-premium-tools', 'Perplexity Pro', 'perplexity-pro', 'Perplexity',
   'AI answer engine with unlimited Pro searches and model selection.',
   'Perplexity Pro with unlimited Pro searches, access to leading frontier models, file upload analysis and focus modes for academic and financial research.',
   '1 Month', 2600, 890, 'Within 15–45 minutes', 'in_stock', false, null, 4.7, 176, 310, 5),

  ('ai-premium-tools', 'Midjourney Standard', 'midjourney-standard', 'Midjourney',
   '15 hours of fast GPU time plus unlimited relaxed image generation.',
   'Midjourney Standard plan on a shared account setup: 15 hours of fast generation per month plus unlimited relaxed mode for AI art and commercial concept work.',
   '1 Month', 3200, 1590, 'Within 1–3 hours', 'limited', false, null, 4.6, 129, 190, 6),

  ('ai-premium-tools', 'ElevenLabs Creator', 'elevenlabs-creator', 'ElevenLabs',
   'Studio-grade AI voice generation with 100k credits per month.',
   'ElevenLabs Creator plan with 100,000 credits per month, professional voice cloning, multi-language dubbing and commercial usage rights. Perfect for YouTube voiceovers and audiobooks.',
   '1 Month', 2900, 1390, 'Within 1–3 hours', 'in_stock', false, 'New', 4.8, 88, 140, 7),

  -- Education
  ('educational-subscriptions', 'Coursera Plus', 'coursera-plus', 'Coursera',
   'Unlimited access to 7,000+ courses with certificates from top universities.',
   'Coursera Plus gives unlimited access to 7,000+ courses, Professional Certificates and Specializations from Google, IBM, Stanford, Yale and more. Earn shareable certificates for every completed course.',
   '1 Month', 6500, 1290, 'Within 2–6 hours', 'in_stock', true, 'Career Boost', 4.8, 214, 380, 1),

  ('educational-subscriptions', 'Udemy Premium Courses Bundle', 'udemy-premium-bundle', 'Udemy',
   'Hand-picked best-selling courses across tech, design and business.',
   'Get access to a curated bundle of best-selling Udemy courses across programming, design, marketing and business. Lifetime access to the selected course library with downloadable resources.',
   '12 Months', 4200, 1490, 'Within 2–6 hours', 'in_stock', false, null, 4.6, 142, 260, 2),

  ('educational-subscriptions', 'Skillshare Premium', 'skillshare-premium', 'Skillshare',
   'Thousands of creative classes with offline viewing.',
   'Skillshare Premium with unlimited access to 35,000+ classes in illustration, design, photography, freelancing and business. Offline viewing on mobile included.',
   '3 Months', 3600, 890, 'Within 2–6 hours', 'in_stock', false, null, 4.6, 118, 210, 3),

  ('educational-subscriptions', 'Duolingo Super', 'duolingo-super', 'Duolingo',
   'No ads, unlimited hearts and personalised practice.',
   'Duolingo Super removes ads, gives unlimited hearts, and unlocks personalised practice and progress quizzes so you can learn languages faster without interruptions.',
   '12 Months', 2400, 790, 'Within 1–4 hours', 'in_stock', false, null, 4.7, 203, 340, 4),

  ('educational-subscriptions', 'LinkedIn Learning', 'linkedin-learning', 'LinkedIn',
   '16,000+ expert courses plus a LinkedIn Premium badge.',
   'LinkedIn Learning with 16,000+ expert-led courses and a LinkedIn Premium badge on your profile. Includes certificates you can add directly to your LinkedIn profile.',
   '1 Month', 3200, 890, 'Within 2–6 hours', 'limited', false, null, 4.5, 96, 150, 5),

  -- Software
  ('software-productivity', 'Microsoft 365 Family', 'microsoft-365-family', 'Microsoft',
   'Word, Excel, PowerPoint, Outlook + 1TB OneDrive — 12 months.',
   'Microsoft 365 Family subscription covering Word, Excel, PowerPoint, Outlook and OneNote with 1TB OneDrive cloud storage. Desktop apps on Windows and macOS, plus mobile apps. Activation on your own Microsoft account.',
   '12 Months', 6900, 1290, 'Within 30–90 minutes', 'in_stock', true, 'Official', 4.9, 486, 910, 1),

  ('software-productivity', 'Canva Pro', 'canva-pro', 'Canva',
   'Brand kit, 100M+ premium assets and full AI design suite.',
   'Canva Pro on your own account with 100M+ premium photos, videos and graphics, brand kits, background remover, Magic Studio AI tools, and cloud storage. Perfect for social media and business design.',
   '12 Months', 6500, 990, 'Within 30–60 minutes', 'in_stock', true, 'Best Value', 4.9, 512, 1120, 2),

  ('software-productivity', 'Adobe Creative Cloud All Apps', 'adobe-creative-cloud', 'Adobe',
   'Photoshop, Illustrator, Premiere Pro and 20+ apps — one month.',
   'Adobe Creative Cloud All Apps with Photoshop, Illustrator, Premiere Pro, After Effects, InDesign, Lightroom and 20+ creative apps plus cloud storage. Activation on your own Adobe ID.',
   '1 Month', 3400, 1290, 'Within 1–3 hours', 'limited', true, null, 4.7, 168, 290, 3),

  ('software-productivity', 'Notion Plus', 'notion-plus', 'Notion',
   'Unlimited blocks, AI writing and team collaboration.',
   'Notion Plus with unlimited file uploads, unlimited guests, AI writing assistance, and advanced permissions. Great for students and small teams building a second brain.',
   '12 Months', 4800, 1090, 'Within 1–3 hours', 'in_stock', false, null, 4.7, 132, 240, 4),

  ('software-productivity', 'Grammarly Premium', 'grammarly-premium', 'Grammarly',
   'Advanced grammar, tone and plagiarism checks.',
   'Grammarly Premium with advanced grammar and style corrections, tone adjustments, plagiarism detection, and full-sentence rewrites across email, docs and the web.',
   '1 Month', 2200, 690, 'Within 1–3 hours', 'in_stock', false, null, 4.6, 108, 200, 5),

  ('software-productivity', 'Google Workspace Business', 'google-workspace-business', 'Google',
   'Professional email on your domain with 2TB Drive.',
   'Google Workspace Business Standard with professional email on your own domain, 2TB Drive storage per user, Meet with recording, and full Docs, Sheets and Slides suite.',
   '12 Months', 8400, 2290, 'Within 6–24 hours', 'in_stock', false, null, 4.8, 64, 120, 6),

  -- Gaming & entertainment
  ('gaming-entertainment', 'Spotify Premium Individual', 'spotify-premium-individual', 'Spotify',
   'Ad-free music, offline listening and high-quality audio.',
   'Spotify Premium Individual on your own account: ad-free music, unlimited skips, offline downloads, high-quality audio and podcasts. Upgrade is applied to your existing Spotify account.',
   '3 Months', 1800, 590, 'Within 30–90 minutes', 'in_stock', true, 'Popular', 4.8, 392, 830, 1),

  ('gaming-entertainment', 'YouTube Premium', 'youtube-premium', 'YouTube',
   'Ad-free YouTube, background play and YouTube Music.',
   'YouTube Premium on your own Google account with ad-free viewing, background playback, offline downloads and YouTube Music Premium included.',
   '1 Month', 450, 229, 'Within 30–90 minutes', 'in_stock', true, null, 4.8, 341, 760, 2),

  ('gaming-entertainment', 'PlayStation Plus Essential', 'playstation-plus-essential', 'PlayStation',
   'Monthly games, online multiplayer and exclusive discounts.',
   'PlayStation Plus Essential with monthly games, full online multiplayer access and member-only discounts on the PlayStation Store. Credentials or code delivered after verification.',
   '3 Months', 3200, 1490, 'Within 2–8 hours', 'in_stock', false, null, 4.6, 84, 160, 3),

  ('gaming-entertainment', 'Xbox Game Pass Ultimate', 'xbox-game-pass-ultimate', 'Xbox',
   'Hundreds of games on console, PC and cloud gaming.',
   'Xbox Game Pass Ultimate with access to hundreds of games across console, PC and cloud, plus Xbox Live Gold online multiplayer and EA Play membership.',
   '1 Month', 2400, 1090, 'Within 2–8 hours', 'limited', false, null, 4.7, 76, 130, 4),

  ('gaming-entertainment', 'Netflix + Spotify Combo', 'netflix-spotify-combo', 'NEXORA',
   'Private Netflix 4K profile plus Spotify Premium — one bundle, one price.',
   'Our most popular bundle: a private Netflix Premium 4K profile plus Spotify Premium Individual for a full month. Save more than buying them separately, with one support thread for both.',
   '1 Month', 1100, 599, 'Within 10–30 minutes', 'in_stock', true, 'Bundle', 4.9, 168, 320, 5),

  -- Design
  ('design-creative', 'Figma Professional', 'figma-professional', 'Figma',
   'Unlimited files, shared libraries and advanced prototyping.',
   'Figma Professional seat with unlimited Figma files, shared team libraries, advanced prototyping, and Dev Mode. Ideal for product designers working with a small team.',
   '12 Months', 6200, 1490, 'Within 1–4 hours', 'in_stock', false, null, 4.7, 92, 170, 1),

  ('design-creative', 'Envato Elements', 'envato-elements', 'Envato',
   'Unlimited premium templates, fonts, graphics and stock video.',
   'Envato Elements with unlimited downloads of premium WordPress themes, graphic templates, fonts, presentation decks, stock photos and video. Use in unlimited personal and client projects.',
   '1 Month', 2600, 890, 'Within 1–4 hours', 'in_stock', false, null, 4.7, 118, 210, 2),

  ('design-creative', 'Freepik Premium', 'freepik-premium', 'Freepik',
   'Unlimited AI image tools plus premium stock library.',
   'Freepik Premium with unlimited downloads from the premium stock library, AI image generator credits, and Premium AI editing tools for marketing and design teams.',
   '1 Month', 1900, 590, 'Within 1–4 hours', 'in_stock', false, null, 4.5, 74, 140, 3)
) as v(category_slug, name, slug, brand, short_description, description, duration,
       original_price, discounted_price, delivery_time, availability, is_featured,
       badge, rating, rating_count, sales_count, sort_order)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do update
  set category_id = excluded.category_id,
      name = excluded.name,
      brand = excluded.brand,
      short_description = excluded.short_description,
      description = excluded.description,
      duration = excluded.duration,
      original_price = excluded.original_price,
      discounted_price = excluded.discounted_price,
      delivery_time = excluded.delivery_time,
      availability = excluded.availability,
      is_featured = excluded.is_featured,
      badge = excluded.badge,
      rating = excluded.rating,
      rating_count = excluded.rating_count,
      sales_count = excluded.sales_count,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Payment methods (admin edits numbers in the dashboard)
-- ---------------------------------------------------------------------------
insert into public.payment_methods
  (method, display_name, account_name, account_number, account_type, bank_name, branch, instructions, is_active, sort_order)
select pm.method::public.payment_method, pm.display_name, pm.account_name, pm.account_number,
       pm.account_type, pm.bank_name, pm.branch, pm.instructions, pm.is_active, pm.sort_order
from (values
  ('bkash', 'bKash', 'NEXORA Subscriptions', '01575864415', 'Personal',
   null, null,
   '1) Open bKash app → Send Money. 2) Enter the number above. 3) Pay the exact order total. 4) Copy the Transaction ID (TrxID) from the confirmation message and submit it below.',
   true, 1),
  ('nagad', 'Nagad', 'NEXORA Subscriptions', '01575864415', 'Personal',
   null, null,
   '1) Open Nagad app → Send Money. 2) Enter the number above. 3) Pay the exact order total. 4) Copy the Transaction ID (TxnID) and submit it below.',
   true, 2),
  ('bank_transfer', 'Bank Transfer', 'NEXORA Subscriptions', '1234567890123', 'Current',
   'Dutch-Bangla Bank Ltd.', 'Dhanmondi, Dhaka',
   'Send the amount via BEFTN / NPSB (routing 1234567890124) or your bank app to the account above. In the reference field write your NEXORA order number, then submit the transfer reference number below.',
   true, 3)
) as pm(method, display_name, account_name, account_number, account_type, bank_name, branch, instructions, is_active, sort_order)
-- (values are cast in the SELECT list below)
where not exists (
  select 1 from public.payment_methods m where m.method::text = pm.method
);

-- ---------------------------------------------------------------------------
-- Website settings
-- ---------------------------------------------------------------------------
insert into public.website_settings (key, value, label, group_name, is_public) values
  ('site', jsonb_build_object(
      'name', 'NEXORA',
      'tagline', 'Premium Subscriptions — All in One Place',
      'hero_headline', 'Unlock a World of Premium Entertainment & More!',
      'hero_subtitle', 'Premium Subscriptions — All in One Place',
      'hero_cta', 'Explore Subscriptions',
      'hero_banner', '/brand/nexora-banner.png'
    ), 'Site identity & hero', 'general', true),

  ('contact', jsonb_build_object(
      'whatsapp', '+8801575864415',
      'phone', '01575864415',
      'email', 'nexora.sub01@gmail.com',
      'address', 'Dhanmondi, Dhaka, Bangladesh',
      'hours', 'Sat–Fri · 10:00 AM – 11:00 PM (BST)',
      'facebook', '',
      'messenger', ''
    ), 'Contact information', 'general', true),

  ('notices', jsonb_build_object(
      'announcement', 'Instant delivery on 40+ premium subscriptions · Verified bKash, Nagad & Bank payments',
      'announcement_active', true,
      'checkout_note', 'Payments are verified by a human within 30 minutes during business hours. You will get an email once your order is delivered.',
      'support_note', 'Need help choosing a plan? Message us on WhatsApp — we reply in minutes.'
    ), 'Announcement & notices', 'general', true),

  ('seo', jsonb_build_object(
      'title', 'NEXORA — Premium Subscriptions, All in One Place',
      'description', 'Bangladesh''s premium digital subscription store: OTT, AI tools, education, software and gaming. Instant delivery with verified manual payments.',
      'keywords', 'netflix bangladesh, chatgpt plus bd, buy subscription bd, bkash subscription store'
    ), 'SEO', 'general', true),

  ('trust', jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('title', 'Premium Accounts', 'text', 'Genuine plans, never cracked tools.'),
        jsonb_build_object('title', 'Super Fast Activation', 'text', 'Most orders delivered in under 30 minutes.'),
        jsonb_build_object('title', '100% Secure', 'text', 'Manual verification on bKash, Nagad & bank.'),
        jsonb_build_object('title', 'Trusted by Millions', 'text', '10,000+ happy customers across Bangladesh.')
      )
    ), 'Trust badges', 'homepage', true),

  ('rewards', jsonb_build_object(
      'referral_note', 'Refer a friend and get ৳50 wallet credit on their first delivered order.',
      'warranty_days', 30
    ), 'Customer promises', 'general', false)
on conflict (key) do update
  set value = public.website_settings.value || excluded.value,
      label = excluded.label,
      group_name = excluded.group_name;

-- ---------------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------------
insert into public.faqs (question, answer, category, sort_order)
select f.* from (values
  ('How fast will I receive my subscription?',
   'Most orders are delivered within 10–30 minutes after your payment is verified. Our support hours are 10:00 AM to 11:00 PM (BST). Orders placed after hours are delivered first thing the next morning.',
   'Delivery', 1),
  ('How do I pay? Is bKash accepted?',
   'Yes. We accept bKash, Nagad and bank transfer. After placing an order you will see our merchant number and step-by-step instructions. Send the exact amount, then submit your Transaction ID on the order page — our team verifies it manually.',
   'Payment', 2),
  ('Is my payment safe if something goes wrong?',
   'Every payment is verified by a human before delivery. If a subscription cannot be delivered, you get a full refund to your bKash/Nagad number or a replacement — your choice. Refunds are processed within 24–72 hours.',
   'Payment', 3),
  ('Do I need my own account for Netflix or ChatGPT?',
   'It depends on the product. Netflix Premium is delivered as a private profile inside a Premium plan, so you use the shared login we provide and set your own PIN. For ChatGPT Plus, Claude Pro, Canva Pro and Spotify you give us your email and we upgrade your own account in most cases. Each product page states the delivery model clearly.',
   'Products', 4),
  ('Can I use a subscription on more than one device?',
   'Yes for most products. Netflix Premium supports up to 4 simultaneous screens on the plan, Spotify allows multiple devices, and Microsoft 365 covers up to 5 devices. The exact limits are listed on each product page.',
   'Products', 5),
  ('What happens if my subscription stops working?',
   'Message our support on WhatsApp with your order number and we fix or replace it within 24 hours. All subscriptions are covered by a 30-day replacement warranty from the delivery date.',
   'Support', 6),
  ('Can I cancel an order?',
   'You can cancel any order that has not been delivered yet by contacting support. If payment was already verified but delivery has not happened, we refund the full amount.',
   'Orders', 7),
  ('Do you offer bulk or reseller pricing?',
   'Yes. If you need 5 or more subscriptions per month, contact us on WhatsApp with your requirements and we will send a reseller price list.',
   'Business', 8),
  ('Do I need an account to place an order?',
   'No — guest checkout is supported. But creating a free account lets you see all orders, track status and re-order in one click. You can always claim a guest order to your account later.',
   'Orders', 9),
  ('Which payment methods are verified the fastest?',
   'bKash and Nagad are usually verified within 10–20 minutes. Bank transfers can take longer because of bank confirmation cycles — expect up to a few hours during business days.',
   'Payment', 10)
) as f(question, answer, category, sort_order)
where not exists (select 1 from public.faqs x where x.question = f.question);

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
insert into public.promotions
  (title, subtitle, description, badge, cta_label, cta_link, discount_text, is_active, sort_order)
select p.* from (values
  ('Netflix 4K + Spotify Bundle', 'Two premium services, one flat price',
   'Keep your entertainment fully covered this month: private Netflix 4K profile plus Spotify Premium Individual.',
   'Bundle Deal', 'Get the Bundle', '/product/netflix-spotify-combo', 'Save 45%', true, 1),
  ('ChatGPT Plus — Trending', 'The AI tool everyone is buying',
   'Private ChatGPT Plus account with frontier models and priority access. Delivered in under 45 minutes.',
   'AI Pick', 'Explore AI Tools', '/category/ai-premium-tools', 'From ৳1,190', true, 2),
  ('Microsoft 365 — 12 Months', 'Official activation on your own account',
   'Word, Excel, PowerPoint and 1TB OneDrive for a full year at 80% off retail price.',
   'Best Value', 'Buy Now', '/product/microsoft-365-family', 'Save 81%', true, 3)
) as p(title, subtitle, description, badge, cta_label, cta_link, discount_text, is_active, sort_order)
where not exists (select 1 from public.promotions x where x.title = p.title);

-- ---------------------------------------------------------------------------
-- Approved customer reviews (public testimonials)
-- ---------------------------------------------------------------------------
insert into public.reviews (customer_name, customer_city, rating, comment, is_approved)
select r.* from (values
  ('Tanvir Ahmed', 'Dhaka', 5, 'Ordered Netflix Premium at 1 AM and got the login within 15 minutes. Private profile with my own PIN — exactly as promised.', true),
  ('Sadia Rahman', 'Chattogram', 5, 'Bought ChatGPT Plus for my thesis work. Payment verified on bKash in minutes and the account is completely private. Genuinely reliable.', true),
  ('Rafid Hasan', 'Sylhet', 5, 'Third order from NEXORA. Canva Pro and Microsoft 365 both activated on my own accounts. Support replies on WhatsApp instantly.', true),
  ('Nusrat Jahan', 'Dhaka', 4, 'Great prices and honest support. Delivery took about an hour because I ordered at midnight, but they kept me updated the whole time.', true),
  ('Imran Kabir', 'Khulna', 5, 'I was sceptical about buying subscriptions online, but the manual verification system makes it feel safe. Got my Disney+ profile in 12 minutes.', true),
  ('Farhana Akter', 'Rajshahi', 5, 'Coursera Plus at this price is unreal. Certificate works and my university accepted it. Real people handling the support too.', true),
  ('Mehedi Hasan', 'Barishal', 5, 'Bought the Netflix + Spotify bundle for my sister. Everything worked first try and renewals are one message away.', true),
  ('Ayesha Siddika', 'Dhaka', 5, 'Spotify Premium upgraded on my own account in 40 minutes. Two months in, zero issues. This is my go-to store now.', true)
) as r(customer_name, customer_city, rating, comment, is_approved)
where not exists (select 1 from public.reviews x where x.customer_name = r.customer_name and x.comment = r.comment);

-- ===========================================================================
-- >>> 0008_admin_setup.sql
-- ===========================================================================
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

-- ===========================================================================
-- >>> 0009_storage.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · 0009 — Storage buckets & policies
--
-- product-images : PUBLIC read (catalogue imagery), admin-only writes
-- payment-proofs : PRIVATE (transaction screenshots), write-only uploads for
--                  customers, read restricted to administrators via signed URLs
--
-- Safe to run on a plain PostgreSQL (no storage schema) — it skips quietly.
-- ===========================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Storage schema not present — skipping bucket setup (run on Supabase).';
    return;
  end if;

  -- ---------------------------------------------------------------- buckets
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'product-images', 'product-images', true, 4194304,
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = true,
        file_size_limit = 4194304,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'payment-proofs', 'payment-proofs', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = 5242880,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  -- ------------------------------------------------- product-images policies
  drop policy if exists "product images: public read"  on storage.objects;
  drop policy if exists "product images: admin write"  on storage.objects;
  drop policy if exists "product images: admin update" on storage.objects;
  drop policy if exists "product images: admin delete" on storage.objects;

  create policy "product images: public read" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'product-images');

  create policy "product images: admin write" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'product-images' and public.is_admin());

  create policy "product images: admin update" on storage.objects
    for update to authenticated
    using (bucket_id = 'product-images' and public.is_admin())
    with check (bucket_id = 'product-images' and public.is_admin());

  create policy "product images: admin delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'product-images' and public.is_admin());

  -- ------------------------------------------------- payment-proofs policies
  drop policy if exists "payment proofs: anyone upload" on storage.objects;
  drop policy if exists "payment proofs: admin read"    on storage.objects;
  drop policy if exists "payment proofs: admin delete"  on storage.objects;

  -- Customers (and guests) may upload a proof, but never list or read others.
  create policy "payment proofs: anyone upload" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'payment-proofs');

  create policy "payment proofs: admin read" on storage.objects
    for select to authenticated
    using (bucket_id = 'payment-proofs' and public.is_admin());

  create policy "payment proofs: admin delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'payment-proofs' and public.is_admin());

  raise notice 'NEXORA storage buckets and policies configured.';
end $$;


-- ===========================================================================
-- >>> 0010_rpc_security_and_fk_indexes.sql
-- ===========================================================================
-- NEXORA 0010: Harden SECURITY DEFINER RPC grants and add missing FK indexes.
-- This migration is idempotent and has already been applied to the connected project.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.signature);
  end loop;
end $$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.can_access_order(public.orders) to anon, authenticated;
grant execute on function public.is_super_admin() to authenticated;

grant execute on function public.place_order(jsonb,text,text,text,public.payment_method,text,text) to anon, authenticated;
grant execute on function public.submit_payment(text,uuid,public.payment_method,text,text,numeric,text) to anon, authenticated;
grant execute on function public.get_order(text,uuid) to anon, authenticated;
grant execute on function public.lookup_guest_order(text,text) to anon, authenticated;
grant execute on function public.validate_coupon(text,numeric) to anon, authenticated;
grant execute on function public.claim_guest_order(text,text) to authenticated;

grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_set_role(text,public.app_role) to authenticated;
grant execute on function public.admin_update_order_status(uuid,public.order_status,text) to authenticated;
grant execute on function public.admin_verify_payment(uuid,public.payment_status,text) to authenticated;
grant execute on function public.bootstrap_admin(text,text) to authenticated;

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.generate_order_number() set search_path = public, pg_temp;

create index if not exists idx_admin_audit_actor on public.admin_audit_log(actor_id);
create index if not exists idx_notifications_order on public.notifications(order_id);
create index if not exists idx_order_history_changed_by on public.order_status_history(changed_by);
create index if not exists idx_payments_verified_by on public.payments(verified_by);
create index if not exists idx_reviews_user on public.reviews(user_id);
create index if not exists idx_support_replied_by on public.support_messages(replied_by);
create index if not exists idx_support_user on public.support_messages(user_id);
create index if not exists idx_user_roles_granted_by on public.user_roles(granted_by);


-- ===========================================================================
-- >>> 0011_dynamic_payment_methods.sql
-- ===========================================================================
-- Dynamic payment method management for NEXORA.
-- Existing admin-write and public-active-read RLS policies remain in force.
alter table public.payment_methods alter column method type text using method::text;
alter table public.payment_methods
  add column if not exists method_key text,
  add column if not exists payment_type text not null default 'manual',
  add column if not exists extra_details jsonb not null default '{}'::jsonb,
  add column if not exists requires_transaction_id boolean not null default true,
  add column if not exists qr_image_url text;
update public.payment_methods set method_key = coalesce(nullif(method_key, ''), method) where method_key is null or method_key = '';
alter table public.payment_methods alter column method_key set not null;
create unique index if not exists payment_methods_method_key_uidx on public.payment_methods (method_key);
alter table public.payment_methods
  add constraint payment_methods_method_key_format check (method_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  add constraint payment_methods_payment_type_check check (payment_type in ('manual', 'gateway'));
alter table public.payments alter column method drop not null;
alter table public.payments
  add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null,
  add column if not exists method_key text,
  add column if not exists method_label text;
create index if not exists payments_payment_method_id_idx on public.payments(payment_method_id);
comment on column public.payment_methods.method_key is 'Admin-defined unique key for any custom payment method.';
comment on column public.payment_methods.extra_details is 'Public structured details configured by admins, such as account holder, bank branch, routing number, and custom instructions.';
comment on column public.payments.payment_method_id is 'Selected payment method record; nullable so historical payments survive method deletion.';
comment on column public.payments.method_label is 'Snapshot of the customer-facing payment method name at checkout.';

-- ===========================================================================
-- >>> 0012_admin_username_auth.sql
-- ===========================================================================
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


-- ===========================================================================
-- >>> 0013_analytics_query_indexes.sql
-- ===========================================================================
-- NEXORA · 0013 — Analytics query indexes
-- Keeps the 30-day analytics dashboard responsive as event/profile tables grow.
create index if not exists idx_analytics_created_at
  on public.analytics_events (created_at desc);

create index if not exists idx_profiles_created_at
  on public.profiles (created_at desc);


-- ===========================================================================
-- >>> 20261121180936_revoke_public_bootstrap_admin.sql
-- ===========================================================================
-- NEXORA live hardening: bootstrap_admin is not a public setup endpoint.
revoke all on function public.bootstrap_admin(text, text) from public, anon, authenticated;


-- ===========================================================================
-- >>> 20261121180950_restrict_anon_admin_checks.sql
-- ===========================================================================
-- NEXORA live hardening: admin authorization checks require a signed-in role.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;


-- ===========================================================================
-- >>> 20261121182411_revoke_unused_order_helper_rpcs.sql
-- ===========================================================================
-- These helper RPCs are not called by the storefront or RLS policies.
-- lookup_guest_order returned the guest access token from order number + email,
-- so leaving it callable would allow token disclosure.
revoke all on function public.lookup_guest_order(text, text) from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.can_access_order(public.orders) from public, anon, authenticated;


-- ===========================================================================
-- >>> 20261121182504_harden_payment_submission_validation.sql
-- ===========================================================================
-- NEXORA: validate payment submissions server-side and serialize concurrent updates.
create or replace function public.submit_payment(
  _order_number text,
  _access_token uuid,
  _method public.payment_method,
  _transaction_id text,
  _sender_number text default null,
  _amount numeric default null,
  _proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order public.orders;
  v_payment public.payments;
  v_sender text;
  v_proof text;
begin
  select * into v_order
    from public.orders
   where order_number = upper(trim(_order_number))
   for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if not (
    public.is_admin()
    or (v_order.user_id is not null and v_order.user_id = auth.uid())
    or (v_order.user_id is null and v_order.access_token = _access_token)
  ) then
    raise exception 'You are not allowed to update this order.' using errcode = '42501';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Payment for this order has already been submitted.' using errcode = 'P0001';
  end if;

  if coalesce(trim(_transaction_id), '') !~ '^[A-Za-z0-9-]{4,40}$' then
    raise exception 'Please enter a valid transaction ID (4–40 letters/numbers).' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.payment_methods
     where method = _method and is_active = true
  ) then
    raise exception 'This payment method is currently unavailable.' using errcode = 'P0001';
  end if;

  if _amount is not null and round(_amount, 2) <> round(v_order.total, 2) then
    raise exception 'Payment amount must match the order total.' using errcode = 'P0001';
  end if;

  v_sender := nullif(trim(_sender_number), '');
  if v_sender is not null and (length(v_sender) < 5 or length(v_sender) > 24
      or v_sender !~ '^[0-9+ -]+$') then
    raise exception 'Please enter a valid sender number.' using errcode = 'P0001';
  end if;

  v_proof := nullif(trim(_proof_url), '');
  if v_proof is not null and (
      length(v_proof) > 2048
      or left(v_proof, length('https://vxorwxecyfhuzzgtyowy.supabase.co/storage/v1/object/public/payment-proofs/'))
         <> 'https://vxorwxecyfhuzzgtyowy.supabase.co/storage/v1/object/public/payment-proofs/'
  ) then
    raise exception 'Payment proof must be uploaded through the NEXORA payment form.' using errcode = 'P0001';
  end if;

  select * into v_payment
    from public.payments
   where order_id = v_order.id
   order by created_at
   limit 1
   for update;

  if not found then
    insert into public.payments (order_id, method, amount)
    values (v_order.id, _method, v_order.total)
    returning * into v_payment;
  end if;

  update public.payments
     set method = _method,
         transaction_id = upper(trim(_transaction_id)),
         sender_number = v_sender,
         amount = v_order.total,
         proof_url = coalesce(v_proof, proof_url),
         status = 'submitted'
   where id = v_payment.id;

  update public.orders
     set status = 'payment_submitted',
         payment_method = _method
   where id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'payment_submitted',
    'message', 'Payment submitted. Our team will verify it shortly.'
  );
end;
$function$;


-- ===========================================================================
-- >>> 20261122110000_strict_order_and_coupon_validation.sql
-- ===========================================================================
-- NEXORA: validate order input strictly and serialize coupon limit checks.
create or replace function public.place_order(
  _items jsonb,
  _customer_name text,
  _customer_email text,
  _customer_phone text,
  _payment_method public.payment_method,
  _coupon_code text default null,
  _customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order_id uuid;
  v_order_no text;
  v_token uuid;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product public.products;
  v_qty int;
  v_lines int := 0;
  v_coupon jsonb;
  v_coupon_id uuid;
  v_coupon_applied boolean := false;
  v_email text;
  v_name text;
  v_phone text;
  v_note text;
  v_code text;
  v_product_id text;
  v_qty_text text;
begin
  if _items is null or jsonb_typeof(_items) <> 'array'
     or jsonb_array_length(_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(_items) > 30 then
    raise exception 'Too many items in a single order.' using errcode = 'P0001';
  end if;

  v_name := trim(coalesce(_customer_name, ''));
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Please provide your name (2–120 characters).' using errcode = 'P0001';
  end if;

  v_phone := trim(coalesce(_customer_phone, ''));
  if v_phone !~ '^(\+?88)?01[3-9][0-9]{8}$' then
    raise exception 'Please provide a valid Bangladeshi mobile number.' using errcode = 'P0001';
  end if;

  v_email := trim(coalesce(_customer_email, ''));
  if length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'Please provide a valid email address.' using errcode = 'P0001';
  end if;

  v_note := nullif(trim(coalesce(_customer_note, '')), '');
  if v_note is not null and length(v_note) > 500 then
    raise exception 'Order note is too long (maximum 500 characters).' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.payment_methods
     where method = _payment_method and is_active = true
  ) then
    raise exception 'This payment method is currently unavailable.' using errcode = 'P0001';
  end if;

  v_code := nullif(upper(trim(coalesce(_coupon_code, ''))), '');
  if v_code is not null and length(v_code) > 64 then
    raise exception 'Coupon code is too long.' using errcode = 'P0001';
  end if;

  for v_item in select value from jsonb_array_elements(_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid cart item.' using errcode = 'P0001';
    end if;

    v_product_id := coalesce(v_item ->> 'product_id', '');
    if v_product_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'A cart item has an invalid product.' using errcode = 'P0001';
    end if;

    v_qty_text := coalesce(v_item ->> 'quantity', '1');
    if v_qty_text !~ '^[0-9]{1,2}$' then
      raise exception 'Product quantity must be a whole number between 1 and 20.' using errcode = 'P0001';
    end if;
    v_qty := v_qty_text::int;
    if v_qty < 1 or v_qty > 20 then
      raise exception 'Product quantity must be between 1 and 20.' using errcode = 'P0001';
    end if;

    select * into v_product
      from public.products
     where id = v_product_id::uuid
       and is_active = true;

    if not found then
      raise exception 'A product in your cart is no longer available.' using errcode = 'P0001';
    end if;
    if v_product.availability = 'out_of_stock' then
      raise exception '% is currently out of stock.', v_product.name using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_product.discounted_price * v_qty);
    v_lines := v_lines + 1;
  end loop;

  if v_code is not null then
    select id into v_coupon_id
      from public.coupons
     where lower(code) = lower(v_code)
     for update;

    v_coupon := public.validate_coupon(v_code, v_subtotal);
    if coalesce((v_coupon ->> 'valid')::boolean, false) then
      v_discount := (v_coupon ->> 'discount')::numeric;
      v_coupon_applied := true;
    else
      raise exception '%', (v_coupon ->> 'message') using errcode = 'P0001';
    end if;
  end if;

  v_total := greatest(0, v_subtotal - v_discount);

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, customer_note,
    subtotal, discount, total, coupon_code, payment_method, status
  ) values (
    auth.uid(), v_name, v_email, v_phone, v_note,
    v_subtotal, v_discount, v_total, v_code, _payment_method, 'pending_payment'
  )
  returning id, order_number, access_token into v_order_id, v_order_no, v_token;

  for v_item in select value from jsonb_array_elements(_items)
  loop
    v_product_id := v_item ->> 'product_id';
    v_qty := coalesce((v_item ->> 'quantity')::int, 1);
    select * into v_product from public.products where id = v_product_id::uuid;

    insert into public.order_items (
      order_id, product_id, product_name, product_image, duration,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.image_url, v_product.duration,
      v_product.discounted_price, v_qty, v_product.discounted_price * v_qty
    );
  end loop;

  insert into public.payments (order_id, method, amount, status)
  values (v_order_id, _payment_method, v_total, 'pending');

  if v_coupon_applied and v_coupon_id is not null then
    update public.coupons
       set used_count = used_count + 1
     where id = v_coupon_id;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_no,
    'access_token', v_token,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_total,
    'items', v_lines
  );
end;
$function$;


-- ===========================================================================
-- >>> 20261122110500_lock_product_rows_during_checkout.sql
-- ===========================================================================
-- Hold a shared lock on each priced product row until checkout commits.
-- This prevents a concurrent price/availability edit from making the saved order
-- line totals differ from the subtotal computed earlier in place_order.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.place_order(jsonb,text,text,text,public.payment_method,text,text)'::regprocedure)
    into v_definition;

  if position('and is_active = true for share' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'and is_active = true;',
      'and is_active = true for share;'
    );
    execute v_definition;
  end if;
end;
$migration$;


-- ===========================================================================
-- >>> 20261122111000_validate_coupon_input_bounds.sql
-- ===========================================================================
create or replace function public.validate_coupon(_code text, _subtotal numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  c public.coupons;
  v_discount numeric := 0;
  v_code text;
begin
  v_code := trim(coalesce(_code, ''));

  if length(v_code) = 0 or length(v_code) > 64 then
    return jsonb_build_object('valid', false, 'message', 'Please enter a valid coupon code.');
  end if;

  if _subtotal is null or _subtotal < 0 or _subtotal > 100000000
     or _subtotal::text in ('NaN', 'Infinity', '-Infinity') then
    return jsonb_build_object('valid', false, 'message', 'Order subtotal is invalid.');
  end if;

  select * into c from public.coupons
   where lower(code) = lower(v_code) and is_active = true;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Coupon code not found.');
  end if;
  if c.starts_at > now() then
    return jsonb_build_object('valid', false, 'message', 'This coupon is not active yet.');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
  end if;
  if _subtotal < c.min_order then
    return jsonb_build_object('valid', false,
      'message', 'Minimum order for this coupon is ৳' || to_char(c.min_order, 'FM999999990'));
  end if;

  if c.type = 'percentage' then
    v_discount := round(_subtotal * c.value / 100.0, 2);
    if c.max_discount is not null then
      v_discount := least(v_discount, c.max_discount);
    end if;
  else
    v_discount := least(c.value, _subtotal);
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', upper(c.code),
    'type', c.type,
    'value', c.value,
    'discount', v_discount,
    'description', c.description,
    'message', 'Coupon applied.'
  );
end;
$function$;


-- ===========================================================================
-- >>> 20261122111500_cast_payment_method_in_active_checks.sql
-- ===========================================================================
-- payment_methods.method is text, while RPC parameters use the payment_method enum.
-- Cast the enum to text to avoid runtime operator type errors during checkout.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.place_order(jsonb,text,text,text,public.payment_method,text,text)'::regprocedure)
    into v_definition;
  v_definition := replace(
    v_definition,
    'where method = _payment_method and is_active = true',
    'where method = _payment_method::text and is_active = true'
  );
  execute v_definition;

  select pg_get_functiondef('public.submit_payment(text,uuid,public.payment_method,text,text,numeric,text)'::regprocedure)
    into v_definition;
  v_definition := replace(
    v_definition,
    'where method = _method and is_active = true',
    'where method = _method::text and is_active = true'
  );
  execute v_definition;
end;
$migration$;


-- ===========================================================================
-- >>> 20261122112000_require_verified_email_for_guest_order_claim.sql
-- ===========================================================================
create or replace function public.claim_guest_order(_order_number text, _email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order public.orders;
  v_verified_email text;
  v_email_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;

  -- Claiming a guest order is an ownership transfer. Require a verified account
  -- email matching both the submitted email and the order's customer email.
  select lower(trim(email)), email_confirmed_at
    into v_verified_email, v_email_confirmed_at
    from auth.users
   where id = auth.uid();

  if v_email_confirmed_at is null or v_verified_email is null then
    raise exception 'Verify your account email before claiming an order.' using errcode = '42501';
  end if;

  if v_verified_email <> lower(trim(coalesce(_email, ''))) then
    raise exception 'Use the verified email address on your account.' using errcode = '42501';
  end if;

  select * into v_order
    from public.orders
   where upper(order_number) = upper(trim(_order_number))
     and lower(customer_email) = v_verified_email
     and user_id is null
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No matching guest order found.');
  end if;

  update public.orders set user_id = auth.uid() where id = v_order.id;

  insert into public.payments (order_id, method, amount)
  select v_order.id, v_order.payment_method, v_order.total
  where not exists (select 1 from public.payments where order_id = v_order.id);

  return jsonb_build_object('ok', true, 'order_number', v_order.order_number);
end;
$function$;


-- ===========================================================================
-- >>> 20261122113000_bound_public_analytics_event_payloads.sql
-- ===========================================================================
-- Bound public analytics input to reduce abusive or oversized event writes.
-- Keep event names flexible for existing frontend event tracking.
drop policy if exists "analytics: insert anyone" on public.analytics_events;

create policy "analytics: bounded public insert"
on public.analytics_events
for insert
to anon, authenticated
with check (
  length(btrim(event_name)) between 1 and 80
  and (path is null or length(path) <= 512)
  and jsonb_typeof(metadata) = 'object'
  and octet_length(metadata::text) <= 2048
);


-- ===========================================================================
-- >>> 20261122113500_include_visit_and_signup_metrics_in_admin_stats.sql
-- ===========================================================================
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_sales', coalesce((select sum(total) from public.orders
                              where status in ('completed', 'processing', 'payment_verified')), 0),
    'total_orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders
                        where status in ('pending_payment', 'payment_submitted')),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'total_customers', (select count(*) from public.profiles),
    'signups_today', (select count(*) from public.profiles
                        where created_at >= date_trunc('day', now())),
    'total_page_views', (select count(*) from public.analytics_events
                          where event_name = 'page_view'),
    'page_views_today', (select count(*) from public.analytics_events
                          where event_name = 'page_view'
                            and created_at >= date_trunc('day', now())),
    'total_products', (select count(*) from public.products where is_active),
    'unread_notifications', (select count(*) from public.notifications where is_read = false),
    'open_support', (select count(*) from public.support_messages where status = 'open'),
    'revenue_today', coalesce((select sum(total) from public.orders
                                where status in ('completed', 'processing', 'payment_verified')
                                  and created_at >= date_trunc('day', now())), 0),
    'orders_today', (select count(*) from public.orders
                      where created_at >= date_trunc('day', now())),
    'sales_series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'total', coalesce(s.total, 0)) order by d)
      from generate_series((current_date - interval '13 days')::date, current_date, '1 day') d
      left join (
        select date_trunc('day', created_at)::date as day, sum(total) as total
          from public.orders
         where status in ('completed', 'processing', 'payment_verified')
           and created_at >= current_date - interval '13 days'
         group by 1
      ) s on s.day = d
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$function$;


-- ===========================================================================
-- >>> 20261122114500_restrict_payment_proof_uploads_to_active_orders.sql
-- ===========================================================================
-- Guest checkout still needs to upload payment evidence before submitting payment.
-- Restrict the public insert policy to a valid, existing pending order and bounded file metadata.
drop policy if exists "payment proofs: anyone upload" on storage.objects;

create policy "payment proofs: bounded order upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'payment-proofs'
  and name ~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}\.(jpg|jpeg|png|webp|pdf)$'
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880
  and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp','application/pdf')
  and exists (
    select 1
      from public.orders o
     where o.order_number = split_part(name, '/', 1)
       and o.status in ('pending_payment','payment_submitted')
       and (
         o.user_id is null
         or o.user_id = auth.uid()
         or public.is_admin()
       )
  )
);


-- ===========================================================================
-- >>> 20261122120000_account_based_new_customer_offer.sql
-- ===========================================================================
-- NEXORA: account-based first-three-order offer, enforced in trusted checkout.
alter table public.products
  add column if not exists new_user_offer_enabled boolean not null default false;

create or replace view public.public_products as
select
  id, category_id, name, slug, brand, short_description, description,
  image_url, gallery, duration, original_price, discounted_price,
  delivery_info, delivery_time, availability, is_featured, is_active,
  badge, rating, rating_count, sales_count, sort_order, created_at,
  updated_at, new_user_offer_enabled
from public.products;

do $migration$
declare
  v_definition text;
  v_original text;
begin
  v_definition := pg_get_functiondef(
    'public.place_order(jsonb,text,text,text,public.payment_method,text,text)'::regprocedure
  );
  v_original := v_definition;

  v_definition := replace(
    v_definition,
    '  v_qty_text text;',
    '  v_qty_text text;
  v_user_order_count int := 0;
  v_offer_active boolean := false;
  v_offer_applied boolean := false;
  v_effective_price numeric;'
  );

  v_definition := replace(
    v_definition,
    'begin
  if _items is null or jsonb_typeof(_items) <> ''array''',
    'begin
  -- Serialize checkout attempts for this account so simultaneous requests
  -- cannot all see the same first-three-order count.
  if auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
    select count(*)::int into v_user_order_count
      from public.orders
     where user_id = auth.uid()
       and status not in (''cancelled'', ''refunded'');
    v_offer_active := v_user_order_count < 3;
  end if;

  if _items is null or jsonb_typeof(_items) <> ''array'''
  );

  v_definition := replace(
    v_definition,
    '    v_subtotal := v_subtotal + (v_product.discounted_price * v_qty);',
    '    v_effective_price := v_product.discounted_price;
    if v_offer_active and v_product.new_user_offer_enabled then
      v_effective_price := round(v_product.discounted_price * 0.10, 2);
      v_offer_applied := true;
    end if;
    v_subtotal := v_subtotal + (v_effective_price * v_qty);'
  );

  v_definition := replace(
    v_definition,
    '      v_product.discounted_price, v_qty, v_product.discounted_price * v_qty',
    '      case
        when v_offer_active and v_product.new_user_offer_enabled
          then round(v_product.discounted_price * 0.10, 2)
        else v_product.discounted_price
      end,
      v_qty,
      (case
        when v_offer_active and v_product.new_user_offer_enabled
          then round(v_product.discounted_price * 0.10, 2)
        else v_product.discounted_price
      end) * v_qty'
  );

  v_definition := replace(
    v_definition,
    '    ''items'', v_lines',
    '    ''items'', v_lines,
    ''new_customer_offer_applied'', v_offer_applied,
    ''new_customer_offer_orders_used'', v_user_order_count + 1'
  );

  if v_definition = v_original
     or position('v_offer_active boolean' in v_definition) = 0
     or position('new_customer_offer_applied' in v_definition) = 0
     or position('round(v_product.discounted_price * 0.10, 2)' in v_definition) = 0 then
    raise exception 'Offer migration could not safely patch the current place_order definition; no RPC changes were applied.';
  end if;

  execute v_definition;
end;
$migration$;


-- ===========================================================================
-- >>> 20261122123000_offer_eligibility_status_rpc.sql
-- ===========================================================================
create or replace function public.get_new_customer_offer_status()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to check your new-customer offer.' using errcode = '28000';
  end if;

  select count(*)::int into v_count
    from public.orders
   where user_id = auth.uid()
     and status not in ('cancelled', 'refunded');

  return jsonb_build_object(
    'eligible', v_count < 3,
    'orders_used', v_count,
    'orders_remaining', greatest(0, 3 - v_count)
  );
end;
$function$;

revoke all on function public.get_new_customer_offer_status() from public;
revoke all on function public.get_new_customer_offer_status() from anon;
grant execute on function public.get_new_customer_offer_status() to authenticated;


-- ===========================================================================
-- >>> 20261122140000_restore_safe_profile_update_column_grants.sql
-- ===========================================================================
-- Restore only the profile columns used by the customer profile editor and admin block toggle.
-- RLS policies continue to restrict customers to their own row and admins to permitted rows.
grant update (full_name, phone, address, city, is_blocked)
  on table public.profiles to authenticated;


-- ===========================================================================
-- >>> 20261122143000_admin_only_customer_block_toggle.sql
-- ===========================================================================
-- Keep customer-editable fields separate from the admin-only block flag.
revoke update (is_blocked) on table public.profiles from authenticated;
grant update (full_name, phone, address, city)
  on table public.profiles to authenticated;

create or replace function public.admin_set_customer_blocked(_user_id uuid, _blocked boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  update public.profiles
     set is_blocked = _blocked,
         updated_at = now()
   where id = _user_id;
  if not found then
    raise exception 'Customer profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_customer_blocked(uuid, boolean) from public;
revoke all on function public.admin_set_customer_blocked(uuid, boolean) from anon;
grant execute on function public.admin_set_customer_blocked(uuid, boolean) to authenticated;


-- ===========================================================================
-- >>> 20261122150000_harden_public_product_view_and_table_grants.sql
-- ===========================================================================
-- Keep public product browsing, but ensure the view applies the caller's RLS.
ALTER VIEW public.public_products SET (security_invoker = true);

-- Remove broad table privileges. RLS remains responsible for row-level admin writes.
REVOKE ALL PRIVILEGES ON TABLE public.products FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.products FROM authenticated;

GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;


-- ===========================================================================
-- >>> 20261122151000_split_public_and_admin_product_read_policies.sql
-- ===========================================================================
DROP POLICY IF EXISTS "products: public read" ON public.products;

CREATE POLICY "products: public active read"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active);

CREATE POLICY "products: admin read all"
ON public.products
FOR SELECT
TO authenticated
USING (public.is_admin());


-- ===========================================================================
-- >>> 20261122152000_prevent_self_or_staff_blocking_from_customer_manager.sql
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_customer_blocked(_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if _user_id = auth.uid() then
    raise exception 'You cannot block or unblock your own account here.' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.user_roles
     where user_id = _user_id
       and role in ('admin', 'staff')
  ) then
    raise exception 'Administrator and staff accounts cannot be blocked through customer management.' using errcode = '42501';
  end if;

  update public.profiles
     set is_blocked = _blocked,
         updated_at = now()
   where id = _user_id;

  if not found then
    raise exception 'Customer profile not found' using errcode = 'P0002';
  end if;
end;
$function$;


-- ===========================================================================
-- >>> 20261122153000_enforce_blocked_customer_order_and_payment_activity.sql
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.reject_blocked_customer_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid;
  v_email text;
begin
  -- Admins may continue to process or correct customer orders and payments.
  if auth.uid() is not null and public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'orders' then
    v_user_id := new.user_id;
    v_email := new.customer_email;
  else
    select o.user_id, o.customer_email
      into v_user_id, v_email
      from public.orders o
     where o.id = new.order_id;
  end if;

  if v_user_id is not null and exists (
    select 1 from public.profiles p
     where p.id = v_user_id and p.is_blocked
  ) then
    raise exception 'This account is blocked from customer order activity.' using errcode = '42501';
  end if;

  if v_email is not null and exists (
    select 1 from public.profiles p
     where lower(trim(p.email)) = lower(trim(v_email))
       and p.is_blocked
  ) then
    raise exception 'This email belongs to a blocked customer account.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.reject_blocked_customer_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reject_blocked_customer_orders ON public.orders;
CREATE TRIGGER reject_blocked_customer_orders
BEFORE INSERT OR UPDATE OF user_id, customer_email
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.reject_blocked_customer_activity();

DROP TRIGGER IF EXISTS reject_blocked_customer_payments ON public.payments;
CREATE TRIGGER reject_blocked_customer_payments
BEFORE INSERT OR UPDATE OF order_id, method, transaction_id, status
ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.reject_blocked_customer_activity();


-- ===========================================================================
-- >>> 20261122154000_deny_blocked_accounts_customer_data_and_guest_order_access.sql
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.is_customer_blocked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((
    SELECT p.is_blocked
      FROM public.profiles p
     WHERE p.id = auth.uid()
  ), false);
$function$;

REVOKE ALL ON FUNCTION public.is_customer_blocked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_customer_blocked() TO authenticated;

DROP POLICY IF EXISTS "orders: read own" ON public.orders;
CREATE POLICY "orders: read own" ON public.orders
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "order_items: read own" ON public.order_items;
CREATE POLICY "order_items: read own" ON public.order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id = (SELECT auth.uid())
  )
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "history: read own" ON public.order_status_history;
CREATE POLICY "history: read own" ON public.order_status_history
FOR SELECT TO authenticated
USING (
  NOT is_internal
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.user_id = (SELECT auth.uid())
  )
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "payments: read own" ON public.payments;
CREATE POLICY "payments: read own" ON public.payments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id
      AND o.user_id = (SELECT auth.uid())
  )
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "profiles: read own" ON public.profiles;
CREATE POLICY "profiles: read own" ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own" ON public.profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()) AND NOT public.is_customer_blocked())
WITH CHECK (id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "reviews: insert own" ON public.reviews;
CREATE POLICY "reviews: insert own" ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND is_approved = false
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "support: read own" ON public.support_messages;
CREATE POLICY "support: read own" ON public.support_messages
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "roles: read own" ON public.user_roles;
CREATE POLICY "roles: read own" ON public.user_roles
FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()) OR public.is_admin())
  AND NOT public.is_customer_blocked()
);

CREATE OR REPLACE FUNCTION public.get_order(_order_number text, _access_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order public.orders;
  v_items jsonb;
  v_payment jsonb;
  v_history jsonb;
begin
  select * into v_order
    from public.orders
   where order_number = upper(trim(_order_number));

  if not found then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if not (
    public.is_admin()
    or (v_order.user_id is not null and v_order.user_id = auth.uid())
    or (v_order.user_id is null and v_order.access_token = _access_token)
  ) then
    raise exception 'Order not found.' using errcode = '42501';
  end if;

  if not public.is_admin() and (
    (v_order.user_id is not null and exists (
      select 1 from public.profiles p
      where p.id = v_order.user_id and p.is_blocked
    ))
    or (v_order.user_id is null and exists (
      select 1 from public.profiles p
      where lower(trim(p.email)) = lower(trim(v_order.customer_email))
        and p.is_blocked
    ))
  ) then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
    into v_items from public.order_items i where i.order_id = v_order.id;

  select to_jsonb(p) - 'admin_note' into v_payment
    from public.payments p where p.order_id = v_order.id
    order by p.created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'note', h.note, 'created_at', h.created_at)
                            order by h.created_at), '[]'::jsonb)
    into v_history from public.order_status_history h
   where h.order_id = v_order.id and h.is_internal = false;

  return jsonb_build_object(
    'order', (to_jsonb(v_order) - 'access_token'),
    'items', v_items,
    'payment', v_payment,
    'history', v_history
  );
end;
$function$;


-- ===========================================================================
-- >>> 20261122155000_deny_blocked_accounts_guest_order_claim.sql
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.claim_guest_order(_order_number text, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order public.orders;
  v_verified_email text;
  v_email_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;

  if public.is_customer_blocked() then
    raise exception 'This account is blocked from claiming guest orders.' using errcode = '42501';
  end if;

  select lower(trim(email)), email_confirmed_at
    into v_verified_email, v_email_confirmed_at
    from auth.users
   where id = auth.uid();

  if v_email_confirmed_at is null or v_verified_email is null then
    raise exception 'Verify your account email before claiming an order.' using errcode = '42501';
  end if;

  if v_verified_email <> lower(trim(coalesce(_email, ''))) then
    raise exception 'Use the verified email address on your account.' using errcode = '42501';
  end if;

  select * into v_order
    from public.orders
   where upper(order_number) = upper(trim(_order_number))
     and lower(customer_email) = v_verified_email
     and user_id is null
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No matching guest order found.');
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(trim(p.email)) = v_verified_email
      and p.is_blocked
  ) then
    raise exception 'This account is blocked from claiming guest orders.' using errcode = '42501';
  end if;

  update public.orders set user_id = auth.uid() where id = v_order.id;

  insert into public.payments (order_id, method, amount)
  select v_order.id, v_order.payment_method, v_order.total
  where not exists (select 1 from public.payments where order_id = v_order.id);

  return jsonb_build_object('ok', true, 'order_number', v_order.order_number);
end;
$function$;


-- ===========================================================================
-- >>> 20261122160000_split_anon_public_read_policies_from_admin_checks.sql
-- ===========================================================================
-- Avoid invoking SECURITY DEFINER is_admin() from anonymous SELECT policies.
-- Existing authenticated admin ALL policies continue to grant admins full reads.

DROP POLICY IF EXISTS "categories: public read" ON public.categories;
CREATE POLICY "categories: active public read"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "faqs: public read" ON public.faqs;
CREATE POLICY "faqs: active public read"
  ON public.faqs FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "payment_methods: public read" ON public.payment_methods;
CREATE POLICY "payment_methods: active public read"
  ON public.payment_methods FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "promotions: public read" ON public.promotions;
CREATE POLICY "promotions: active public read"
  ON public.promotions FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "reviews: public read" ON public.reviews;
CREATE POLICY "reviews: approved public read"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (is_approved);

DROP POLICY IF EXISTS "settings: public read" ON public.website_settings;
CREATE POLICY "settings: public read"
  ON public.website_settings FOR SELECT TO anon, authenticated
  USING (is_public);


-- ===========================================================================
-- >>> 20261122161000_restrict_anon_product_select_columns_hide_admin_notes.sql
-- ===========================================================================
-- Keep the internal admin_note column private from anonymous storefront access.
-- The security_invoker public_products view still has SELECT on its public columns.
REVOKE SELECT ON TABLE public.products FROM anon;
GRANT SELECT (
  id, category_id, name, slug, brand, short_description, description,
  image_url, gallery, duration, original_price, discounted_price,
  delivery_info, delivery_time, availability, is_featured, is_active,
  badge, rating, rating_count, sales_count, sort_order, created_at,
  updated_at, new_user_offer_enabled
) ON TABLE public.products TO anon;


-- ===========================================================================
-- >>> 20261122162000_revoke_anon_direct_access_to_customer_and_admin_tables.sql
-- ===========================================================================
-- Guest checkout and account/order retrieval use validated RPCs.
-- Anonymous clients should not have direct table privileges for customer,
-- payment, role, notification, coupon, or admin-audit data.
REVOKE ALL ON TABLE
  public.admin_audit_log,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.payments,
  public.profiles,
  public.user_roles,
  public.notifications,
  public.coupons
FROM anon;


-- ===========================================================================
-- >>> 20261122165000_enforce_admin_order_payment_state_machine.sql
-- ===========================================================================
-- Enforce the order/payment state machine in trusted database functions.
-- Admin clients may edit only the internal order note directly; status and
-- payment fields must pass through the audited RPCs below.

REVOKE UPDATE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT UPDATE (admin_note) ON TABLE public.orders TO authenticated;
REVOKE UPDATE ON TABLE public.payments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  _order_id uuid,
  _status public.order_status,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders;
  v_note text := nullif(trim(coalesce(_note, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING errcode = '42501';
  END IF;

  IF _status IS NULL THEN
    RAISE EXCEPTION 'A target order status is required.' USING errcode = 'P0001';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'Status note is too long (maximum 500 characters).' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  IF _status = 'payment_verified' THEN
    RAISE EXCEPTION 'Use payment verification to set Payment Verified.' USING errcode = 'P0001';
  END IF;

  IF v_order.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Cancelled or refunded orders cannot be changed.' USING errcode = 'P0001';
  ELSIF v_order.status = 'pending_payment' THEN
    IF _status <> 'cancelled' THEN
      RAISE EXCEPTION 'A pending order can only be cancelled before payment submission.' USING errcode = 'P0001';
    END IF;
  ELSIF v_order.status = 'payment_submitted' THEN
    IF _status <> 'cancelled' THEN
      RAISE EXCEPTION 'Verify or reject the submitted payment before changing the order status.' USING errcode = 'P0001';
    END IF;
    UPDATE public.payments
       SET status = 'rejected',
           admin_note = coalesce(v_note, 'Order cancelled by admin'),
           verified_by = NULL,
           verified_at = NULL
     WHERE order_id = _order_id
       AND status = 'submitted';
  ELSIF v_order.status = 'payment_verified' THEN
    IF _status NOT IN ('processing', 'refunded') THEN
      RAISE EXCEPTION 'A verified order can move to Processing or Refunded.' USING errcode = 'P0001';
    END IF;
  ELSIF v_order.status = 'processing' THEN
    IF _status NOT IN ('completed', 'refunded') THEN
      RAISE EXCEPTION 'A processing order can move to Completed or Refunded.' USING errcode = 'P0001';
    END IF;
    IF _status = 'completed' AND NOT EXISTS (
      SELECT 1 FROM public.payments
       WHERE order_id = _order_id AND status = 'verified'
    ) THEN
      RAISE EXCEPTION 'An order cannot be completed without a verified payment.' USING errcode = 'P0001';
    END IF;
  ELSIF v_order.status = 'completed' THEN
    IF _status <> 'refunded' THEN
      RAISE EXCEPTION 'A completed order can only move to Refunded.' USING errcode = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported order status transition.' USING errcode = 'P0001';
  END IF;

  UPDATE public.orders SET status = _status WHERE id = _order_id;

  INSERT INTO public.order_status_history (order_id, status, note, changed_by)
  VALUES (_order_id, _status, v_note, auth.uid());

  INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(), 'update_status', 'orders', _order_id::text,
    jsonb_build_object('from', v_order.status, 'to', _status, 'note', v_note)
  );

  RETURN jsonb_build_object('ok', true, 'status', _status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_verify_payment(
  _payment_id uuid,
  _decision public.payment_status,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.payments;
  v_order public.orders;
  v_note text := nullif(trim(coalesce(_note, '')), '');
  v_next_order_status public.order_status;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING errcode = '42501';
  END IF;

  IF _decision IS NULL OR _decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be verified or rejected.' USING errcode = 'P0001';
  END IF;

  IF _decision = 'rejected' AND v_note IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required.' USING errcode = 'P0001';
  END IF;

  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'Verification note is too long (maximum 500 characters).' USING errcode = 'P0001';
  END IF;

  -- Read the parent id, then lock order before payment. Checkout uses the
  -- same lock order, preventing concurrent submit/verify races and deadlocks.
  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE id = v_payment.order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE id = _payment_id AND order_id = v_order.id
   FOR UPDATE;

  IF NOT FOUND OR v_payment.status <> 'submitted'
     OR v_order.status <> 'payment_submitted' THEN
    RAISE EXCEPTION 'Only a currently submitted payment can be verified or rejected.' USING errcode = 'P0001';
  END IF;

  v_next_order_status := CASE
    WHEN _decision = 'verified' THEN 'payment_verified'::public.order_status
    ELSE 'pending_payment'::public.order_status
  END;

  UPDATE public.payments
     SET status = _decision,
         admin_note = v_note,
         verified_by = CASE WHEN _decision = 'verified' THEN auth.uid() ELSE NULL END,
         verified_at = CASE WHEN _decision = 'verified' THEN now() ELSE NULL END
   WHERE id = _payment_id;

  UPDATE public.orders SET status = v_next_order_status WHERE id = v_order.id;

  INSERT INTO public.order_status_history (order_id, status, note, changed_by)
  VALUES (
    v_order.id,
    v_next_order_status,
    CASE WHEN _decision = 'verified'
      THEN coalesce(v_note, 'Payment verified by admin')
      ELSE 'Payment rejected: ' || v_note
    END,
    auth.uid()
  );

  INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(), 'verify_payment', 'payments', _payment_id::text,
    jsonb_build_object('decision', _decision, 'note', v_note)
  );

  RETURN jsonb_build_object('ok', true, 'status', _decision);
END;
$function$;


-- ===========================================================================
-- >>> 20261122170000_prevent_duplicate_payment_transaction_ids.sql
-- ===========================================================================
-- Prevent one provider transaction reference from paying multiple orders.
-- The expression index is the final concurrency-safe guard; the RPC check
-- below returns a readable validation error before the index is reached.

CREATE UNIQUE INDEX IF NOT EXISTS payments_unique_method_transaction_id
ON public.payments (method, upper(btrim(transaction_id)))
WHERE transaction_id IS NOT NULL AND btrim(transaction_id) <> '';

CREATE OR REPLACE FUNCTION public.submit_payment(
  _order_number text,
  _access_token uuid,
  _method public.payment_method,
  _transaction_id text,
  _sender_number text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _proof_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders;
  v_payment public.payments;
  v_sender text;
  v_proof text;
BEGIN
  SELECT * INTO v_order
    FROM public.orders
   WHERE order_number = upper(trim(_order_number))
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  IF NOT (
    public.is_admin()
    OR (v_order.user_id IS NOT NULL AND v_order.user_id = auth.uid())
    OR (v_order.user_id IS NULL AND v_order.access_token = _access_token)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to update this order.' USING errcode = '42501';
  END IF;

  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Payment for this order has already been submitted.' USING errcode = 'P0001';
  END IF;

  IF coalesce(trim(_transaction_id), '') !~ '^[A-Za-z0-9-]{4,40}$' THEN
    RAISE EXCEPTION 'Please enter a valid transaction ID (4–40 letters/numbers).' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_methods
     WHERE method = _method::text AND is_active = true
  ) THEN
    RAISE EXCEPTION 'This payment method is currently unavailable.' USING errcode = 'P0001';
  END IF;

  IF _amount IS NOT NULL AND round(_amount, 2) <> round(v_order.total, 2) THEN
    RAISE EXCEPTION 'Payment amount must match the order total.' USING errcode = 'P0001';
  END IF;

  v_sender := nullif(trim(_sender_number), '');
  IF v_sender IS NOT NULL AND (length(v_sender) < 5 OR length(v_sender) > 24
      OR v_sender !~ '^[0-9+ -]+$') THEN
    RAISE EXCEPTION 'Please enter a valid sender number.' USING errcode = 'P0001';
  END IF;

  v_proof := nullif(trim(_proof_url), '');
  IF v_proof IS NOT NULL AND (
      length(v_proof) > 2048
      OR left(v_proof, length('https://vxorwxecyfhuzzgtyowy.supabase.co/storage/v1/object/public/payment-proofs/'))
         <> 'https://vxorwxecyfhuzzgtyowy.supabase.co/storage/v1/object/public/payment-proofs/'
  ) THEN
    RAISE EXCEPTION 'Payment proof must be uploaded through the NEXORA payment form.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE order_id = v_order.id
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payments (order_id, method, amount)
    VALUES (v_order.id, _method, v_order.total)
    RETURNING * INTO v_payment;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.payments p
     WHERE p.id <> v_payment.id
       AND p.method = _method
       AND upper(btrim(p.transaction_id)) = upper(btrim(_transaction_id))
       AND p.transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END IF;

  BEGIN
    UPDATE public.payments
       SET method = _method,
           transaction_id = upper(trim(_transaction_id)),
           sender_number = v_sender,
           amount = v_order.total,
           proof_url = coalesce(v_proof, proof_url),
           status = 'submitted'
     WHERE id = v_payment.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END;

  UPDATE public.orders
     SET status = 'payment_submitted',
         payment_method = _method
   WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'payment_submitted',
    'message', 'Payment submitted. Our team will verify it shortly.'
  );
END;
$function$;


-- ===========================================================================
-- >>> 20261122173000_audit_customer_block_actions.sql
-- ===========================================================================
-- Record every customer block/unblock action and protect privileged accounts.
CREATE OR REPLACE FUNCTION public.admin_set_customer_blocked(_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_previous boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING errcode = '28000';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING errcode = '42501';
  END IF;
  IF _user_id IS NULL OR _blocked IS NULL THEN
    RAISE EXCEPTION 'A customer and block status are required.' USING errcode = '22023';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot block or unblock your own account here.' USING errcode = '42501';
  END IF;

  SELECT is_blocked INTO v_previous
    FROM public.profiles
   WHERE id = _user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile not found.' USING errcode = 'P0002';
  END IF;

  PERFORM 1 FROM public.user_roles
   WHERE user_id = _user_id AND role IN ('admin', 'staff')
   FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'Administrator and staff accounts cannot be blocked through customer management.' USING errcode = '42501';
  END IF;

  UPDATE public.profiles
     SET is_blocked = _blocked,
         updated_at = now()
   WHERE id = _user_id;

  IF v_previous IS DISTINCT FROM _blocked THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
    VALUES (
      auth.uid(),
      CASE WHEN _blocked THEN 'block_customer' ELSE 'unblock_customer' END,
      'profiles',
      _user_id::text,
      jsonb_build_object('previous_is_blocked', v_previous, 'is_blocked', _blocked)
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_customer_blocked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_blocked(uuid, boolean) TO authenticated;


-- ===========================================================================
-- >>> 20261122180000_align_private_payment_proof_paths.sql
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.submit_payment(
  _order_number text,
  _access_token uuid,
  _method public.payment_method,
  _transaction_id text,
  _sender_number text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _proof_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders;
  v_payment public.payments;
  v_sender text;
  v_proof text;
BEGIN
  SELECT * INTO v_order
    FROM public.orders
   WHERE order_number = upper(trim(_order_number))
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  IF NOT (
    public.is_admin()
    OR (v_order.user_id IS NOT NULL AND v_order.user_id = auth.uid())
    OR (v_order.user_id IS NULL AND v_order.access_token = _access_token)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to update this order.' USING errcode = '42501';
  END IF;

  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Payment for this order has already been submitted.' USING errcode = 'P0001';
  END IF;

  IF coalesce(trim(_transaction_id), '') !~ '^[A-Za-z0-9-]{4,40}$' THEN
    RAISE EXCEPTION 'Please enter a valid transaction ID (4–40 letters/numbers).' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_methods
     WHERE method = _method::text AND is_active = true
  ) THEN
    RAISE EXCEPTION 'This payment method is currently unavailable.' USING errcode = 'P0001';
  END IF;

  IF _amount IS NOT NULL AND round(_amount, 2) <> round(v_order.total, 2) THEN
    RAISE EXCEPTION 'Payment amount must match the order total.' USING errcode = 'P0001';
  END IF;

  v_sender := nullif(trim(_sender_number), '');
  IF v_sender IS NOT NULL AND (
    length(v_sender) < 5 OR length(v_sender) > 24 OR v_sender !~ '^[0-9+ -]+$'
  ) THEN
    RAISE EXCEPTION 'Please enter a valid sender number.' USING errcode = 'P0001';
  END IF;

  -- The bucket is private. Store only the object path, scoped to this order.
  -- The Storage RLS policy separately verifies that the caller may upload
  -- into this order's folder; the admin panel creates short-lived signed URLs.
  v_proof := nullif(trim(_proof_url), '');
  IF v_proof IS NOT NULL AND (
    length(v_proof) > 160
    OR v_proof !~ '^[A-Za-z0-9-]{4,40}/[0-9]{10,16}\.(jpg|jpeg|png|webp|pdf)$'
    OR upper(split_part(v_proof, '/', 1)) <> upper(v_order.order_number)
    OR position('..' in v_proof) > 0
  ) THEN
    RAISE EXCEPTION 'Payment proof must be uploaded to this order through the NEXORA payment form.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE order_id = v_order.id
   ORDER BY created_at LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payments (order_id, method, amount)
    VALUES (v_order.id, _method, v_order.total)
    RETURNING * INTO v_payment;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
     WHERE p.id <> v_payment.id
       AND p.method = _method
       AND upper(btrim(p.transaction_id)) = upper(btrim(_transaction_id))
       AND p.transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END IF;

  BEGIN
    UPDATE public.payments
       SET method = _method,
           transaction_id = upper(trim(_transaction_id)),
           sender_number = v_sender,
           amount = v_order.total,
           proof_url = coalesce(v_proof, proof_url),
           status = 'submitted'
     WHERE id = v_payment.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END;

  UPDATE public.orders
     SET status = 'payment_submitted',
         payment_method = _method
   WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'payment_submitted',
    'message', 'Payment submitted. Our team will verify it shortly.'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_payment(text, uuid, public.payment_method, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment(text, uuid, public.payment_method, text, text, numeric, text) TO anon, authenticated, service_role;


-- ===========================================================================
-- >>> 20261122182000_fix_payment_proof_filename_regex.sql
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.submit_payment(
  _order_number text,
  _access_token uuid,
  _method public.payment_method,
  _transaction_id text,
  _sender_number text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _proof_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders;
  v_payment public.payments;
  v_sender text;
  v_proof text;
BEGIN
  SELECT * INTO v_order
    FROM public.orders
   WHERE order_number = upper(trim(_order_number))
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  IF NOT (
    public.is_admin()
    OR (v_order.user_id IS NOT NULL AND v_order.user_id = auth.uid())
    OR (v_order.user_id IS NULL AND v_order.access_token = _access_token)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to update this order.' USING errcode = '42501';
  END IF;

  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Payment for this order has already been submitted.' USING errcode = 'P0001';
  END IF;

  IF coalesce(trim(_transaction_id), '') !~ '^[A-Za-z0-9-]{4,40}$' THEN
    RAISE EXCEPTION 'Please enter a valid transaction ID (4–40 letters/numbers).' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_methods
     WHERE method = _method::text AND is_active = true
  ) THEN
    RAISE EXCEPTION 'This payment method is currently unavailable.' USING errcode = 'P0001';
  END IF;

  IF _amount IS NOT NULL AND round(_amount, 2) <> round(v_order.total, 2) THEN
    RAISE EXCEPTION 'Payment amount must match the order total.' USING errcode = 'P0001';
  END IF;

  v_sender := nullif(trim(_sender_number), '');
  IF v_sender IS NOT NULL AND (
    length(v_sender) < 5 OR length(v_sender) > 24 OR v_sender !~ '^[0-9+ -]+$'
  ) THEN
    RAISE EXCEPTION 'Please enter a valid sender number.' USING errcode = 'P0001';
  END IF;

  -- Match the private Storage policy's exact object naming convention.
  v_proof := nullif(trim(_proof_url), '');
  IF v_proof IS NOT NULL AND (
    length(v_proof) > 160
    OR v_proof !~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}[.](jpg|jpeg|png|webp|pdf)$'
    OR upper(split_part(v_proof, '/', 1)) <> upper(v_order.order_number)
    OR position('..' in v_proof) > 0
  ) THEN
    RAISE EXCEPTION 'Payment proof must be uploaded to this order through the NEXORA payment form.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE order_id = v_order.id
   ORDER BY created_at LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payments (order_id, method, amount)
    VALUES (v_order.id, _method, v_order.total)
    RETURNING * INTO v_payment;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
     WHERE p.id <> v_payment.id
       AND p.method = _method
       AND upper(btrim(p.transaction_id)) = upper(btrim(_transaction_id))
       AND p.transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END IF;

  BEGIN
    UPDATE public.payments
       SET method = _method,
           transaction_id = upper(trim(_transaction_id)),
           sender_number = v_sender,
           amount = v_order.total,
           proof_url = coalesce(v_proof, proof_url),
           status = 'submitted'
     WHERE id = v_payment.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END;

  UPDATE public.orders
     SET status = 'payment_submitted',
         payment_method = _method
   WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'payment_submitted',
    'message', 'Payment submitted. Our team will verify it shortly.'
  );
END;
$function$;

DROP POLICY IF EXISTS "payment proofs: bounded order upload" ON storage.objects;
CREATE POLICY "payment proofs: bounded order upload"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND name ~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}[.](jpg|jpeg|png|webp|pdf)$'
  AND coalesce((metadata ->> 'size')::bigint, 0) BETWEEN 1 AND 5242880
  AND (metadata ->> 'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  AND EXISTS (
    SELECT 1
      FROM public.orders o
     WHERE o.order_number = split_part(objects.name, '/', 1)
       AND o.status IN ('pending_payment', 'payment_submitted')
       AND (o.user_id IS NULL OR o.user_id = auth.uid() OR public.is_admin())
  )
);

REVOKE ALL ON FUNCTION public.submit_payment(text, uuid, public.payment_method, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment(text, uuid, public.payment_method, text, text, numeric, text) TO anon, authenticated, service_role;


-- ===========================================================================
-- >>> 20261122185000_index_admin_password_setup_token_user_fk.sql
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_admin_password_setup_tokens_user_id
  ON public.admin_password_setup_tokens (user_id);

-- ===========================================================================
-- >>> 20261122191000_validate_payment_proof_object_exists.sql
-- ===========================================================================
-- Ensure submitted payment proof points to an existing object in the private bucket.
CREATE OR REPLACE FUNCTION public.assert_payment_proof_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_number text;
  v_path text;
BEGIN
  v_path := nullif(trim(NEW.proof_url), '');
  IF v_path IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.order_number
    INTO v_order_number
    FROM public.orders o
   WHERE o.id = NEW.order_id;

  IF NOT FOUND OR v_path !~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}[.](jpg|jpeg|png|webp|pdf)$'
     OR split_part(v_path, '/', 1) <> v_order_number THEN
    RAISE EXCEPTION 'Payment proof path is invalid for this order.' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM storage.objects so
     WHERE so.bucket_id = 'payment-proofs'
       AND so.name = v_path
  ) THEN
    RAISE EXCEPTION 'Payment proof file was not uploaded or is no longer available.' USING errcode = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_payment_proof_exists() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assert_payment_proof_exists ON public.payments;
CREATE TRIGGER assert_payment_proof_exists
BEFORE INSERT OR UPDATE OF proof_url ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.assert_payment_proof_exists();

-- >>> 20261122200000_restrict_guest_payment_proof_uploads.sql
-- Guest order access tokens cannot be validated by Storage RLS.
-- Limit direct uploads to signed-in order owners and admins. Guest customers
-- can still submit transaction details without attaching a screenshot.
DROP POLICY IF EXISTS "payment proofs: bounded order upload" ON storage.objects;
CREATE POLICY "payment proofs: authenticated owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND name ~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}[.](jpg|jpeg|png|webp|pdf)$'
  AND coalesce((metadata ->> 'size')::bigint, 0) BETWEEN 1 AND 5242880
  AND (metadata ->> 'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  AND EXISTS (
    SELECT 1
      FROM public.orders o
     WHERE o.order_number = split_part(objects.name, '/', 1)
       AND o.status IN ('pending_payment', 'payment_submitted')
       AND (o.user_id = (SELECT auth.uid()) OR public.is_admin())
  )
);


-- ===========================================================================
-- >>> 20261125230000_arcade_wallet_foundation.sql
-- ===========================================================================
-- ===========================================================================
-- NEXORA · Arcade foundation: game catalogue, secure coin wallet, first-login
-- reward. Cash withdrawals are intentionally not enabled in this migration.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.arcade_games (
  slug text PRIMARY KEY,
  title text NOT NULL,
  genre text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arcade_game_levels (
  game_slug text NOT NULL REFERENCES public.arcade_games(slug) ON DELETE CASCADE,
  level_number integer NOT NULL CHECK (level_number BETWEEN 1 AND 20),
  reward_coins integer NOT NULL CHECK (reward_coins BETWEEN 0 AND 10000),
  PRIMARY KEY (game_slug, level_number)
);

CREATE TABLE IF NOT EXISTS public.arcade_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_balance bigint NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  lifetime_earned bigint NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arcade_coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount <> 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('first_login', 'level_reward', 'subscription_redemption', 'admin_adjustment')),
  source_key text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_arcade_ledger_user_created
  ON public.arcade_coin_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.arcade_game_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug text NOT NULL REFERENCES public.arcade_games(slug) ON DELETE CASCADE,
  highest_level integer NOT NULL DEFAULT 0 CHECK (highest_level BETWEEN 0 AND 20),
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_slug)
);

ALTER TABLE public.arcade_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_game_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arcade games: public read" ON public.arcade_games;
CREATE POLICY "arcade games: public read" ON public.arcade_games
  FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "arcade games: admin manage" ON public.arcade_games;
CREATE POLICY "arcade games: admin manage" ON public.arcade_games
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "arcade levels: public read" ON public.arcade_game_levels;
CREATE POLICY "arcade levels: public read" ON public.arcade_game_levels
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.arcade_games g WHERE g.slug = game_slug AND (g.is_active OR public.is_admin()))
  );

DROP POLICY IF EXISTS "arcade levels: admin manage" ON public.arcade_game_levels;
CREATE POLICY "arcade levels: admin manage" ON public.arcade_game_levels
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "arcade wallet: owner or admin read" ON public.arcade_wallets;
CREATE POLICY "arcade wallet: owner or admin read" ON public.arcade_wallets
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "arcade ledger: owner or admin read" ON public.arcade_coin_ledger;
CREATE POLICY "arcade ledger: owner or admin read" ON public.arcade_coin_ledger
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "arcade progress: owner or admin read" ON public.arcade_game_progress;
CREATE POLICY "arcade progress: owner or admin read" ON public.arcade_game_progress
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "arcade progress: owner update" ON public.arcade_game_progress;
CREATE POLICY "arcade progress: owner update" ON public.arcade_game_progress
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT ON public.arcade_games, public.arcade_game_levels TO anon, authenticated;
GRANT SELECT ON public.arcade_wallets, public.arcade_coin_ledger, public.arcade_game_progress TO authenticated;
GRANT UPDATE ON public.arcade_game_progress TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.arcade_games, public.arcade_game_levels TO authenticated;

INSERT INTO public.arcade_games (slug, title, genre, description, is_active, sort_order) VALUES
('neon-memory','Neon Memory','Puzzle','Remember the pattern and repeat it as rounds get faster.',true,1),
('shadow-escape','Shadow Escape','Horror','Explore a mysterious abandoned place and find the exit.',false,2),
('tower-guard','Tower Guard','Tower Defense','Protect your base from waves of incoming enemies.',false,3),
('star-pilot','Star Pilot','Space Action','Pilot through a cosmic field of hazards.',false,4),
('turbo-circuit','Turbo Circuit','Racing','Race against time on a neon track.',false,5),
('dungeon-quest','Dungeon Quest','Adventure','Explore rooms, collect keys and uncover secrets.',false,6),
('mountain-climb','Mountain Climb','Platformer','Jump across platforms and reach the summit.',false,7),
('zombie-holdout','Zombie Holdout','Survival','Survive increasingly difficult waves.',false,8),
('mystery-rooms','Mystery Rooms','Mystery','Solve clues to unlock the next room.',false,9),
('battle-blocks','Battle Blocks','Arcade','Dodge, react and beat your best score.',false,10),
('city-builder','City Builder','City Simulator','Build a thriving city one block at a time.',false,11),
('farm-life','Farm Life','Farm Simulator','Plant, harvest and grow your small farm.',false,12),
('cafe-manager','Cafe Manager','Business Simulator','Run a cafe and keep customers happy.',false,13),
('treasure-trail','Treasure Trail','Treasure Hunt','Follow clues and find hidden treasure.',false,14),
('endless-runner','Endless Runner','Runner','Keep moving, dodge obstacles and collect stars.',false,15),
('deep-sea','Deep Sea','Exploration','Discover an underwater world and its secrets.',false,16),
('tactical-grid','Tactical Grid','Strategy','Plan each move on a compact tactical board.',false,17),
('alien-outpost','Alien Outpost','Sci-Fi','Defend a remote outpost from strange visitors.',false,18),
('parkour-rush','Parkour Rush','Action','Chain jumps and slides through an obstacle course.',false,19),
('logic-lab','Logic Lab','Brain Game','Solve quick logic challenges and unlock harder puzzles.',false,20)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, genre = EXCLUDED.genre, description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.arcade_game_levels (game_slug, level_number, reward_coins)
SELECT g.slug, level_no, level_no + 1
FROM public.arcade_games g
CROSS JOIN generate_series(1, 20) AS level_no
ON CONFLICT (game_slug, level_number) DO UPDATE SET reward_coins = EXCLUDED.reward_coins;

CREATE OR REPLACE FUNCTION public.arcade_claim_first_login_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_inserted uuid;
  v_balance bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in to claim your welcome coins.' USING errcode = '28000';
  END IF;

  INSERT INTO public.arcade_wallets (user_id) VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.arcade_wallets WHERE user_id = v_user FOR UPDATE;

  INSERT INTO public.arcade_coin_ledger (user_id, amount, transaction_type, source_key, description)
  VALUES (v_user, 10, 'first_login', 'welcome:first-login', 'Welcome to NEXORA Arcade')
  ON CONFLICT (user_id, source_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    UPDATE public.arcade_wallets
       SET coin_balance = coin_balance + 10,
           lifetime_earned = lifetime_earned + 10,
           updated_at = now()
     WHERE user_id = v_user;
  END IF;

  SELECT coin_balance INTO v_balance FROM public.arcade_wallets WHERE user_id = v_user;
  RETURN jsonb_build_object(
    'rewarded', v_inserted IS NOT NULL,
    'coins_awarded', CASE WHEN v_inserted IS NOT NULL THEN 10 ELSE 0 END,
    'coin_balance', v_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.arcade_claim_first_login_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arcade_claim_first_login_reward() TO authenticated;
