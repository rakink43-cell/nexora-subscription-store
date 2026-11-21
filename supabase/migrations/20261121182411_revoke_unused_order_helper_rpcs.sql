-- These helper RPCs are not called by the storefront or RLS policies.
-- lookup_guest_order returned the guest access token from order number + email,
-- so leaving it callable would allow token disclosure.
revoke all on function public.lookup_guest_order(text, text) from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.can_access_order(public.orders) from public, anon, authenticated;
