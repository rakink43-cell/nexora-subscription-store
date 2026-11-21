-- Bound public analytics input to reduce abusive or oversized event writes.
-- Keep event names flexible for existing frontend event tracking.
drop policy if exists "analytics: insert anyone" on public.analytics_events;

create policy "analytics: bounded public insert"
on public.analytics_events
for insert
to anon, authenticated
with check (
  length(btrim(event_name)) between 1 and 80
  and (path is null or length(path) <= 512)
  and jsonb_typeof(metadata) = 'object'
  and octet_length(metadata::text) <= 2048
);
