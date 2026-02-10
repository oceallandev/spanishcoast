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

-- Backfill profiles for users created before the trigger existed (safe to re-run).
insert into public.profiles (user_id, role, email)
select u.id, 'client', u.email
from auth.users u
where not exists (
  select 1 from public.profiles p where p.user_id = u.id
)
on conflict (user_id) do nothing;

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
  -- Small thumbnail URL for admin inbox convenience (optional).
  property_image text,
  town text,
  type text,
  price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, property_id)
);

alter table public.favourites enable row level security;

-- Migrations for existing projects (safe to re-run).
alter table public.favourites add column if not exists property_image text;

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

-- 4) Listing reference map (secure original refs for privileged roles)
-- Keep source/system references (e.g. Inmovilla) off the public site.
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
with check (public.is_admin());

drop policy if exists "listing_ref_map: admin update" on public.listing_ref_map;
create policy "listing_ref_map: admin update"
on public.listing_ref_map for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "listing_ref_map: admin delete" on public.listing_ref_map;
create policy "listing_ref_map: admin delete"
on public.listing_ref_map for delete
using (public.is_admin());

drop trigger if exists listing_ref_map_set_updated_at on public.listing_ref_map;
create trigger listing_ref_map_set_updated_at
before update on public.listing_ref_map
for each row execute procedure public.set_updated_at();

-- 5) Shop product overrides (admin-only edit)
-- Allows you to curate/edit how WooCommerce products look inside the app without touching WordPress.
-- Public users can read ONLY published overrides. Admin can read/write all.

create table if not exists public.shop_product_overrides (
  wc_id bigint primary key,
  published boolean not null default true,
  app_visible boolean not null default true,
  sort_boost int not null default 0,

  -- Optional overrides. Null = keep the original value from shop-products.js.
  name text,
  sku text,
  url text,
  price numeric,
  regular_price numeric,
  sale_price numeric,
  currency text,
  currency_symbol text,
  categories jsonb,
  images jsonb,
  short_text text,
  desc_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_product_overrides enable row level security;

drop policy if exists "shop_product_overrides: public read published" on public.shop_product_overrides;
create policy "shop_product_overrides: public read published"
on public.shop_product_overrides for select
using (published = true);

drop policy if exists "shop_product_overrides: admin read all" on public.shop_product_overrides;
create policy "shop_product_overrides: admin read all"
on public.shop_product_overrides for select
using (public.is_admin());

drop policy if exists "shop_product_overrides: admin insert" on public.shop_product_overrides;
create policy "shop_product_overrides: admin insert"
on public.shop_product_overrides for insert
with check (public.is_admin());

drop policy if exists "shop_product_overrides: admin update" on public.shop_product_overrides;
create policy "shop_product_overrides: admin update"
on public.shop_product_overrides for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "shop_product_overrides: admin delete" on public.shop_product_overrides;
create policy "shop_product_overrides: admin delete"
on public.shop_product_overrides for delete
using (public.is_admin());

drop trigger if exists shop_product_overrides_set_updated_at on public.shop_product_overrides;
create trigger shop_product_overrides_set_updated_at
before update on public.shop_product_overrides
for each row execute procedure public.set_updated_at();

-- 6) Street Scout (simple collaborators)
-- Users can opt into "collaborator" role via RPC, then submit a board photo + GPS location.
-- Admin manages the inbox and updates status/commission/payout.

-- 6.1) One-click opt-in to collaborator role (safe: only upgrades client -> collaborator)
create or replace function public.become_collaborator()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set role = 'collaborator'
  where user_id = auth.uid()
    and role = 'client'
  returning role into r;

  if r is null then
    select role into r from public.profiles where user_id = auth.uid();
  end if;

  return coalesce(r, 'collaborator');
end;
$$;

revoke all on function public.become_collaborator() from public;
grant execute on function public.become_collaborator() to authenticated;

-- 6.2) Storage bucket for board photos (private)
-- If Storage is disabled in this project, enable it in Supabase first (Storage -> Buckets).
insert into storage.buckets (id, name, public)
values ('collab-boards', 'collab-boards', false)
on conflict (id) do nothing;

-- Policies for uploads/reads under path: {auth.uid()}/{uuid}.jpg
alter table storage.objects enable row level security;

drop policy if exists "collab-boards: insert own" on storage.objects;
create policy "collab-boards: insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'collab-boards'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "collab-boards: read own or admin" on storage.objects;
create policy "collab-boards: read own or admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'collab-boards'
  and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin())
);

