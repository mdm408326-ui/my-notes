-- Reminder push notifications — run this in Supabase SQL Editor AFTER schema.sql.
-- (If you are setting up a fresh project, schema.sql already includes everything;
--  this file is the incremental piece for projects created before push was added.)

-- 1. Track when a reminder has already been pushed, so we never send it twice.
alter table public.notes
  add column if not exists notified_at timestamptz;

-- 2. One row per device (browser) that has opted in to notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Users manage only their own device subscriptions. The reminder job runs with
-- the service-role key, which bypasses RLS, so it can read every subscription.
drop policy if exists "Users can read their own subscriptions" on public.push_subscriptions;
create policy "Users can read their own subscriptions"
  on public.push_subscriptions for select using (auth.uid() = owner_id);

drop policy if exists "Users can add their own subscriptions" on public.push_subscriptions;
create policy "Users can add their own subscriptions"
  on public.push_subscriptions for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own subscriptions" on public.push_subscriptions;
create policy "Users can update their own subscriptions"
  on public.push_subscriptions for update using (auth.uid() = owner_id);

drop policy if exists "Users can delete their own subscriptions" on public.push_subscriptions;
create policy "Users can delete their own subscriptions"
  on public.push_subscriptions for delete using (auth.uid() = owner_id);
