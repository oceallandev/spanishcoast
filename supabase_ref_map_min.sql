-- Minimal Supabase SQL: secure original reference map for privileged roles.
-- Run this in Supabase SQL Editor if you only need the Orig/ID buttons to work.
--
-- Prerequisites:
-- - `public.profiles` table exists and contains your role (admin/partner/agency roles, etc).
--   (If you already use favourites/auth in this app, you likely have it.)

-- Keep source/system references (e.g. propmls / inmovilla / redsp) off the public site.
-- The frontend shows SCP refs to everyone, and fetches original refs from this table only for privileged roles.

create table if not exists public.listing_ref_map (
  scp_ref text primary key,
  source text not null default 'inmovilla',
  original_ref text not null,
  original_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, original_ref)
);

alter table public.listing_ref_map enable row level security;

drop policy if exists "listing_ref_map: privileged read" on public.listing_ref_map;
create policy "listing_ref_map: privileged read"
on public.listing_ref_map for select
using (exists (
  select 1
  from public.profiles p
  where p.user_id = auth.uid()
    and p.role in ('admin', 'partner', 'agency_admin', 'agent', 'developer', 'collaborator')
));

drop policy if exists "listing_ref_map: admin insert" on public.listing_ref_map;
create policy "listing_ref_map: admin insert"
on public.listing_ref_map for insert
with check (exists (
  select 1
  from public.profiles p
  where p.user_id = auth.uid()
    and p.role = 'admin'
));

drop policy if exists "listing_ref_map: admin update" on public.listing_ref_map;
create policy "listing_ref_map: admin update"
on public.listing_ref_map for update
using (exists (
  select 1
  from public.profiles p
  where p.user_id = auth.uid()
    and p.role = 'admin'
))
with check (exists (
  select 1
  from public.profiles p
  where p.user_id = auth.uid()
    and p.role = 'admin'
));

drop policy if exists "listing_ref_map: admin delete" on public.listing_ref_map;
create policy "listing_ref_map: admin delete"
on public.listing_ref_map for delete
using (exists (
  select 1
  from public.profiles p
  where p.user_id = auth.uid()
    and p.role = 'admin'
));

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

drop trigger if exists listing_ref_map_set_updated_at on public.listing_ref_map;
create trigger listing_ref_map_set_updated_at
before update on public.listing_ref_map
for each row execute procedure public.set_updated_at();

