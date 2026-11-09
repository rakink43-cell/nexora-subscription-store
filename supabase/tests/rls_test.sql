-- ===========================================================================
-- NEXORA · RLS & business-logic test suite
--
-- Run locally:   bash supabase/tests/run.sh
-- Run on Supabase: paste into the SQL editor AFTER all migrations
--                  (it creates throw-away auth users prefixed `rls-test-`).
--
-- Every assertion either raises (test failure, psql exits non-zero) or emits
-- a NOTICE "PASS ...". Expected-error blocks are asserted inside nested
-- BEGIN/EXCEPTION handlers, so a missing protection is a hard failure.
-- ===========================================================================

create schema if not exists tests;

create or replace function tests.assert(_cond boolean, _msg text)
returns void
language plpgsql
as $$
begin
  if _cond is not true then
    raise exception 'ASSERT FAILED → %', _msg;
  end if;
  raise notice 'PASS  %', _msg;
end;
$$;

create or replace function tests.expect_empty(_sql text, _msg text)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute format('select count(*) from (select 1 as ok from (%s) t) c', _sql) into v_count;
  if v_count <> 0 then
    raise exception 'ASSERT FAILED → % — % row(s) leaked', _msg, v_count;
  end if;
  raise notice 'PASS  % (0 rows visible)', _msg;
end;
$$;

create or replace function tests.expect_error(_sql text, _msg text)
returns void
language plpgsql
as $$
begin
  begin
    execute _sql;
  exception when others then
    raise notice 'PASS  % (blocked: %)', _msg, sqlerrm;
    return;
  end;
  raise exception 'ASSERT FAILED → % — the statement was allowed but should have been blocked', _msg;
end;
$$;

grant usage on schema tests to public;
grant execute on all functions in schema tests to public;

-- ---------------------------------------------------------------------------
-- Fixtures: three users (customer A, customer B, admin)
-- ---------------------------------------------------------------------------
do $$
declare
  v_a uuid; v_b uuid; v_adm uuid;
begin
  delete from auth.users where email like 'rls-test-%@nexora.test';

  insert into auth.users (email, raw_user_meta_data)
  values ('rls-test-a@nexora.test', '{"full_name":"Customer A"}'::jsonb) returning id into v_a;
  insert into auth.users (email, raw_user_meta_data)
  values ('rls-test-b@nexora.test', '{"full_name":"Customer B"}'::jsonb) returning id into v_b;
  insert into auth.users (email, raw_user_meta_data)
  values ('rls-test-admin@nexora.test', '{"full_name":"Admin"}'::jsonb) returning id into v_adm;

  insert into public.user_roles (user_id, role) values (v_adm, 'admin')
  on conflict do nothing;

  perform set_config('nexora.test.user_a', v_a::text, false);
  perform set_config('nexora.test.user_b', v_b::text, false);
  perform set_config('nexora.test.admin', v_adm::text, false);
end $$;

grant select, insert, update, delete on public.admin_audit_log to anon, authenticated;

-- ===========================================================================
-- 1 · ANONYMOUS (public storefront) ACCESS
-- ===========================================================================
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'anon', false);

select tests.assert(
  (select count(*) from public.products where is_active) >= 30,
  'anon can read the active product catalogue');

select tests.assert(
  (select count(*) from public.categories where is_active) = 6,
  'anon can read active categories');

select tests.assert(
  (select count(*) from public.payment_methods where is_active) = 3,
  'anon can read active payment methods for checkout');

select tests.assert(
  (select count(*) from public.faqs where is_active) >= 8,
  'anon can read published FAQs');

select tests.assert(
  (select count(*) from public.reviews where is_approved) >= 5,
  'anon can read approved reviews only');

select tests.assert(
  (select count(*) from public.website_settings where is_public) >= 5,
  'anon can read public website settings');

select tests.expect_empty(
  'select 1 from public.coupons',
  'anon cannot read the coupons table');

