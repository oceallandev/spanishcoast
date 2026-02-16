-- Supabase schema: Network profile claim/control requests.
-- Run in Supabase SQL editor (Database -> SQL editor).

create extension if not exists pgcrypto;

create table if not exists public.network_profile_claims (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  slug text not null,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_email text,
  requester_name text,
  requested_action text not null default 'edit' check (requested_action in ('edit', 'delete')),
  message text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

alter table public.network_profile_claims enable row level security;

-- Users can create claim requests for profiles.
drop policy if exists "network_profile_claims: insert own" on public.network_profile_claims;
create policy "network_profile_claims: insert own"
on public.network_profile_claims for insert
with check (auth.uid() = requester_user_id);

-- Users can read their own requests (optional, useful for "My requests" later).
drop policy if exists "network_profile_claims: read own" on public.network_profile_claims;
create policy "network_profile_claims: read own"
on public.network_profile_claims for select
using (auth.uid() = requester_user_id);

-- Admins can read all claim requests.
drop policy if exists "network_profile_claims: admin read all" on public.network_profile_claims;
create policy "network_profile_claims: admin read all"
on public.network_profile_claims for select
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.role = 'admin'
));

-- Admins can update claim requests (status/notes).
drop policy if exists "network_profile_claims: admin update" on public.network_profile_claims;
create policy "network_profile_claims: admin update"
on public.network_profile_claims for update
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.role = 'admin'
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.role = 'admin'
));

-- Optional: allow admins to delete spam.
drop policy if exists "network_profile_claims: admin delete" on public.network_profile_claims;
create policy "network_profile_claims: admin delete"
on public.network_profile_claims for delete
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.role = 'admin'
));

