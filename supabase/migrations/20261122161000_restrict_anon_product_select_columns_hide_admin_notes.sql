-- Keep the internal admin_note column private from anonymous storefront access.
-- The security_invoker public_products view still has SELECT on its public columns.
REVOKE SELECT ON TABLE public.products FROM anon;
GRANT SELECT (
  id, category_id, name, slug, brand, short_description, description,
  image_url, gallery, duration, original_price, discounted_price,
  delivery_info, delivery_time, availability, is_featured, is_active,
  badge, rating, rating_count, sales_count, sort_order, created_at,
  updated_at, new_user_offer_enabled
) ON TABLE public.products TO anon;
