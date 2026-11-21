-- NEXORA · 0013 — Analytics query indexes
-- Keeps the 30-day analytics dashboard responsive as event/profile tables grow.
create index if not exists idx_analytics_created_at
  on public.analytics_events (created_at desc);

create index if not exists idx_profiles_created_at
  on public.profiles (created_at desc);