drop policy if exists "collab-boards: delete own or admin" on storage.objects;
create policy "collab-boards: delete own or admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'collab-boards'
  and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin())
);

-- 6.3) Leads table (RLS: user reads their own; admin reads all; only admin can update)
create table if not exists public.collab_board_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,

  photo_bucket text not null default 'collab-boards',
  photo_path text not null,

  latitude double precision,
  longitude double precision,
  accuracy_m int,
  captured_at timestamptz,

  phone text,
  notes text,
  admin_notes text,

  commission_tier text not null default 'standard' check (commission_tier in ('standard', 'premium')),
  commission_eur int not null default 200,

  status text not null default 'new' check (status in ('new', 'called', 'contacted', 'signed', 'sold', 'rejected')),
  scp_ref text,
  sold_at timestamptz,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collab_board_leads enable row level security;

create index if not exists collab_board_leads_created_at_idx on public.collab_board_leads(created_at desc);
create index if not exists collab_board_leads_status_idx on public.collab_board_leads(status);

drop policy if exists "collab_board_leads: read own or admin" on public.collab_board_leads;
create policy "collab_board_leads: read own or admin"
on public.collab_board_leads for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "collab_board_leads: insert own" on public.collab_board_leads;
create policy "collab_board_leads: insert own"
on public.collab_board_leads for insert
with check (auth.uid() = user_id);

drop policy if exists "collab_board_leads: admin update" on public.collab_board_leads;
create policy "collab_board_leads: admin update"
on public.collab_board_leads for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "collab_board_leads: admin delete" on public.collab_board_leads;
create policy "collab_board_leads: admin delete"
on public.collab_board_leads for delete
using (public.is_admin());

drop trigger if exists collab_board_leads_set_updated_at on public.collab_board_leads;
create trigger collab_board_leads_set_updated_at
before update on public.collab_board_leads
for each row execute procedure public.set_updated_at();

-- Enable realtime insert notifications for admin inbox (optional).
do $$
begin
  alter publication supabase_realtime add table public.collab_board_leads;
exception when duplicate_object then
  -- already added
  null;
end;
$$;

-- 7) Vehicles (submissions + approved listings)
-- Users can submit vehicles for review. Admin approves to publish into vehicle_listings.
-- Submissions contain PII and MUST remain private (owner/admin only).

create table if not exists public.vehicle_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,

  source text not null default 'owner' check (source in ('owner', 'dealer_import')),
  company_name text,

  -- PII: stored for admin coordination only (not shown publicly).
  contact_name text,
  contact_email text,
  contact_phone text,

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,

  -- Listing payload (no PII). Flexible so we can evolve fields without migrations.
  listing jsonb not null,
  raw jsonb,

  approved_listing_id uuid,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_submissions enable row level security;

-- Migrations (safe to re-run).
alter table public.vehicle_submissions add column if not exists company_name text;
alter table public.vehicle_submissions add column if not exists contact_name text;
alter table public.vehicle_submissions add column if not exists contact_email text;
alter table public.vehicle_submissions add column if not exists contact_phone text;
alter table public.vehicle_submissions add column if not exists admin_notes text;
alter table public.vehicle_submissions add column if not exists listing jsonb;
alter table public.vehicle_submissions add column if not exists raw jsonb;
alter table public.vehicle_submissions add column if not exists approved_listing_id uuid;
alter table public.vehicle_submissions add column if not exists reviewed_at timestamptz;

alter table public.vehicle_submissions drop constraint if exists vehicle_submissions_source_check;
alter table public.vehicle_submissions
  add constraint vehicle_submissions_source_check
  check (source in ('owner', 'dealer_import'));

alter table public.vehicle_submissions drop constraint if exists vehicle_submissions_status_check;
alter table public.vehicle_submissions
  add constraint vehicle_submissions_status_check
  check (status in ('pending', 'approved', 'rejected'));

create index if not exists vehicle_submissions_created_at_idx on public.vehicle_submissions(created_at desc);
create index if not exists vehicle_submissions_status_idx on public.vehicle_submissions(status);

drop policy if exists "vehicle_submissions: read own or admin" on public.vehicle_submissions;
create policy "vehicle_submissions: read own or admin"
on public.vehicle_submissions for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "vehicle_submissions: insert own" on public.vehicle_submissions;
create policy "vehicle_submissions: insert own"
on public.vehicle_submissions for insert
with check (auth.uid() = user_id);

