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
