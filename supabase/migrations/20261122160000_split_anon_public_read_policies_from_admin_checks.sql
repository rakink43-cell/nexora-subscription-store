-- Avoid invoking SECURITY DEFINER is_admin() from anonymous SELECT policies.
-- Existing authenticated admin ALL policies continue to grant admins full reads.

DROP POLICY IF EXISTS "categories: public read" ON public.categories;
CREATE POLICY "categories: active public read"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "faqs: public read" ON public.faqs;
CREATE POLICY "faqs: active public read"
  ON public.faqs FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "payment_methods: public read" ON public.payment_methods;
CREATE POLICY "payment_methods: active public read"
  ON public.payment_methods FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "promotions: public read" ON public.promotions;
CREATE POLICY "promotions: active public read"
  ON public.promotions FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "reviews: public read" ON public.reviews;
CREATE POLICY "reviews: approved public read"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (is_approved);

DROP POLICY IF EXISTS "settings: public read" ON public.website_settings;
CREATE POLICY "settings: public read"
  ON public.website_settings FOR SELECT TO anon, authenticated
  USING (is_public);
