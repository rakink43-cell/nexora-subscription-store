-- Restore only the profile columns used by the customer profile editor and admin block toggle.
-- RLS policies continue to restrict customers to their own row and admins to permitted rows.
grant update (full_name, phone, address, city, is_blocked)
  on table public.profiles to authenticated;
