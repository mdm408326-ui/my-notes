// Countdown events: a note that unlocks when its timer reaches zero.
import { supabase } from './supabase'

export async function loadCountdowns() {
  const { data, error } = await supabase
    .from('countdowns')
    .select('*')
    .order('unlock_at', { ascending: true })
  if (error) throw new Error('Could not load your countdowns.')
  return data || []
}

export async function createCountdown({ title, message, unlockAt }) {
  if (!unlockAt) throw new Error('Pick the date and time it unlocks.')
  if (new Date(unlockAt) <= new Date()) throw new Error('Pick a time in the future.')
  if (!title.trim() && !message.trim()) throw new Error('Add a title or a message.')

  const { data, error } = await supabase
    .from('countdowns')
    .insert({ title: title.trim(), message: message.trim(), unlock_at: new Date(unlockAt).toISOString() })
    .select()
    .single()
  if (error) throw new Error('Could not create the countdown.')
  return data
}

export async function deleteCountdown(id) {
  const { error } = await supabase.from('countdowns').delete().eq('id', id)
  if (error) throw new Error('Could not delete the countdown.')
}
