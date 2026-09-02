// Supabase Edge Function: reminder + surprise delivery.
// Runs every minute (via cron). Sends push notifications for:
//   1. Personal note reminders whose time has arrived.
//   2. Surprise notes whose delivery date has arrived (to the recipient).
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:reminders@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

const supabase = createClient(supabaseUrl, serviceRoleKey)

// Sends `payload` to every device belonging to `userId`. Cleans up dead subs.
async function pushToUser(userId: string, payload: string): Promise<number> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('owner_id', userId)

  let count = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      count += 1
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }
  return count
}

Deno.serve(async () => {
  const nowIso = new Date().toISOString()
  const today = nowIso.slice(0, 10)
  let sent = 0

  // 1. Personal reminders that are due.
  const { data: dueNotes } = await supabase
    .from('notes')
    .select('id, title, owner_id')
    .not('reminder_at', 'is', null)
    .lte('reminder_at', nowIso)
    .is('notified_at', null)

  for (const note of dueNotes ?? []) {
    sent += await pushToUser(
      note.owner_id,
      JSON.stringify({ title: 'Reminder', body: note.title, tag: `note-${note.id}`, url: '/' }),
    )
    await supabase.from('notes').update({ notified_at: nowIso }).eq('id', note.id)
  }

  // 2. Surprise notes whose delivery date has arrived.
  const { data: dueSurprises } = await supabase
    .from('surprise_notes')
    .select('id, title, message, sender_username, recipient_id')
    .lte('deliver_on', today)
    .is('delivered_at', null)

  for (const s of dueSurprises ?? []) {
    sent += await pushToUser(
      s.recipient_id,
      JSON.stringify({
        title: `🎁 A surprise from @${s.sender_username}`,
        body: s.title || s.message || 'Open to see your surprise!',
        tag: `surprise-${s.id}`,
        url: '/',
      }),
    )
    await supabase.from('surprise_notes').update({ delivered_at: nowIso }).eq('id', s.id)
  }

  // 3. New chat messages that are still unread and not yet pushed.
  const { data: newMessages } = await supabase
    .from('messages')
    .select('id, body, sender_username, recipient_id')
    .is('notified_at', null)
    .is('read_at', null)

  for (const m of newMessages ?? []) {
    sent += await pushToUser(
      m.recipient_id,
      JSON.stringify({
        title: `💬 @${m.sender_username}`,
        body: m.body.length > 120 ? `${m.body.slice(0, 120)}…` : m.body,
        tag: `msg-${m.id}`,
        url: '/',
      }),
    )
    await supabase.from('messages').update({ notified_at: nowIso }).eq('id', m.id)
  }

  // 4. Countdown events that have just unlocked.
  const { data: unlocked } = await supabase
    .from('countdowns')
    .select('id, title, owner_id')
    .lte('unlock_at', nowIso)
    .is('notified_at', null)

  for (const c of unlocked ?? []) {
    sent += await pushToUser(
      c.owner_id,
      JSON.stringify({
        title: '🎉 A countdown unlocked!',
        body: c.title || 'Open to see what was waiting.',
        tag: `countdown-${c.id}`,
        url: '/',
      }),
    )
    await supabase.from('countdowns').update({ notified_at: nowIso }).eq('id', c.id)
  }

  return new Response(
    JSON.stringify({
      reminders: dueNotes?.length ?? 0,
      surprises: dueSurprises?.length ?? 0,
      messages: newMessages?.length ?? 0,
      countdowns: unlocked?.length ?? 0,
      sent,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
