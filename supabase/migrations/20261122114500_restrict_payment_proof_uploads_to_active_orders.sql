-- Guest checkout still needs to upload payment evidence before submitting payment.
-- Restrict the public insert policy to a valid, existing pending order and bounded file metadata.
drop policy if exists "payment proofs: anyone upload" on storage.objects;

create policy "payment proofs: bounded order upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'payment-proofs'
  and name ~ '^NX-[0-9]{6}-[0-9]{5}/[0-9]{13}\.(jpg|jpeg|png|webp|pdf)$'
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880
  and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp','application/pdf')
  and exists (
    select 1
      from public.orders o
     where o.order_number = split_part(name, '/', 1)
       and o.status in ('pending_payment','payment_submitted')
       and (
         o.user_id is null
         or o.user_id = auth.uid()
         or public.is_admin()
       )
  )
);
