DROP POLICY IF EXISTS "products: public read" ON public.products;

CREATE POLICY "products: public active read"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active);

CREATE POLICY "products: admin read all"
ON public.products
FOR SELECT
TO authenticated
USING (public.is_admin());