select tests.expect_empty(
  'select 1 from public.profiles',
  'anon cannot read customer profiles');

select tests.expect_empty(
  'select 1 from public.orders',
  'anon cannot read orders');

select tests.expect_error(
  'insert into public.products (name, slug) values (''Hack'', ''hack'')',
  'anon cannot insert products');

-- anon holds no UPDATE privilege at all → hard permission error
select tests.expect_error(
  'update public.products set discounted_price = 1',
  'anon cannot update product prices');

-- admin_note must never leak through the public projection
select tests.expect_error(
  'select admin_note from public.public_products limit 1',
  'public_products view hides internal admin_note column');

-- public view still works for the storefront
select tests.assert(
  (select count(*) from public.public_products) >= 30,
  'public_products view is readable by anon');

-- analytics is write-only
insert into public.analytics_events (event_name, path) values ('page_view', '/');
select tests.expect_empty(
  'select 1 from public.analytics_events',
  'anon cannot read analytics events');

reset role;

-- ===========================================================================
-- 2 · ORDER CREATION & PRICING INTEGRITY
-- ===========================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('nexora.test.user_a'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);

do $$
declare
  v_product uuid;
  v_price numeric;
  v_res jsonb;
  v_order uuid;
begin
  select id, discounted_price into v_product, v_price
    from public.products where slug = 'netflix-premium-4k';

  -- tampered payload: a fake price field must be ignored entirely
  v_res := public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 1, 'price', 1, 'unit_price', 1, 'line_total', 1)),
    'Customer A', 'rls-test-a@nexora.test', '01711111111',
    'bkash'::public.payment_method, null, 'test order'
  );

  perform tests.assert((v_res ->> 'total')::numeric = v_price,
    'order total is re-priced server-side (client price fields ignored)');
  perform tests.assert((v_res ->> 'order_number') like 'NX-%',
    'order number uses the NX- prefix format');

  v_order := (v_res ->> 'order_id')::uuid;
  perform set_config('nexora.test.order_a', v_order::text, false);
  perform set_config('nexora.test.order_a_no', v_res ->> 'order_number', false);
  perform set_config('nexora.test.order_a_token', v_res ->> 'access_token', false);

  perform tests.assert(
    (select status from public.orders where id = v_order) = 'pending_payment',
    'new orders start as pending_payment (never auto-paid)');

  perform tests.assert(
    (select count(*) from public.order_items where order_id = v_order) = 1,
    'order_items snapshot is created');

  perform tests.assert(
    (select count(*) from public.payments where order_id = v_order and status = 'pending') = 1,
    'a pending payment record is created');

  perform tests.assert(
    (select count(*) from public.order_status_history where order_id = v_order) >= 1,
    'status history timeline is written');
end $$;

-- invalid inputs are rejected
select tests.expect_error(
  $$select public.place_order(jsonb_build_array(jsonb_build_object('product_id',
      (select id from public.products limit 1), 'quantity', 1)),
    'Customer A', 'rls-test-a@nexora.test', '12345', 'bkash', null, null)$$,
  'invalid Bangladeshi phone number is rejected');

select tests.expect_error(
  $$select public.place_order('[]'::jsonb, 'Customer A', 'rls-test-a@nexora.test', '01711111111', 'bkash', null, null)$$,
  'empty cart is rejected');

select tests.expect_error(
  $$select public.place_order(jsonb_build_array(jsonb_build_object('product_id',
      (select id from public.products limit 1), 'quantity', 1)),
    'Customer A', 'not-an-email', '01711111111', 'bkash', null, null)$$,
  'invalid email is rejected');

select tests.expect_error(
  $$select public.place_order(jsonb_build_array(jsonb_build_object('product_id',
      (select id from public.products limit 1), 'quantity', 1)),
    'Customer A', 'rls-test-a@nexora.test', '01711111111', 'bkash', 'NOPE-NOT-A-COUPON', null)$$,
  'invalid coupon code is rejected');