drop policy if exists "vehicle_submissions: admin update" on public.vehicle_submissions;
create policy "vehicle_submissions: admin update"
on public.vehicle_submissions for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vehicle_submissions: admin delete" on public.vehicle_submissions;
create policy "vehicle_submissions: admin delete"
on public.vehicle_submissions for delete
using (public.is_admin());

drop trigger if exists vehicle_submissions_set_updated_at on public.vehicle_submissions;
create trigger vehicle_submissions_set_updated_at
before update on public.vehicle_submissions
for each row execute procedure public.set_updated_at();

-- Public listings: approved vehicles only (no PII).
create table if not exists public.vehicle_listings (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.vehicle_submissions(id) on delete set null,

  published boolean not null default true,
  source text not null default 'owner' check (source in ('owner', 'dealer_import', 'admin')),
  provider_name text,

  category text not null check (category in ('car', 'boat')),
  deal text not null check (deal in ('sale', 'rent')),

  title text not null,
  brand text,
  model text,
  year int,
  price numeric,
  currency text not null default 'EUR',
  price_period text check (price_period in ('day', 'week', 'month') or price_period is null),

  location text,
  latitude double precision,
  longitude double precision,
  images jsonb,
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_listings enable row level security;

-- Migrations (safe to re-run).
alter table public.vehicle_listings add column if not exists submission_id uuid;
alter table public.vehicle_listings add column if not exists published boolean;
alter table public.vehicle_listings add column if not exists source text;
alter table public.vehicle_listings add column if not exists provider_name text;
alter table public.vehicle_listings add column if not exists category text;
alter table public.vehicle_listings add column if not exists deal text;
alter table public.vehicle_listings add column if not exists title text;
alter table public.vehicle_listings add column if not exists brand text;
alter table public.vehicle_listings add column if not exists model text;
alter table public.vehicle_listings add column if not exists year int;
alter table public.vehicle_listings add column if not exists price numeric;
alter table public.vehicle_listings add column if not exists currency text;
alter table public.vehicle_listings add column if not exists price_period text;
alter table public.vehicle_listings add column if not exists location text;
alter table public.vehicle_listings add column if not exists latitude double precision;
alter table public.vehicle_listings add column if not exists longitude double precision;
alter table public.vehicle_listings add column if not exists images jsonb;
alter table public.vehicle_listings add column if not exists description text;

alter table public.vehicle_listings drop constraint if exists vehicle_listings_source_check;
alter table public.vehicle_listings
  add constraint vehicle_listings_source_check
  check (source in ('owner', 'dealer_import', 'admin'));

alter table public.vehicle_listings drop constraint if exists vehicle_listings_category_check;
alter table public.vehicle_listings
  add constraint vehicle_listings_category_check
  check (category in ('car', 'boat'));

alter table public.vehicle_listings drop constraint if exists vehicle_listings_deal_check;
alter table public.vehicle_listings
  add constraint vehicle_listings_deal_check
  check (deal in ('sale', 'rent'));

create index if not exists vehicle_listings_created_at_idx on public.vehicle_listings(created_at desc);
create index if not exists vehicle_listings_published_idx on public.vehicle_listings(published);
create index if not exists vehicle_listings_category_idx on public.vehicle_listings(category);

drop policy if exists "vehicle_listings: public read published" on public.vehicle_listings;
create policy "vehicle_listings: public read published"
on public.vehicle_listings for select
using (published = true);

drop policy if exists "vehicle_listings: admin read all" on public.vehicle_listings;
create policy "vehicle_listings: admin read all"
on public.vehicle_listings for select
using (public.is_admin());

drop policy if exists "vehicle_listings: admin insert" on public.vehicle_listings;
create policy "vehicle_listings: admin insert"
on public.vehicle_listings for insert
with check (public.is_admin());

drop policy if exists "vehicle_listings: admin update" on public.vehicle_listings;
create policy "vehicle_listings: admin update"
on public.vehicle_listings for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vehicle_listings: admin delete" on public.vehicle_listings;
create policy "vehicle_listings: admin delete"
on public.vehicle_listings for delete
using (public.is_admin());

drop trigger if exists vehicle_listings_set_updated_at on public.vehicle_listings;
create trigger vehicle_listings_set_updated_at
before update on public.vehicle_listings
for each row execute procedure public.set_updated_at();
