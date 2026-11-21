create or replace function public.claim_guest_order(_order_number text, _email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order public.orders;
  v_verified_email text;
  v_email_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;

  -- Claiming a guest order is an ownership transfer. Require a verified account
  -- email matching both the submitted email and the order's customer email.
  select lower(trim(email)), email_confirmed_at
    into v_verified_email, v_email_confirmed_at
    from auth.users
   where id = auth.uid();

  if v_email_confirmed_at is null or v_verified_email is null then
    raise exception 'Verify your account email before claiming an order.' using errcode = '42501';
  end if;

  if v_verified_email <> lower(trim(coalesce(_email, ''))) then
    raise exception 'Use the verified email address on your account.' using errcode = '42501';
  end if;

  select * into v_order
    from public.orders
   where upper(order_number) = upper(trim(_order_number))
     and lower(customer_email) = v_verified_email
     and user_id is null
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No matching guest order found.');
  end if;

  update public.orders set user_id = auth.uid() where id = v_order.id;

  insert into public.payments (order_id, method, amount)
  select v_order.id, v_order.payment_method, v_order.total
  where not exists (select 1 from public.payments where order_id = v_order.id);

  return jsonb_build_object('ok', true, 'order_number', v_order.order_number);
end;
$function$;