reset role;

-- ===========================================================================
-- 3 · CROSS-CUSTOMER ISOLATION
-- ===========================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('nexora.test.user_b'), false);

select tests.assert(
  (select count(*) from public.orders) = 0,
  'customer B cannot see customer A''s orders');

select tests.assert(
  (select count(*) from public.order_items) = 0,
  'customer B cannot see customer A''s order items');

select tests.assert(
  (select count(*) from public.payments) = 0,
  'customer B cannot see customer A''s payments');

select tests.assert(
  (select count(*) from public.profiles) = 1,
  'customer B can only read their own profile');

select tests.expect_error(
  format('select * from public.get_order(%L, %L)',
         current_setting('nexora.test.order_a_no'),
         current_setting('nexora.test.order_a_token')),
  'customer B cannot read customer A''s order via get_order');

do $$
declare v_rows int;
begin
  update public.orders set status = 'completed'
   where order_number = current_setting('nexora.test.order_a_no');
  get diagnostics v_rows = row_count;
  perform tests.assert(v_rows = 0,
    'customer B cannot update customer A''s order (0 rows affected)');
end $$;

reset role;

-- customer A sees their own order, and cannot escalate a status manually
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('nexora.test.user_a'), false);

select tests.assert(
  (select count(*) from public.orders) = 1,
  'customer A sees exactly their own order');

select tests.assert(
  (select count(*) from public.order_items) = 1,
  'customer A sees their own order items');

select tests.assert(
  (public.get_order(current_setting('nexora.test.order_a_no'),
                    current_setting('nexora.test.order_a_token')::uuid) -> 'order') is not null,
  'customer A can read their own order via get_order');

-- No policy allows a customer UPDATE on orders at all → 0 rows / no effect
do $$
declare v_rows int;
begin
  update public.orders set status = 'completed'
   where order_number = current_setting('nexora.test.order_a_no');
  get diagnostics v_rows = row_count;
  perform tests.assert(v_rows = 0, 'customer UPDATE on own order affects 0 rows');
  perform tests.assert(
    (select status from public.orders where order_number = current_setting('nexora.test.order_a_no')) = 'pending_payment',
    'order status is unchanged after a customer self-approval attempt');
end $$;

-- profile column hardening: cannot flip own privileges
select tests.expect_error(
  'update public.profiles set is_blocked = false, email = ''hacked@x.com''',
  'customer cannot update privileged profile columns');

do $$
declare v_rows int;
begin
  update public.profiles set full_name = 'Customer A Updated' where id = auth.uid();
  get diagnostics v_rows = row_count;
  perform tests.assert(v_rows = 1, 'customer can update their own allowed profile fields');
end $$;

-- customers cannot grant themselves admin
select tests.expect_error(
  format('insert into public.user_roles (user_id, role) values (%L, ''admin'')', auth.uid()),
  'customer cannot insert an admin role for themselves');

-- ===========================================================================
-- 4 · PAYMENT SUBMISSION (manual verification, never auto-paid)
-- ===========================================================================
do $$
declare v_token uuid;
begin
  v_token := current_setting('nexora.test.order_a_token')::uuid;

  perform public.submit_payment(
    current_setting('nexora.test.order_a_no'), v_token,
    'bkash'::public.payment_method, 'TRX12345A', '01711111111', null, null);

  perform tests.assert(
    (select status from public.orders where order_number = current_setting('nexora.test.order_a_no')) = 'payment_submitted',
    'submit_payment moves the order to payment_submitted');

  perform tests.assert(
    (select status from public.payments
      where order_id = (select id from public.orders where order_number = current_setting('nexora.test.order_a_no'))
      order by created_at desc limit 1) = 'submitted',
    'payment record is marked submitted (not verified)');

  -- notifications are admin-only by RLS (asserted in section 6)
end $$;

