// Supabase Edge Function: send-reminders
// Runs on a schedule (see supabase/README-reminders.md). Finds notes whose
// reminder time has arrived and have not been notified yet, then sends a Web
// Push notification to every device the note's owner has subscribed.
//
// Deploy:  supabase functions deploy send-reminders
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:reminders@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const nowIso = new Date().toISOString()

  // Reminders that are due and have not been pushed yet.
  const { data: dueNotes, error } = await supabase
    .from('notes')
    .select('id, title, owner_id, reminder_at')
    .not('reminder_at', 'is', null)
    .lte('reminder_at', nowIso)
    .is('notified_at', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  for (const note of dueNotes ?? []) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('owner_id', note.owner_id)

    const payload = JSON.stringify({
      title: 'Reminder',
      body: note.title,
      tag: `note-${note.id}`,
      url: '/',
    })

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        sent += 1
      } catch (err) {
        // 404 / 410 means the browser dropped the subscription — remove it.
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }

    // Mark done even if there were no devices, so we don't re-scan it forever.
    await supabase.from('notes').update({ notified_at: nowIso }).eq('id', note.id)
  }

  return new Response(JSON.stringify({ due: dueNotes?.length ?? 0, sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
