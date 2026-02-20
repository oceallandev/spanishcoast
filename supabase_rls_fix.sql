
-- Enable RLS just in case
alter table "public"."listing_ref_map" enable row level security;

-- Drop existing policy if any (to be safe)
drop policy if exists "Allow public read" on "public"."listing_ref_map";

-- Policy to allow Anon key to SELECT
create policy "Allow public read"
on "public"."listing_ref_map"
for select
to anon
using (true);
