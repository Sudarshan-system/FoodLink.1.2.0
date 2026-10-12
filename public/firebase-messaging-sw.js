// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "atomic-subject-c3skh",
  appId: "1:799494278662:web:524831ae9a1baadd663d87",
  apiKey: "AIzaSyA5cD860h2LAHosJgd-y5t2DixdhcRt69U",
  authDomain: "atomic-subject-c3skh.firebaseapp.com",
  messagingSenderId: "799494278662"
};

firebase.initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'FoodLink Alert';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Food status has changed.',
      icon: payload.notification?.icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.data?.tag || 'foodlink-status-alert',
      data: payload.data || {},
      vibrate: [200, 100, 200],
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Messaging init note:', err);
}

// Fallback native push event listener
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.notification?.title || data.title || 'FoodLink Status Update';
      const options = {
        body: data.notification?.body || data.body || 'A donation or delivery status was updated.',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: data.data || data,
        vibrate: [200, 100, 200],
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      const title = 'FoodLink Status Update';
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
