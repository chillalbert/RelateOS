/**
 * Service Worker (sw.js) Background Push Handler
 * This code runs on a persistent background thread managed directly by the browser/OS,
 * enabling system-level custom prompts and tray delivery alerts even if the device
 * screen is locked or the tabs have been completely swiped closed.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[Service Worker] Installed.');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('[Service Worker] Activated.');
});

/**
 * Listens to native OS-level 'push' ticks sent via gateways (APNs / FCM)
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Received a background push broadcast.');

  let payload = {
    title: 'RelateOS Notification',
    body: 'A teammate completed an action on your birthday countdown!',
    icon: '/icon.png',
    badge: '/icon.png',
    url: '/'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open App 🤝' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  // Keep service worker alive until the notification is displayed securely to the OS tray
  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

/**
 * Handles clicks on the native operating system badge alert or specific action buttons
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Undergoer notification click gesture:', event.notification);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open corresponding app path/deeplink
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a browser tab is already open, focus it and redirect
      for (let client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
          });
        }
      }
      // If no window is currently open, spin up a clean tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
