-- Guest checkout and account/order retrieval use validated RPCs.
-- Anonymous clients should not have direct table privileges for customer,
-- payment, role, notification, coupon, or admin-audit data.
REVOKE ALL ON TABLE
  public.admin_audit_log,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.payments,
  public.profiles,
  public.user_roles,
  public.notifications,
  public.coupons
FROM anon;
