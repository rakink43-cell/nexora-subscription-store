CREATE OR REPLACE FUNCTION public.admin_set_customer_blocked(_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if _user_id = auth.uid() then
    raise exception 'You cannot block or unblock your own account here.' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.user_roles
     where user_id = _user_id
       and role in ('admin', 'staff')
  ) then
    raise exception 'Administrator and staff accounts cannot be blocked through customer management.' using errcode = '42501';
  end if;

  update public.profiles
     set is_blocked = _blocked,
         updated_at = now()
   where id = _user_id;

  if not found then
    raise exception 'Customer profile not found' using errcode = 'P0002';
  end if;
end;
$function$;
