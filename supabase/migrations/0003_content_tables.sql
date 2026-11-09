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
