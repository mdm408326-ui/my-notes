-- Run this once in Supabase: Dashboard -> SQL Editor -> New query.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  content text not null default '',
  reminder_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can read their own notes"
  on public.notes for select using (auth.uid() = owner_id);

create policy "Users can create their own notes"
  on public.notes for insert with check (auth.uid() = owner_id);

create policy "Users can delete their own notes"
  on public.notes for delete using (auth.uid() = owner_id);
