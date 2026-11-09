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
