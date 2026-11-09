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
