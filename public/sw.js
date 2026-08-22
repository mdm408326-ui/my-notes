/* Service worker for My Notes — receives reminder pushes and shows them,
   even when the site is closed. */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function readPayload(event) {
  try {
    return event.data ? event.data.json() : {}
  } catch {
    return { title: 'Reminder', body: event.data ? event.data.text() : '' }
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event)
  const title = payload.title || 'Reminder'
  const options = {
    body: payload.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      return undefined
    }),
  )
})
