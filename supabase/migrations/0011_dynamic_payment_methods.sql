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