-- SCP: Network profile reference map (admin-only source refs)
-- Run in Supabase SQL editor (Database -> SQL editor).
-- Prereq: run `supabase.sql` first (creates `public.profiles` + `public.is_admin()` + `public.set_updated_at()`).

create table if not exists public.network_profile_ref_map (
  scp_ref text primary key,
  kind text not null check (kind in ('agency', 'agent', 'developer', 'development', 'collaborator')),
  source text not null,
  original_ref text not null,
  original_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, kind, original_ref)
);

alter table public.network_profile_ref_map enable row level security;

drop policy if exists "network_profile_ref_map: admin read" on public.network_profile_ref_map;
create policy "network_profile_ref_map: admin read"
on public.network_profile_ref_map for select
using (public.is_admin());

drop policy if exists "network_profile_ref_map: admin insert" on public.network_profile_ref_map;
create policy "network_profile_ref_map: admin insert"
on public.network_profile_ref_map for insert
with check (public.is_admin());

drop policy if exists "network_profile_ref_map: admin update" on public.network_profile_ref_map;
create policy "network_profile_ref_map: admin update"
on public.network_profile_ref_map for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "network_profile_ref_map: admin delete" on public.network_profile_ref_map;
create policy "network_profile_ref_map: admin delete"
on public.network_profile_ref_map for delete
using (public.is_admin());

drop trigger if exists network_profile_ref_map_set_updated_at on public.network_profile_ref_map;
create trigger network_profile_ref_map_set_updated_at
before update on public.network_profile_ref_map
for each row execute procedure public.set_updated_at();

