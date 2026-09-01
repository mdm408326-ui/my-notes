-- Direct messages between users. Run in Supabase SQL Editor. Safe to re-run.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_username text not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  recipient_username text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  notified_at timestamptz
);

alter table public.messages enable row level security;

-- Only the two people in a conversation can read its messages.
drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages"
  on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
  on public.messages for insert to authenticated with check (auth.uid() = sender_id);

-- Recipient can mark messages read.
drop policy if exists "Recipients can mark messages read" on public.messages;
create policy "Recipients can mark messages read"
  on public.messages for update to authenticated using (auth.uid() = recipient_id);

-- Enable live updates (Realtime) for this table, only if not already enabled.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
