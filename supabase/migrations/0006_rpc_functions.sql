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
