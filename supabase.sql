-- Supabase schema for SCP auth + favourites.
-- Run in Supabase SQL editor (Database -> SQL editor).

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) Profiles (role-based access)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Global role used by the client UI to show dashboards. Keep it simple and grow as needed.
  role text not null default 'client' check (role in ('client', 'collaborator', 'partner', 'agent', 'agency_admin', 'developer', 'admin')),
  display_name text,
  -- Optional convenience for admins (not required for auth). Filled by trigger on signup.
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Migrations for existing projects (safe to re-run).
alter table public.profiles add column if not exists email text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'collaborator', 'partner', 'agent', 'agency_admin', 'developer', 'admin'));

-- Helper: admin check without RLS recursion in policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
on public.profiles for select
using (auth.uid() = user_id);

drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all"
on public.profiles for select
using (public.is_admin());

drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

-- Keep profiles locked down: clients only need to read their own role.
-- If you later add profile editing, add narrowly-scoped update policies/triggers.

-- Create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, email)
  values (new.id, 'client', new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill email for existing profiles (safe to re-run).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.user_id
  and (p.email is null or p.email = '');

-- 2) Favourites
create table if not exists public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  property_id text not null,
  property_ref text,
  property_link text,
  town text,
  type text,
  price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, property_id)
);

alter table public.favourites enable row level security;

drop policy if exists "favourites: read own" on public.favourites;
create policy "favourites: read own"
on public.favourites for select
using (auth.uid() = user_id);

drop policy if exists "favourites: insert own" on public.favourites;
create policy "favourites: insert own"
on public.favourites for insert
with check (auth.uid() = user_id);

drop policy if exists "favourites: delete own" on public.favourites;
create policy "favourites: delete own"
on public.favourites for delete
using (auth.uid() = user_id);

drop policy if exists "favourites: admin read all" on public.favourites;
create policy "favourites: admin read all"
on public.favourites for select
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.role = 'admin'
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

drop trigger if exists favourites_set_updated_at on public.favourites;
create trigger favourites_set_updated_at
before update on public.favourites
for each row execute procedure public.set_updated_at();

-- 3) CRM (admin-only)
-- Contacts + Demands from systems like Inmovilla. These tables contain PII and MUST remain admin-only.

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'inmovilla',
  external_client_code text not null,
  email text,
  first_name text,
  last_name text,
  phone1 text,
  phone2 text,
  phone3 text,
  locality text,
  province text,
  nationality text,
  client_type text,
  notes text,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_client_code)
);

alter table public.crm_contacts enable row level security;

drop policy if exists "crm_contacts: admin read" on public.crm_contacts;
create policy "crm_contacts: admin read"
on public.crm_contacts for select
using (public.is_admin());

drop policy if exists "crm_contacts: admin insert" on public.crm_contacts;
create policy "crm_contacts: admin insert"
on public.crm_contacts for insert
with check (public.is_admin());

drop policy if exists "crm_contacts: admin update" on public.crm_contacts;
create policy "crm_contacts: admin update"
on public.crm_contacts for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "crm_contacts: admin delete" on public.crm_contacts;
create policy "crm_contacts: admin delete"
on public.crm_contacts for delete
using (public.is_admin());

drop trigger if exists crm_contacts_set_updated_at on public.crm_contacts;
create trigger crm_contacts_set_updated_at
before update on public.crm_contacts
for each row execute procedure public.set_updated_at();

create table if not exists public.crm_demands (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'inmovilla',
  external_client_code text,
  external_demand_number text,
  title text,
  operation text check (operation in ('sale', 'rent') or operation is null),
  price_min numeric,
  price_max numeric,
  beds_min int,
  baths_min int,
  types text,
  zones text,
  want_terrace boolean not null default false,
  want_pool boolean not null default false,
  want_garage boolean not null default false,
  want_lift boolean not null default false,
  notes text,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_client_code, external_demand_number)
);

alter table public.crm_demands enable row level security;

drop policy if exists "crm_demands: admin read" on public.crm_demands;
create policy "crm_demands: admin read"
on public.crm_demands for select
using (public.is_admin());

drop policy if exists "crm_demands: admin insert" on public.crm_demands;
create policy "crm_demands: admin insert"
on public.crm_demands for insert
with check (public.is_admin());

drop policy if exists "crm_demands: admin update" on public.crm_demands;
create policy "crm_demands: admin update"
on public.crm_demands for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "crm_demands: admin delete" on public.crm_demands;
create policy "crm_demands: admin delete"
on public.crm_demands for delete
using (public.is_admin());

drop trigger if exists crm_demands_set_updated_at on public.crm_demands;
create trigger crm_demands_set_updated_at
before update on public.crm_demands
for each row execute procedure public.set_updated_at();
