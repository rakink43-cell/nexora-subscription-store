-- Keep customer-editable fields separate from the admin-only block flag.
revoke update (is_blocked) on table public.profiles from authenticated;
grant update (full_name, phone, address, city)
  on table public.profiles to authenticated;

create or replace function public.admin_set_customer_blocked(_user_id uuid, _blocked boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  update public.profiles
     set is_blocked = _blocked,
         updated_at = now()
   where id = _user_id;
  if not found then
    raise exception 'Customer profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_customer_blocked(uuid, boolean) from public;
revoke all on function public.admin_set_customer_blocked(uuid, boolean) from anon;
grant execute on function public.admin_set_customer_blocked(uuid, boolean) to authenticated;
