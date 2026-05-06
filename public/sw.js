/* Service Worker for CareQueue Push Notifications */

self.addEventListener('push', (event) => {
  // For no-payload push (empty body), show a default notification
  const title = '🔔 CareQueue — Your Turn!';
  const body = 'You are next! Please head to the clinic now.';

  let data = { title, body };

  try {
    if (event.data && event.data.text()) {
      const parsed = JSON.parse(event.data.text());
      data = { title: parsed.title || title, body: parsed.body || parsed.message || body };
    }
  } catch (e) {
    // No payload or invalid JSON — use defaults
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'carequeue-turn',
    renotify: true,
    requireInteraction: true,
    data: { url: '/my-appointments' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