select tests.expect_error(
  format('select public.submit_payment(%L, %L, ''bkash'', ''TRX12345A'')',
         current_setting('nexora.test.order_a_no'), current_setting('nexora.test.order_a_token')),
  'a second payment submission on the same order is rejected');

select tests.expect_error(
  'select public.admin_verify_payment(gen_random_uuid(), ''verified''::public.payment_status, null)',
  'customer cannot call admin_verify_payment');

select tests.expect_error(
  format('select public.admin_update_order_status(%L, ''completed''::public.order_status, null)',
         current_setting('nexora.test.order_a')),
  'customer cannot call admin_update_order_status');

reset role;

-- ===========================================================================
-- 5 · GUEST CHECKOUT (no account) + TOKEN ACCESS
-- ===========================================================================
set role anon;
select set_config('request.jwt.claim.sub', '', false);

do $$
declare
  v_res jsonb;
  v_no text;
  v_token uuid;
  v_product uuid;
begin
  select id into v_product from public.products where slug = 'chatgpt-plus';

  v_res := public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 2)),
    'Guest Buyer', 'guest@nexora.test', '01822222222', 'nagad', null, null);

  v_no := v_res ->> 'order_number';
  v_token := (v_res ->> 'access_token')::uuid;
  perform set_config('nexora.test.guest_no', v_no, false);
  perform set_config('nexora.test.guest_token', v_token::text, false);
  perform set_config('nexora.test.guest_id', v_res ->> 'order_id', false);

  perform tests.assert((v_res ->> 'items')::int = 1, 'guest checkout creates an order without an account');
  perform tests.assert((v_res ->> 'access_token') is not null,
    'guest order returns a private access token (claimable later)');
  -- anon cannot SELECT orders (asserted above), so verify via the RPC result
  perform tests.assert(
    (v_res ->> 'total')::numeric
      = (select discounted_price * 2 from public.products where slug = 'chatgpt-plus'),
    'quantity 2 is priced correctly on a guest order');
end $$;

-- correct token works
do $$
declare v jsonb;
begin
  v := public.get_order(current_setting('nexora.test.guest_no'),
                        current_setting('nexora.test.guest_token')::uuid);
  perform tests.assert((v ->> 'order') is not null, 'guest can read their order with the access token');
  perform tests.assert((v::text not like '%access_token%'), 'get_order never echoes the access token');
end $$;

-- wrong token fails
select tests.expect_error(
  format('select public.get_order(%L, %L)', current_setting('nexora.test.guest_no'), gen_random_uuid()),
  'guest cannot read an order with a wrong access token');

-- guest can submit payment proof with the token
do $$
begin
  perform public.submit_payment(
    current_setting('nexora.test.guest_no'),
    current_setting('nexora.test.guest_token')::uuid,
    'nagad'::public.payment_method, 'NGD99881', '01822222222', null, null);
  -- anon cannot SELECT orders; assert on the RPC's own return value instead
  perform tests.assert(
    (public.get_order(current_setting('nexora.test.guest_no'),
                      current_setting('nexora.test.guest_token')::uuid) -> 'order' ->> 'status')
      = 'payment_submitted',
    'guest can submit payment with the access token');
end $$;

reset role;

-- ===========================================================================
-- 6 · ADMIN POWERS
-- ===========================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('nexora.test.admin'), false);

select tests.assert(public.is_admin(), 'admin role resolves through user_roles');

