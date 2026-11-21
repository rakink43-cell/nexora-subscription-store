create or replace function public.get_new_customer_offer_status()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to check your new-customer offer.' using errcode = '28000';
  end if;

  select count(*)::int into v_count
    from public.orders
   where user_id = auth.uid()
     and status not in ('cancelled', 'refunded');

  return jsonb_build_object(
    'eligible', v_count < 3,
    'orders_used', v_count,
    'orders_remaining', greatest(0, 3 - v_count)
  );
end;
$function$;

revoke all on function public.get_new_customer_offer_status() from public;
revoke all on function public.get_new_customer_offer_status() from anon;
grant execute on function public.get_new_customer_offer_status() to authenticated;
