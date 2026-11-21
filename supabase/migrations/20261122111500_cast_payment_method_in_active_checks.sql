-- payment_methods.method is text, while RPC parameters use the payment_method enum.
-- Cast the enum to text to avoid runtime operator type errors during checkout.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.place_order(jsonb,text,text,text,public.payment_method,text,text)'::regprocedure)
    into v_definition;
  v_definition := replace(
    v_definition,
    'where method = _payment_method and is_active = true',
    'where method = _payment_method::text and is_active = true'
  );
  execute v_definition;

  select pg_get_functiondef('public.submit_payment(text,uuid,public.payment_method,text,text,numeric,text)'::regprocedure)
    into v_definition;
  v_definition := replace(
    v_definition,
    'where method = _method and is_active = true',
    'where method = _method::text and is_active = true'
  );
  execute v_definition;
end;
$migration$;
