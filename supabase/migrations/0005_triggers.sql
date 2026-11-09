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
