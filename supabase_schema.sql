-- BHAVANISHREE TAILORING SHOP — Supabase schema
-- இதை Supabase Dashboard → SQL Editor இல் ஒட்டி "Run" செய்யவும் (ஒரே முறை போதும்).

create extension if not exists pgcrypto;

-- ---------------- customers ----------------
create table if not exists public.customers (
  id text primary key,
  name text not null default '',
  phone text default '',
  model text not null check (model in ('blouse', 'chudithar')),
  cutting_type text,
  notes text default '',
  pinned boolean not null default false,
  deleted boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists customers_deleted_idx on public.customers (deleted);
create index if not exists customers_updated_at_idx on public.customers (updated_at desc);

-- ---------------- measurements ----------------
create table if not exists public.measurements (
  id text primary key,
  customer_id text not null references public.customers (id) on delete cascade,
  model text not null,
  fields jsonb not null default '{}'::jsonb,
  created_at bigint not null
);

create index if not exists measurements_customer_id_idx on public.measurements (customer_id);
create index if not exists measurements_created_at_idx on public.measurements (created_at desc);

-- ---------------- patterns (standalone உடல் அளவு tab) ----------------
create table if not exists public.patterns (
  id text primary key,
  label text default '',
  fields jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists patterns_deleted_idx on public.patterns (deleted);

-- ==================================================
-- Row Level Security
-- ==================================================
-- இந்த ஆப் தற்போது login/authentication இல்லாமல் anon key மூலமாகவே
-- Supabase-ஐ அணுகுகிறது (ஒரு கடையின் சொந்த cloud storage என்ற அளவில்).
-- எனவே anon role-க்கு முழு அணுகலும் தேவை. இந்த லிங்க் (URL + anon key)
-- யாருக்கும் தெரியாமல் பாதுகாப்பாக வைத்திருங்கள் — அதுவே இதன் பாதுகாப்பு.
-- எதிர்காலத்தில் உள்நுழைவு (login) சேர்க்க விரும்பினால், இந்த policies-ஐ
-- auth.uid() அடிப்படையில் மாற்றலாம்.

alter table public.customers enable row level security;
alter table public.measurements enable row level security;
alter table public.patterns enable row level security;

drop policy if exists "customers_anon_all" on public.customers;
create policy "customers_anon_all" on public.customers
  for all to anon using (true) with check (true);

drop policy if exists "measurements_anon_all" on public.measurements;
create policy "measurements_anon_all" on public.measurements
  for all to anon using (true) with check (true);

drop policy if exists "patterns_anon_all" on public.patterns;
create policy "patterns_anon_all" on public.patterns
  for all to anon using (true) with check (true);