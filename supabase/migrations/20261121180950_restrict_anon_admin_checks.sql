-- NEXORA live hardening: admin authorization checks require a signed-in role.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
