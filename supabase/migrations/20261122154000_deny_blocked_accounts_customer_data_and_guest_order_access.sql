CREATE OR REPLACE FUNCTION public.is_customer_blocked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((
    SELECT p.is_blocked
      FROM public.profiles p
     WHERE p.id = auth.uid()
  ), false);
$function$;

REVOKE ALL ON FUNCTION public.is_customer_blocked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_customer_blocked() TO authenticated;

DROP POLICY IF EXISTS "orders: read own" ON public.orders;
CREATE POLICY "orders: read own" ON public.orders
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "order_items: read own" ON public.order_items;
CREATE POLICY "order_items: read own" ON public.order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id = (SELECT auth.uid())
  )
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "history: read own" ON public.order_status_history;
CREATE POLICY "history: read own" ON public.order_status_history
FOR SELECT TO authenticated
USING (
  NOT is_internal
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.user_id = (SELECT auth.uid())
  )
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "payments: read own" ON public.payments;
CREATE POLICY "payments: read own" ON public.payments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id
      AND o.user_id = (SELECT auth.uid())
  )
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "profiles: read own" ON public.profiles;
CREATE POLICY "profiles: read own" ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own" ON public.profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()) AND NOT public.is_customer_blocked())
WITH CHECK (id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "reviews: insert own" ON public.reviews;
CREATE POLICY "reviews: insert own" ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND is_approved = false
  AND NOT public.is_customer_blocked()
);

DROP POLICY IF EXISTS "support: read own" ON public.support_messages;
CREATE POLICY "support: read own" ON public.support_messages
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND NOT public.is_customer_blocked());

DROP POLICY IF EXISTS "roles: read own" ON public.user_roles;
CREATE POLICY "roles: read own" ON public.user_roles
FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()) OR public.is_admin())
  AND NOT public.is_customer_blocked()
);

CREATE OR REPLACE FUNCTION public.get_order(_order_number text, _access_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order public.orders;
  v_items jsonb;
  v_payment jsonb;
  v_history jsonb;
begin
  select * into v_order
    from public.orders
   where order_number = upper(trim(_order_number));

  if not found then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if not (
    public.is_admin()
    or (v_order.user_id is not null and v_order.user_id = auth.uid())
    or (v_order.user_id is null and v_order.access_token = _access_token)
  ) then
    raise exception 'Order not found.' using errcode = '42501';
  end if;

  if not public.is_admin() and (
    (v_order.user_id is not null and exists (
      select 1 from public.profiles p
      where p.id = v_order.user_id and p.is_blocked
    ))
    or (v_order.user_id is null and exists (
      select 1 from public.profiles p
      where lower(trim(p.email)) = lower(trim(v_order.customer_email))
        and p.is_blocked
    ))
  ) then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
    into v_items from public.order_items i where i.order_id = v_order.id;

  select to_jsonb(p) - 'admin_note' into v_payment
    from public.payments p where p.order_id = v_order.id
    order by p.created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'note', h.note, 'created_at', h.created_at)
                            order by h.created_at), '[]'::jsonb)
    into v_history from public.order_status_history h
   where h.order_id = v_order.id and h.is_internal = false;

  return jsonb_build_object(
    'order', (to_jsonb(v_order) - 'access_token'),
    'items', v_items,
    'payment', v_payment,
    'history', v_history
  );
end;
$function$;
