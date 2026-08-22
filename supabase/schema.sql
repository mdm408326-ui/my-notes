-- Run this once in Supabase: Dashboard -> SQL Editor -> New query.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  content text not null default '',
  reminder_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can read their own notes"
  on public.notes for select using (auth.uid() = owner_id);

create policy "Users can create their own notes"
  on public.notes for insert with check (auth.uid() = owner_id);

create policy "Users can delete their own notes"
  on public.notes for delete using (auth.uid() = owner_id);

-- One row per device (browser) that has opted in to reminder notifications.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can read their own subscriptions"
  on public.push_subscriptions for select using (auth.uid() = owner_id);

create policy "Users can add their own subscriptions"
  on public.push_subscriptions for insert with check (auth.uid() = owner_id);

create policy "Users can update their own subscriptions"
  on public.push_subscriptions for update using (auth.uid() = owner_id);

create policy "Users can delete their own subscriptions"
  on public.push_subscriptions for delete using (auth.uid() = owner_id);
