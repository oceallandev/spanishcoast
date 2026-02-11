-- Supabase migration: Saved search alerts + in-app match notifications
-- Run this file in Supabase SQL Editor when full schema scripts are too large.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.saved_search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  name text not null,
  scope text not null default 'resales',
  criteria jsonb not null default '{}'::jsonb,
  criteria_hash text not null,
  enabled boolean not null default true,
  notify_in_app boolean not null default true,
  notify_email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, criteria_hash)
);

alter table public.saved_search_alerts enable row level security;

alter table public.saved_search_alerts drop constraint if exists saved_search_alerts_scope_check;
alter table public.saved_search_alerts
  add constraint saved_search_alerts_scope_check
  check (scope in ('resales', 'new_builds', 'all'));

create unique index if not exists saved_search_alerts_user_hash_uidx on public.saved_search_alerts(user_id, criteria_hash);
create index if not exists saved_search_alerts_user_enabled_idx on public.saved_search_alerts(user_id, enabled);
create index if not exists saved_search_alerts_updated_at_idx on public.saved_search_alerts(updated_at desc);

drop policy if exists "saved_search_alerts: read own" on public.saved_search_alerts;
create policy "saved_search_alerts: read own"
on public.saved_search_alerts for select
using (auth.uid() = user_id);

drop policy if exists "saved_search_alerts: insert own" on public.saved_search_alerts;
create policy "saved_search_alerts: insert own"
on public.saved_search_alerts for insert
with check (auth.uid() = user_id);

drop policy if exists "saved_search_alerts: update own" on public.saved_search_alerts;
create policy "saved_search_alerts: update own"
on public.saved_search_alerts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved_search_alerts: delete own" on public.saved_search_alerts;
create policy "saved_search_alerts: delete own"
on public.saved_search_alerts for delete
using (auth.uid() = user_id);

drop policy if exists "saved_search_alerts: admin read all" on public.saved_search_alerts;
create policy "saved_search_alerts: admin read all"
on public.saved_search_alerts for select
using (public.is_admin());

drop trigger if exists saved_search_alerts_set_updated_at on public.saved_search_alerts;
create trigger saved_search_alerts_set_updated_at
before update on public.saved_search_alerts
for each row execute procedure public.set_updated_at();

create table if not exists public.saved_search_matches (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.saved_search_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,
  property_ref text,
  property_town text,
  property_type text,
  property_price numeric,
  property_url text,
  seen boolean not null default false,
  matched_at timestamptz not null default now(),
  unique (alert_id, property_id)
);

alter table public.saved_search_matches enable row level security;

create index if not exists saved_search_matches_user_seen_idx on public.saved_search_matches(user_id, seen, matched_at desc);
create index if not exists saved_search_matches_alert_idx on public.saved_search_matches(alert_id, matched_at desc);
create index if not exists saved_search_matches_property_idx on public.saved_search_matches(property_id);

drop policy if exists "saved_search_matches: read own or admin" on public.saved_search_matches;
create policy "saved_search_matches: read own or admin"
on public.saved_search_matches for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "saved_search_matches: insert own" on public.saved_search_matches;
create policy "saved_search_matches: insert own"
on public.saved_search_matches for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.saved_search_alerts a
    where a.id = saved_search_matches.alert_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "saved_search_matches: update own or admin" on public.saved_search_matches;
create policy "saved_search_matches: update own or admin"
on public.saved_search_matches for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "saved_search_matches: delete own or admin" on public.saved_search_matches;
create policy "saved_search_matches: delete own or admin"
on public.saved_search_matches for delete
using (auth.uid() = user_id or public.is_admin());
