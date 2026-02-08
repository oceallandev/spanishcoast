-- Supabase schema for SCP auth + favourites.
-- Run in Supabase SQL editor (Database -> SQL editor).

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) Profiles (role-based access)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'partner', 'admin')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
on public.profiles for select
using (auth.uid() = user_id);

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
  insert into public.profiles (user_id, role)
  values (new.id, 'client')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

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

create policy "favourites: read own"
on public.favourites for select
using (auth.uid() = user_id);

create policy "favourites: insert own"
on public.favourites for insert
with check (auth.uid() = user_id);

create policy "favourites: delete own"
on public.favourites for delete
using (auth.uid() = user_id);

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
