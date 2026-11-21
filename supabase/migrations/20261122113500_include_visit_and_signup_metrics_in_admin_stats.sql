create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_sales', coalesce((select sum(total) from public.orders
                              where status in ('completed', 'processing', 'payment_verified')), 0),
    'total_orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders
                        where status in ('pending_payment', 'payment_submitted')),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'total_customers', (select count(*) from public.profiles),
    'signups_today', (select count(*) from public.profiles
                        where created_at >= date_trunc('day', now())),
    'total_page_views', (select count(*) from public.analytics_events
                          where event_name = 'page_view'),
    'page_views_today', (select count(*) from public.analytics_events
                          where event_name = 'page_view'
                            and created_at >= date_trunc('day', now())),
    'total_products', (select count(*) from public.products where is_active),
    'unread_notifications', (select count(*) from public.notifications where is_read = false),
    'open_support', (select count(*) from public.support_messages where status = 'open'),
    'revenue_today', coalesce((select sum(total) from public.orders
                                where status in ('completed', 'processing', 'payment_verified')
                                  and created_at >= date_trunc('day', now())), 0),
    'orders_today', (select count(*) from public.orders
                      where created_at >= date_trunc('day', now())),
    'sales_series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'total', coalesce(s.total, 0)) order by d)
      from generate_series((current_date - interval '13 days')::date, current_date, '1 day') d
      left join (
        select date_trunc('day', created_at)::date as day, sum(total) as total
          from public.orders
         where status in ('completed', 'processing', 'payment_verified')
           and created_at >= current_date - interval '13 days'
         group by 1
      ) s on s.day = d
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$function$;
