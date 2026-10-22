-- Velmora product admin backend (Supabase SQL Editor)
-- 1) Create an administrator user in Supabase Authentication > Users.
-- 2) Run this SQL. Products are publicly readable only when published.
create table if not exists public.velmora_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  handle text not null unique,
  price numeric(12,2) not null default 0 check (price >= 0),
  image text not null default '',
  images jsonb not null default '[]'::jsonb,
  description text not null default '',
  category text not null default 'Fashion',
  variants jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.velmora_products enable row level security;
drop policy if exists "Public can read published Velmora products" on public.velmora_products;
create policy "Public can read published Velmora products"
  on public.velmora_products for select using (published = true);
drop policy if exists "Authenticated admins can read all Velmora products" on public.velmora_products;
create policy "Authenticated admins can read all Velmora products"
  on public.velmora_products for select to authenticated using (true);
drop policy if exists "Authenticated admins can insert Velmora products" on public.velmora_products;
create policy "Authenticated admins can insert Velmora products"
  on public.velmora_products for insert to authenticated with check (auth.uid() is not null);
drop policy if exists "Authenticated admins can update Velmora products" on public.velmora_products;
create policy "Authenticated admins can update Velmora products"
  on public.velmora_products for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "Authenticated admins can delete Velmora products" on public.velmora_products;
create policy "Authenticated admins can delete Velmora products"
  on public.velmora_products for delete to authenticated using (auth.uid() is not null);

-- Lock down administrator write access further by allowing only explicitly approved user IDs.
-- Replace APPROVED_ADMIN_USER_UUID with the UUID from Authentication > Users, then
-- use the policy replacements below. Do not leave the broad authenticated write policies
-- above enabled in a public deployment.
create table if not exists public.velmora_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.velmora_admins enable row level security;
drop policy if exists "Admins can read own admin record" on public.velmora_admins;
create policy "Admins can read own admin record" on public.velmora_admins
  for select to authenticated using (user_id = auth.uid());

-- Replace authenticated product policies with admin-membership checks:
drop policy if exists "Authenticated admins can read all Velmora products" on public.velmora_products;
create policy "Approved admins can read all Velmora products" on public.velmora_products
  for select to authenticated using (exists (select 1 from public.velmora_admins a where a.user_id = auth.uid()));
drop policy if exists "Authenticated admins can insert Velmora products" on public.velmora_products;
create policy "Approved admins can insert Velmora products" on public.velmora_products
  for insert to authenticated with check (exists (select 1 from public.velmora_admins a where a.user_id = auth.uid()));
drop policy if exists "Authenticated admins can update Velmora products" on public.velmora_products;
create policy "Approved admins can update Velmora products" on public.velmora_products
  for update to authenticated using (exists (select 1 from public.velmora_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.velmora_admins a where a.user_id = auth.uid()));
drop policy if exists "Authenticated admins can delete Velmora products" on public.velmora_products;
create policy "Approved admins can delete Velmora products" on public.velmora_products
  for delete to authenticated using (exists (select 1 from public.velmora_admins a where a.user_id = auth.uid()));

-- Product images: create a public Storage bucket named "velmora-products" in Supabase Storage.
-- Public read is needed to display published product photos. Upload/delete policies should
-- be restricted to authenticated users who exist in velmora_admins (configure via Storage policies).
