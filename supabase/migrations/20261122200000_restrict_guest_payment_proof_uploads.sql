-- Guest order access tokens cannot be validated by Storage RLS.
-- Limit direct uploads to signed-in order owners and admins. Guest customers
-- can still submit transaction details without attaching a screenshot.
DROP POLICY IF EXISTS "payment proofs: bounded order upload" ON storage.objects;
CREATE POLICY "payment proofs: authenticated owner upload"
ON storage.objects
FOR INSERT
TO authenticated
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
       AND (o.user_id = (SELECT auth.uid()) OR public.is_admin())
  )
);