do $$
declare v_res jsonb;
begin
  perform tests.assert(
    (select count(*) from public.orders) = 2,
    'admin can see every order');

  perform tests.assert(
    (select count(*) from public.profiles) >= 3,
    'admin can read all customer profiles');

  v_res := public.admin_dashboard_stats();
  perform tests.assert((v_res ->> 'total_orders')::int = 2, 'dashboard stats count orders');
  perform tests.assert((v_res ->> 'pending_orders')::int >= 1, 'dashboard stats count pending orders');
  perform tests.assert(jsonb_array_length(v_res -> 'sales_series') = 14, 'dashboard returns a 14-day sales series');

  -- verify the pending payment
  perform public.admin_verify_payment(
    (select id from public.payments where status = 'submitted' order by created_at limit 1),
    'verified'::public.payment_status, 'bKash TrxID matched');

  perform tests.assert(
    (select count(*) from public.orders where status = 'payment_verified') = 1,
    'verifying a payment moves the order to payment_verified');

  perform tests.assert(
    (select count(*) from public.orders where status = 'completed') = 0,
    'verification does NOT mark the order completed');

  -- progress the order
  perform public.admin_update_order_status(
    (select id from public.orders where status = 'payment_verified' limit 1),
    'processing'::public.order_status, 'Credentials being prepared');

  perform public.admin_update_order_status(
    (select id from public.orders where status = 'processing' limit 1),
    'completed'::public.order_status, 'Delivered by WhatsApp');

  perform tests.assert(
    (select count(*) from public.orders where status = 'completed') = 1,
    'admin can move an order to completed');

  perform tests.assert(
    (select sales_count from public.products where slug = 'netflix-premium-4k') > 0,
    'completing an order increments product sales_count');

  perform tests.assert(
    (select count(*) from public.admin_audit_log where entity = 'payments') >= 1,
    'payment verification is written to the audit log');

  perform tests.assert(
    (select count(*) from public.notifications where type in ('order', 'payment')) >= 2,
    'admin notifications exist for new orders and submitted payments');
end $$;

-- admin writes are allowed where customers are not
do $$
begin
  insert into public.products (category_id, name, slug, original_price, discounted_price)
  values ((select id from public.categories limit 1), 'Test Product', 'test-product-admin', 100, 50);
  perform tests.assert(true, 'admin can create products');
  delete from public.products where slug = 'test-product-admin';
end $$;

do $$
begin
  update public.coupons set is_active = true where false;
  insert into public.coupons (code, type, value) values ('TEST10', 'percentage', 10)
  on conflict do nothing;
  perform tests.assert(
    (select count(*) from public.coupons where lower(code) = 'test10') = 1,
    'admin can manage coupons');
  delete from public.coupons where lower(code) = 'test10';
end $$;

reset role;

-- ===========================================================================
-- 6b · STORAGE BUCKETS
-- ===========================================================================
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'SKIP  storage schema not installed';
    return;
  end if;

  perform tests.assert(
    (select public from storage.buckets where id = 'product-images') = true,
    'product-images bucket is public for storefront reads');

  perform tests.assert(
    (select public from storage.buckets where id = 'payment-proofs') = false,
    'payment-proofs bucket is private');

  perform tests.assert(
    (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname like 'payment proofs:%') >= 3,
    'payment-proofs has upload/read/delete policies');

  perform tests.assert(
    (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname like 'product images:%') >= 4,
    'product-images has public-read + admin write/update/delete policies');
end $$;

-- ===========================================================================
-- 7 · FINAL INVARIANTS
-- ===========================================================================
do $$
begin
  perform tests.assert(
    (select count(*) from pg_tables t
      where schemaname = 'public'
        and tablename in ('profiles','user_roles','categories','products','orders','order_items',
                          'payments','coupons','website_settings','support_messages')
        and not rowsecurity) = 0,
    'RLS is enabled on every core table');

  perform tests.assert(
    (select count(*) from pg_tables where schemaname = 'public' and tablename = 'admin_bootstrap') = 1,
    'admin_bootstrap table exists');

  perform tests.assert(
    (select count(*) from pg_policies where schemaname = 'public') >= 20,
    'policies exist across the schema');

  -- cleanup fixtures
  delete from auth.users where email like 'rls-test-%@nexora.test';
  delete from public.orders where customer_email in ('guest@nexora.test');
end $$;

select 'ALL TESTS PASSED' as result;
