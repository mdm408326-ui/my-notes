-- Enable editing of notes, surprises, and messages. Run in Supabase SQL Editor.

-- Notes: owner can edit.
drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
  on public.notes for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Surprises: remember the recipient's username, and let the sender edit an
-- undelivered surprise.
alter table public.surprise_notes add column if not exists recipient_username text;

drop policy if exists "Senders can edit undelivered surprises" on public.surprise_notes;
create policy "Senders can edit undelivered surprises"
  on public.surprise_notes for update to authenticated
  using (auth.uid() = sender_id and delivered_at is null)
  with check (auth.uid() = sender_id);

-- Messages: sender can edit and delete their own messages.
drop policy if exists "Senders can edit their messages" on public.messages;
create policy "Senders can edit their messages"
  on public.messages for update to authenticated
  using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

drop policy if exists "Senders can delete their messages" on public.messages;
create policy "Senders can delete their messages"
  on public.messages for delete to authenticated using (auth.uid() = sender_id);
