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
