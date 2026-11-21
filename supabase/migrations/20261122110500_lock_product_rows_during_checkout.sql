-- Hold a shared lock on each priced product row until checkout commits.
-- This prevents a concurrent price/availability edit from making the saved order
-- line totals differ from the subtotal computed earlier in place_order.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.place_order(jsonb,text,text,text,public.payment_method,text,text)'::regprocedure)
    into v_definition;

  if position('and is_active = true for share' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'and is_active = true;',
      'and is_active = true for share;'
    );
    execute v_definition;
  end if;
end;
$migration$;
