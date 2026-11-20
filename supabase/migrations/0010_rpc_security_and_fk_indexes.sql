-- NEXORA 0010: Harden SECURITY DEFINER RPC grants and add missing FK indexes.
-- This migration is idempotent and has already been applied to the connected project.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.signature);
  end loop;
end $$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.can_access_order(public.orders) to anon, authenticated;
grant execute on function public.is_super_admin() to authenticated;

grant execute on function public.place_order(jsonb,text,text,text,public.payment_method,text,text) to anon, authenticated;
grant execute on function public.submit_payment(text,uuid,public.payment_method,text,text,numeric,text) to anon, authenticated;
grant execute on function public.get_order(text,uuid) to anon, authenticated;
grant execute on function public.lookup_guest_order(text,text) to anon, authenticated;
grant execute on function public.validate_coupon(text,numeric) to anon, authenticated;
grant execute on function public.claim_guest_order(text,text) to authenticated;

grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_set_role(text,public.app_role) to authenticated;
grant execute on function public.admin_update_order_status(uuid,public.order_status,text) to authenticated;
grant execute on function public.admin_verify_payment(uuid,public.payment_status,text) to authenticated;
grant execute on function public.bootstrap_admin(text,text) to authenticated;

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.generate_order_number() set search_path = public, pg_temp;

create index if not exists idx_admin_audit_actor on public.admin_audit_log(actor_id);
create index if not exists idx_notifications_order on public.notifications(order_id);
create index if not exists idx_order_history_changed_by on public.order_status_history(changed_by);
create index if not exists idx_payments_verified_by on public.payments(verified_by);
create index if not exists idx_reviews_user on public.reviews(user_id);
create index if not exists idx_support_replied_by on public.support_messages(replied_by);
create index if not exists idx_support_user on public.support_messages(user_id);
create index if not exists idx_user_roles_granted_by on public.user_roles(granted_by);
