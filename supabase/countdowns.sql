-- Countdown events: a note locked behind a timer until its unlock time.
-- Run in Supabase SQL Editor. Safe to re-run.

create table if not exists public.countdowns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  message text not null default '',
  unlock_at timestamptz not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.countdowns enable row level security;

drop policy if exists "Users can read their own countdowns" on public.countdowns;
create policy "Users can read their own countdowns"
  on public.countdowns for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "Users can create their own countdowns" on public.countdowns;
create policy "Users can create their own countdowns"
  on public.countdowns for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own countdowns" on public.countdowns;
create policy "Users can delete their own countdowns"
  on public.countdowns for delete to authenticated using (auth.uid() = owner_id);
