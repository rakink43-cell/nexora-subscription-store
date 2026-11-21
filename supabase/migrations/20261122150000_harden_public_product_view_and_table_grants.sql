-- Keep public product browsing, but ensure the view applies the caller's RLS.
ALTER VIEW public.public_products SET (security_invoker = true);

-- Remove broad table privileges. RLS remains responsible for row-level admin writes.
REVOKE ALL PRIVILEGES ON TABLE public.products FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.products FROM authenticated;

GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
