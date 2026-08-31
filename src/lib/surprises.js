// Surprise notes: send a note to another user by @username, delivered on a date.
import { supabase } from './supabase'
import { normalizeUsername } from './auth'

export async function findUserByUsername(username) {
  const clean = normalizeUsername(username)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', clean)
    .maybeSingle()
  if (error) throw new Error('Could not look up that user.')
  return data // null if not found
}

// Schedule a surprise for a recipient. `deliverOn` is a YYYY-MM-DD string.
export async function sendSurprise({ recipientUsername, title, message, deliverOn, senderUsername, senderId }) {
  const recipient = await findUserByUsername(recipientUsername)
  if (!recipient) throw new Error(`No one is using the name @${normalizeUsername(recipientUsername)}.`)
  if (recipient.id === senderId) throw new Error('You can’t send a surprise to yourself.')
  if (!deliverOn) throw new Error('Pick the date to deliver it on.')
  if (!title.trim() && !message.trim()) throw new Error('Write a message for your surprise.')

  const { error } = await supabase.from('surprise_notes').insert({
    recipient_id: recipient.id,
    sender_username: senderUsername,
    title: title.trim(),
    message: message.trim(),
    deliver_on: deliverOn,
  })
  if (error) throw new Error('Could not schedule the surprise. Please try again.')
}

// Returns { received, sent }. RLS makes sure recipients only get delivered ones.
export async function loadSurprises(myId) {
  const { data, error } = await supabase
    .from('surprise_notes')
    .select('*')
    .order('deliver_on', { ascending: false })
  if (error) throw new Error('Could not load your surprises.')
  const received = (data || []).filter((s) => s.recipient_id === myId)
  const sent = (data || []).filter((s) => s.sender_id === myId)
  return { received, sent }
}

export async function cancelSurprise(id) {
  const { error } = await supabase.from('surprise_notes').delete().eq('id', id)
  if (error) throw new Error('Could not cancel that surprise.')
}
