-- Record every customer block/unblock action and protect privileged accounts.
CREATE OR REPLACE FUNCTION public.admin_set_customer_blocked(_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_previous boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING errcode = '28000';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING errcode = '42501';
  END IF;
  IF _user_id IS NULL OR _blocked IS NULL THEN
    RAISE EXCEPTION 'A customer and block status are required.' USING errcode = '22023';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot block or unblock your own account here.' USING errcode = '42501';
  END IF;

  SELECT is_blocked INTO v_previous
    FROM public.profiles
   WHERE id = _user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile not found.' USING errcode = 'P0002';
  END IF;

  PERFORM 1 FROM public.user_roles
   WHERE user_id = _user_id AND role IN ('admin', 'staff')
   FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'Administrator and staff accounts cannot be blocked through customer management.' USING errcode = '42501';
  END IF;

  UPDATE public.profiles
     SET is_blocked = _blocked,
         updated_at = now()
   WHERE id = _user_id;

  IF v_previous IS DISTINCT FROM _blocked THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
    VALUES (
      auth.uid(),
      CASE WHEN _blocked THEN 'block_customer' ELSE 'unblock_customer' END,
      'profiles',
      _user_id::text,
      jsonb_build_object('previous_is_blocked', v_previous, 'is_blocked', _blocked)
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_customer_blocked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_blocked(uuid, boolean) TO authenticated;
