-- NEXORA live hardening: bootstrap_admin is not a public setup endpoint.
revoke all on function public.bootstrap_admin(text, text) from public, anon, authenticated;
