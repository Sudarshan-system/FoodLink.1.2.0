const CACHE_NAME = 'foodlink-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always let network handle all dev/vite/script/api requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/@vite/') ||
    event.request.url.includes('/src/') ||
    event.request.url.includes('/node_modules/') ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('maps.googleapis.com')
  ) {
    return;
  }

  // Network first for all requests
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Push notification listener for FCM & Web Push
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.notification?.title || data.title || 'FoodLink Alert';
      const options = {
        body: data.notification?.body || data.body || 'Status update for your food rescue.',
        icon: data.notification?.icon || '/favicon.svg',
        badge: '/favicon.svg',
        data: data.data || data,
        vibrate: [200, 100, 200],
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      const title = 'FoodLink Alert';
      const options = {
        body: event.data.text(),
        icon: '/favicon.svg',
        badge: '/favicon.svg',
      };
      event.waitUntil(self.registration.showNotification(title, options));
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
