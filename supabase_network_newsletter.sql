-- SCP: Network profile suspension + Newsletter campaigns
-- Run in Supabase SQL editor (Database -> SQL editor).
-- Prereq: run `supabase.sql` first (creates `public.profiles` + `public.is_admin()`).

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) Network profile state (suspensions)
create table if not exists public.network_profile_state (
  kind text not null check (kind in ('agency', 'agent', 'developer', 'development', 'collaborator')),
  slug text not null,
  suspended boolean not null default false,
  reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (kind, slug)
);

alter table public.network_profile_state enable row level security;

drop policy if exists "network_profile_state: read all" on public.network_profile_state;
create policy "network_profile_state: read all"
on public.network_profile_state for select
using (true);

drop policy if exists "network_profile_state: admin insert" on public.network_profile_state;
create policy "network_profile_state: admin insert"
on public.network_profile_state for insert
with check (public.is_admin());

drop policy if exists "network_profile_state: admin update" on public.network_profile_state;
create policy "network_profile_state: admin update"
on public.network_profile_state for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "network_profile_state: admin delete" on public.network_profile_state;
create policy "network_profile_state: admin delete"
on public.network_profile_state for delete
using (public.is_admin());

-- Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists network_profile_state_set_updated_at on public.network_profile_state;
create trigger network_profile_state_set_updated_at
before update on public.network_profile_state
for each row execute procedure public.set_updated_at();

-- 2) Newsletter campaign log (optional but useful for auditing)
create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  audience_type text not null check (audience_type in ('all', 'role', 'emails')),
  audience_role text,
  audience_emails text[],
  subject text not null,
  body text not null,
  language text default 'en',
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'partial')),
  sent_count int not null default 0,
  failed_count int not null default 0,
  error text
);

alter table public.newsletter_campaigns enable row level security;

drop policy if exists "newsletter_campaigns: admin read" on public.newsletter_campaigns;
create policy "newsletter_campaigns: admin read"
on public.newsletter_campaigns for select
using (public.is_admin());

drop policy if exists "newsletter_campaigns: admin insert" on public.newsletter_campaigns;
create policy "newsletter_campaigns: admin insert"
on public.newsletter_campaigns for insert
with check (public.is_admin());

drop policy if exists "newsletter_campaigns: admin update" on public.newsletter_campaigns;
create policy "newsletter_campaigns: admin update"
on public.newsletter_campaigns for update
using (public.is_admin())
with check (public.is_admin());

