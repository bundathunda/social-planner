const CACHE_NAME = 'social-planner-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg'
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for HTML, cache-first for other assets ──────────────
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith(self.location.origin)) return;

  const isHTML = event.request.destination === 'document' ||
                 event.request.url.endsWith('.html');

  if (isHTML) {
    // Always fetch HTML fresh — fall back to cache if offline
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for icons, manifest, etc.
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
      })
    );
  }
});

// ── Push Notifications ─────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Social Planner', body: 'Time to reach out!', tag: 'social-planner' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon.svg',
      badge: './icon.svg',
      tag: data.tag,
      requireInteraction: false,
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(all => {
      if (all.length > 0) {
        const client = all.find(c => c.focused) || all[0];
        return client.focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});

// ── Background Sync ────────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'check-overdue') {
    // Background check would notify about overdue friends
    // In a real app with a server this would fetch from API
    console.log('[SW] Background sync: check-overdue');
  }
});
