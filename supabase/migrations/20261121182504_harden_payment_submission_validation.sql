-- NEXORA: validate payment submissions server-side and serialize concurrent updates.
create or replace function public.submit_payment(
  _order_number text,
  _access_token uuid,
  _method public.payment_method,
  _transaction_id text,
  _sender_number text default null,
  _amount numeric default null,
  _proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order public.orders;
  v_payment public.payments;
  v_sender text;
  v_proof text;
begin
  select * into v_order
    from public.orders
   where order_number = upper(trim(_order_number))
   for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if not (
    public.is_admin()
    or (v_order.user_id is not null and v_order.user_id = auth.uid())
    or (v_order.user_id is null and v_order.access_token = _access_token)
  ) then
    raise exception 'You are not allowed to update this order.' using errcode = '42501';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Payment for this order has already been submitted.' using errcode = 'P0001';
  end if;

  if coalesce(trim(_transaction_id), '') !~ '^[A-Za-z0-9-]{4,40}$' then
    raise exception 'Please enter a valid transaction ID (4–40 letters/numbers).' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.payment_methods
     where method = _method and is_active = true
  ) then
    raise exception 'This payment method is currently unavailable.' using errcode = 'P0001';
  end if;

  if _amount is not null and round(_amount, 2) <> round(v_order.total, 2) then
    raise exception 'Payment amount must match the order total.' using errcode = 'P0001';
  end if;

  v_sender := nullif(trim(_sender_number), '');
  if v_sender is not null and (length(v_sender) < 5 or length(v_sender) > 24
      or v_sender !~ '^[0-9+ -]+$') then
    raise exception 'Please enter a valid sender number.' using errcode = 'P0001';
  end if;

  v_proof := nullif(trim(_proof_url), '');
  if v_proof is not null and (
      length(v_proof) > 2048
      or left(v_proof, length('https://vxorwxecyfhuzzgtyowy.supabase.co/storage/v1/object/public/payment-proofs/'))
         <> 'https://vxorwxecyfhuzzgtyowy.supabase.co/storage/v1/object/public/payment-proofs/'
  ) then
    raise exception 'Payment proof must be uploaded through the NEXORA payment form.' using errcode = 'P0001';
  end if;

  select * into v_payment
    from public.payments
   where order_id = v_order.id
   order by created_at
   limit 1
   for update;

  if not found then
    insert into public.payments (order_id, method, amount)
    values (v_order.id, _method, v_order.total)
    returning * into v_payment;
  end if;

  update public.payments
     set method = _method,
         transaction_id = upper(trim(_transaction_id)),
         sender_number = v_sender,
         amount = v_order.total,
         proof_url = coalesce(v_proof, proof_url),
         status = 'submitted'
   where id = v_payment.id;

  update public.orders
     set status = 'payment_submitted',
         payment_method = _method
   where id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'payment_submitted',
    'message', 'Payment submitted. Our team will verify it shortly.'
  );
end;
$function$;
