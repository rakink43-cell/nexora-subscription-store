-- ===========================================================================
-- NEXORA · 0009 — Storage buckets & policies
--
-- product-images : PUBLIC read (catalogue imagery), admin-only writes
-- payment-proofs : PRIVATE (transaction screenshots), write-only uploads for
--                  customers, read restricted to administrators via signed URLs
--
-- Safe to run on a plain PostgreSQL (no storage schema) — it skips quietly.
-- ===========================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Storage schema not present — skipping bucket setup (run on Supabase).';
    return;
  end if;

  -- ---------------------------------------------------------------- buckets
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'product-images', 'product-images', true, 4194304,
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = true,
        file_size_limit = 4194304,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'payment-proofs', 'payment-proofs', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = 5242880,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  -- ------------------------------------------------- product-images policies
  drop policy if exists "product images: public read"  on storage.objects;
  drop policy if exists "product images: admin write"  on storage.objects;
  drop policy if exists "product images: admin update" on storage.objects;
  drop policy if exists "product images: admin delete" on storage.objects;

  create policy "product images: public read" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'product-images');

  create policy "product images: admin write" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'product-images' and public.is_admin());

  create policy "product images: admin update" on storage.objects
    for update to authenticated
    using (bucket_id = 'product-images' and public.is_admin())
    with check (bucket_id = 'product-images' and public.is_admin());

  create policy "product images: admin delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'product-images' and public.is_admin());

  -- ------------------------------------------------- payment-proofs policies
  drop policy if exists "payment proofs: anyone upload" on storage.objects;
  drop policy if exists "payment proofs: admin read"    on storage.objects;
  drop policy if exists "payment proofs: admin delete"  on storage.objects;

  -- Customers (and guests) may upload a proof, but never list or read others.
  create policy "payment proofs: anyone upload" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'payment-proofs');

  create policy "payment proofs: admin read" on storage.objects
    for select to authenticated
    using (bucket_id = 'payment-proofs' and public.is_admin());

  create policy "payment proofs: admin delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'payment-proofs' and public.is_admin());

  raise notice 'NEXORA storage buckets and policies configured.';
end $$;
