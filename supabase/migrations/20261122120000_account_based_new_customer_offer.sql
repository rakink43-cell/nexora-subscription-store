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
