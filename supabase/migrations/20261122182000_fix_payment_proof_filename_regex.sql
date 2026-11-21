CREATE OR REPLACE FUNCTION public.submit_payment(
  _order_number text,
  _access_token uuid,
  _method public.payment_method,
  _transaction_id text,
  _sender_number text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _proof_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders;
  v_payment public.payments;
  v_sender text;
  v_proof text;
BEGIN
  SELECT * INTO v_order
    FROM public.orders
   WHERE order_number = upper(trim(_order_number))
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  IF NOT (
    public.is_admin()
    OR (v_order.user_id IS NOT NULL AND v_order.user_id = auth.uid())
    OR (v_order.user_id IS NULL AND v_order.access_token = _access_token)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to update this order.' USING errcode = '42501';
  END IF;

  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Payment for this order has already been submitted.' USING errcode = 'P0001';
  END IF;

  IF coalesce(trim(_transaction_id), '') !~ '^[A-Za-z0-9-]{4,40}$' THEN
    RAISE EXCEPTION 'Please enter a valid transaction ID (4–40 letters/numbers).' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_methods
     WHERE method = _method::text AND is_active = true
  ) THEN
    RAISE EXCEPTION 'This payment method is currently unavailable.' USING errcode = 'P0001';
  END IF;

  IF _amount IS NOT NULL AND round(_amount, 2) <> round(v_order.total, 2) THEN
    RAISE EXCEPTION 'Payment amount must match the order total.' USING errcode = 'P0001';
  END IF;

  v_sender := nullif(trim(_sender_number), '');
  IF v_sender IS NOT NULL AND (
    length(v_sender) < 5 OR length(v_sender) > 24 OR v_sender !~ '^[0-9+ -]+$'
  ) THEN
    RAISE EXCEPTION 'Please enter a valid sender number.' USING errcode = 'P0001';
  END IF;

  -- Match the private Storage policy's exact object naming convention.
  v_proof := nullif(trim(_proof_url), '');
  IF v_proof IS NOT NULL AND (
    length(v_proof) > 160
    OR v_proof !~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}[.](jpg|jpeg|png|webp|pdf)$'
    OR upper(split_part(v_proof, '/', 1)) <> upper(v_order.order_number)
    OR position('..' in v_proof) > 0
  ) THEN
    RAISE EXCEPTION 'Payment proof must be uploaded to this order through the NEXORA payment form.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE order_id = v_order.id
   ORDER BY created_at LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payments (order_id, method, amount)
    VALUES (v_order.id, _method, v_order.total)
    RETURNING * INTO v_payment;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
     WHERE p.id <> v_payment.id
       AND p.method = _method
       AND upper(btrim(p.transaction_id)) = upper(btrim(_transaction_id))
       AND p.transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END IF;

  BEGIN
    UPDATE public.payments
       SET method = _method,
           transaction_id = upper(trim(_transaction_id)),
           sender_number = v_sender,
           amount = v_order.total,
           proof_url = coalesce(v_proof, proof_url),
           status = 'submitted'
     WHERE id = v_payment.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This transaction ID has already been used for this payment method.' USING errcode = 'P0001';
  END;

  UPDATE public.orders
     SET status = 'payment_submitted',
         payment_method = _method
   WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'payment_submitted',
    'message', 'Payment submitted. Our team will verify it shortly.'
  );
END;
$function$;

DROP POLICY IF EXISTS "payment proofs: bounded order upload" ON storage.objects;
CREATE POLICY "payment proofs: bounded order upload"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND name ~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}[.](jpg|jpeg|png|webp|pdf)$'
  AND coalesce((metadata ->> 'size')::bigint, 0) BETWEEN 1 AND 5242880
  AND (metadata ->> 'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  AND EXISTS (
    SELECT 1
      FROM public.orders o
     WHERE o.order_number = split_part(objects.name, '/', 1)
       AND o.status IN ('pending_payment', 'payment_submitted')
       AND (o.user_id IS NULL OR o.user_id = auth.uid() OR public.is_admin())
  )
);

REVOKE ALL ON FUNCTION public.submit_payment(text, uuid, public.payment_method, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment(text, uuid, public.payment_method, text, text, numeric, text) TO anon, authenticated, service_role;
