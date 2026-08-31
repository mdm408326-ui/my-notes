-- Usernames + surprise notes. Run this in Supabase SQL Editor.
-- Safe to run more than once.

-- ===== Profiles: maps a username to a user =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user can look up usernames (needed to send a surprise to @someone).
drop policy if exists "Authenticated can read profiles" on public.profiles;
create policy "Authenticated can read profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- ===== Surprise notes: a note from one user to another, delivered on a date =====
create table if not exists public.surprise_notes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_username text not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  message text not null default '',
  deliver_on date not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.surprise_notes enable row level security;

-- Sender may create a surprise (only as themselves).
drop policy if exists "Users can send surprises" on public.surprise_notes;
create policy "Users can send surprises"
  on public.surprise_notes for insert to authenticated with check (auth.uid() = sender_id);

-- Sender can always see what they sent (to manage it).
drop policy if exists "Senders can see what they sent" on public.surprise_notes;
create policy "Senders can see what they sent"
  on public.surprise_notes for select to authenticated using (auth.uid() = sender_id);

-- Recipient can see a surprise ONLY once its delivery date has arrived — keeps it a surprise.
drop policy if exists "Recipients can see delivered surprises" on public.surprise_notes;
create policy "Recipients can see delivered surprises"
  on public.surprise_notes for select to authenticated
  using (auth.uid() = recipient_id and deliver_on <= current_date);

-- Sender can cancel a surprise before it's delivered.
drop policy if exists "Senders can delete undelivered surprises" on public.surprise_notes;
create policy "Senders can delete undelivered surprises"
  on public.surprise_notes for delete to authenticated
  using (auth.uid() = sender_id and delivered_at is null);
