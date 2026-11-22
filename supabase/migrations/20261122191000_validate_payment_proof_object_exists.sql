-- Ensure submitted payment proof points to an existing object in the private bucket.
CREATE OR REPLACE FUNCTION public.assert_payment_proof_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_number text;
  v_path text;
BEGIN
  v_path := nullif(trim(NEW.proof_url), '');
  IF v_path IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.order_number
    INTO v_order_number
    FROM public.orders o
   WHERE o.id = NEW.order_id;

  IF NOT FOUND OR v_path !~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}[.](jpg|jpeg|png|webp|pdf)$'
     OR split_part(v_path, '/', 1) <> v_order_number THEN
    RAISE EXCEPTION 'Payment proof path is invalid for this order.' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM storage.objects so
     WHERE so.bucket_id = 'payment-proofs'
       AND so.name = v_path
  ) THEN
    RAISE EXCEPTION 'Payment proof file was not uploaded or is no longer available.' USING errcode = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_payment_proof_exists() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assert_payment_proof_exists ON public.payments;
CREATE TRIGGER assert_payment_proof_exists
BEFORE INSERT OR UPDATE OF proof_url ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.assert_payment_proof_exists();
