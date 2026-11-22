-- Run this in Supabase SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  premium_until timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.payments (
  reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  currency text not null,
  status text not null,
  premium_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.payments enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles; -- Premium dates must only be changed by trusted server functions.
create policy "Users can read own payments" on public.payments for select using (auth.uid() = user_id);
-- Only Netlify server functions use the service-role key to write payment records.


-- Daily AI request counters. Writes are performed only by the Netlify service function.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);
alter table public.ai_usage enable row level security;
-- No client policies are granted: the service-role key is used by the server function only.
