-- Enforce the order/payment state machine in trusted database functions.
-- Admin clients may edit only the internal order note directly; status and
-- payment fields must pass through the audited RPCs below.

REVOKE UPDATE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT UPDATE (admin_note) ON TABLE public.orders TO authenticated;
REVOKE UPDATE ON TABLE public.payments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  _order_id uuid,
  _status public.order_status,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders;
  v_note text := nullif(trim(coalesce(_note, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING errcode = '42501';
  END IF;

  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'Status note is too long (maximum 500 characters).' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  IF _status = 'payment_verified' THEN
    RAISE EXCEPTION 'Use payment verification to set Payment Verified.' USING errcode = 'P0001';
  END IF;

  IF v_order.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Cancelled or refunded orders cannot be changed.' USING errcode = 'P0001';
  ELSIF v_order.status = 'pending_payment' THEN
    IF _status <> 'cancelled' THEN
      RAISE EXCEPTION 'A pending order can only be cancelled before payment submission.' USING errcode = 'P0001';
    END IF;
  ELSIF v_order.status = 'payment_submitted' THEN
    IF _status <> 'cancelled' THEN
      RAISE EXCEPTION 'Verify or reject the submitted payment before changing the order status.' USING errcode = 'P0001';
    END IF;
    UPDATE public.payments
       SET status = 'rejected',
           admin_note = coalesce(v_note, 'Order cancelled by admin'),
           verified_by = NULL,
           verified_at = NULL
     WHERE order_id = _order_id
       AND status = 'submitted';
  ELSIF v_order.status = 'payment_verified' THEN
    IF _status NOT IN ('processing', 'refunded') THEN
      RAISE EXCEPTION 'A verified order can move to Processing or Refunded.' USING errcode = 'P0001';
    END IF;
  ELSIF v_order.status = 'processing' THEN
    IF _status NOT IN ('completed', 'refunded') THEN
      RAISE EXCEPTION 'A processing order can move to Completed or Refunded.' USING errcode = 'P0001';
    END IF;
    IF _status = 'completed' AND NOT EXISTS (
      SELECT 1 FROM public.payments
       WHERE order_id = _order_id AND status = 'verified'
    ) THEN
      RAISE EXCEPTION 'An order cannot be completed without a verified payment.' USING errcode = 'P0001';
    END IF;
  ELSIF v_order.status = 'completed' THEN
    IF _status <> 'refunded' THEN
      RAISE EXCEPTION 'A completed order can only move to Refunded.' USING errcode = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported order status transition.' USING errcode = 'P0001';
  END IF;

  UPDATE public.orders SET status = _status WHERE id = _order_id;

  INSERT INTO public.order_status_history (order_id, status, note, changed_by)
  VALUES (_order_id, _status, v_note, auth.uid());

  INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(), 'update_status', 'orders', _order_id::text,
    jsonb_build_object('from', v_order.status, 'to', _status, 'note', v_note)
  );

  RETURN jsonb_build_object('ok', true, 'status', _status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_verify_payment(
  _payment_id uuid,
  _decision public.payment_status,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.payments;
  v_order public.orders;
  v_note text := nullif(trim(coalesce(_note, '')), '');
  v_next_order_status public.order_status;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING errcode = '42501';
  END IF;

  IF _decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be verified or rejected.' USING errcode = 'P0001';
  END IF;

  IF _decision = 'rejected' AND v_note IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required.' USING errcode = 'P0001';
  END IF;

  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'Verification note is too long (maximum 500 characters).' USING errcode = 'P0001';
  END IF;

  -- Read the parent id, then lock order before payment. Checkout uses the
  -- same lock order, preventing concurrent submit/verify races and deadlocks.
  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE id = v_payment.order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE id = _payment_id AND order_id = v_order.id
   FOR UPDATE;

  IF NOT FOUND OR v_payment.status <> 'submitted'
     OR v_order.status <> 'payment_submitted' THEN
    RAISE EXCEPTION 'Only a currently submitted payment can be verified or rejected.' USING errcode = 'P0001';
  END IF;

  v_next_order_status := CASE
    WHEN _decision = 'verified' THEN 'payment_verified'::public.order_status
    ELSE 'pending_payment'::public.order_status
  END;

  UPDATE public.payments
     SET status = _decision,
         admin_note = v_note,
         verified_by = CASE WHEN _decision = 'verified' THEN auth.uid() ELSE NULL END,
         verified_at = CASE WHEN _decision = 'verified' THEN now() ELSE NULL END
   WHERE id = _payment_id;

  UPDATE public.orders SET status = v_next_order_status WHERE id = v_order.id;

  INSERT INTO public.order_status_history (order_id, status, note, changed_by)
  VALUES (
    v_order.id,
    v_next_order_status,
    CASE WHEN _decision = 'verified'
      THEN coalesce(v_note, 'Payment verified by admin')
      ELSE 'Payment rejected: ' || v_note
    END,
    auth.uid()
  );

  INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(), 'verify_payment', 'payments', _payment_id::text,
    jsonb_build_object('decision', _decision, 'note', v_note)
  );

  RETURN jsonb_build_object('ok', true, 'status', _decision);
END;
$function$;
