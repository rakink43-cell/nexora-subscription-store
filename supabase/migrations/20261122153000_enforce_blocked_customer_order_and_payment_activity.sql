CREATE OR REPLACE FUNCTION public.reject_blocked_customer_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid;
  v_email text;
begin
  -- Admins may continue to process or correct customer orders and payments.
  if auth.uid() is not null and public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'orders' then
    v_user_id := new.user_id;
    v_email := new.customer_email;
  else
    select o.user_id, o.customer_email
      into v_user_id, v_email
      from public.orders o
     where o.id = new.order_id;
  end if;

  if v_user_id is not null and exists (
    select 1 from public.profiles p
     where p.id = v_user_id and p.is_blocked
  ) then
    raise exception 'This account is blocked from customer order activity.' using errcode = '42501';
  end if;

  if v_email is not null and exists (
    select 1 from public.profiles p
     where lower(trim(p.email)) = lower(trim(v_email))
       and p.is_blocked
  ) then
    raise exception 'This email belongs to a blocked customer account.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.reject_blocked_customer_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reject_blocked_customer_orders ON public.orders;
CREATE TRIGGER reject_blocked_customer_orders
BEFORE INSERT OR UPDATE OF user_id, customer_email
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.reject_blocked_customer_activity();

DROP TRIGGER IF EXISTS reject_blocked_customer_payments ON public.payments;
CREATE TRIGGER reject_blocked_customer_payments
BEFORE INSERT OR UPDATE OF order_id, method, transaction_id, status
ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.reject_blocked_customer_activity();
