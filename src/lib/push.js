// Web Push helpers. The service worker (public/sw.js) receives the pushes; this
// module registers it, asks the user for permission, and stores the device's
// push subscription in Supabase so the reminder job can reach it later.
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export const notificationPermission = () =>
  'Notification' in window ? Notification.permission : 'unsupported'

// VAPID keys are base64url; the Push API needs them as a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

// Asks for permission, subscribes this device, and saves it to Supabase.
// Returns true on success; throws an Error with a friendly message otherwise.
export async function enablePushNotifications() {
  if (!pushSupported()) {
    throw new Error('This device or browser cannot show push notifications.')
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Notifications are not configured yet (missing VITE_VAPID_PUBLIC_KEY).')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('You did not allow notifications, so reminders can’t reach this device.')
  }

  let subscription
  try {
    const registration = await navigator.serviceWorker.ready
    subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    throw new Error(`Subscribe step failed: ${err?.message || err}`, { cause: err })
  }

  const json = subscription.toJSON()
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      owner_id: userData.user?.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.error('[push] save failed:', error)
    throw new Error(`Save step failed: ${error.message}`)
  }

  return true
}
