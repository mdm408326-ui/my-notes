// Direct messages: send, load, mark read, and subscribe to live updates.
import { supabase } from './supabase'
import { normalizeUsername } from './auth'
import { findUserByUsername } from './surprises'

export async function sendMessage({ recipientUsername, body, senderUsername, senderId }) {
  const recipient = await findUserByUsername(recipientUsername)
  if (!recipient) throw new Error(`No one is using the name @${normalizeUsername(recipientUsername)}.`)
  if (recipient.id === senderId) throw new Error('You can’t message yourself.')
  if (!body.trim()) throw new Error('Write a message first.')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      recipient_id: recipient.id,
      recipient_username: recipient.username,
      sender_username: senderUsername,
      body: body.trim(),
    })
    .select()
    .single()
  if (error) throw new Error('Could not send the message.')
  return data
}

// All messages the signed-in user is part of (RLS limits to their own), oldest first.
export async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error('Could not load your messages.')
  return data || []
}

// Marks every message from `otherId` to me as read.
export async function markConversationRead(otherId, myId) {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', otherId)
    .eq('recipient_id', myId)
    .is('read_at', null)
}

// Calls onChange() whenever a new message arrives for me. Returns an unsubscribe fn.
export function subscribeToMessages(myId, onChange) {
  const channel = supabase
    .channel(`messages-${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${myId}` },
      onChange,
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
