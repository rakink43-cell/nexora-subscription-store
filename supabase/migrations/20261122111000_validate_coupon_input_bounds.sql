create or replace function public.validate_coupon(_code text, _subtotal numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  c public.coupons;
  v_discount numeric := 0;
  v_code text;
begin
  v_code := trim(coalesce(_code, ''));

  if length(v_code) = 0 or length(v_code) > 64 then
    return jsonb_build_object('valid', false, 'message', 'Please enter a valid coupon code.');
  end if;

  if _subtotal is null or _subtotal < 0 or _subtotal > 100000000
     or _subtotal::text in ('NaN', 'Infinity', '-Infinity') then
    return jsonb_build_object('valid', false, 'message', 'Order subtotal is invalid.');
  end if;

  select * into c from public.coupons
   where lower(code) = lower(v_code) and is_active = true;

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
$function$;
