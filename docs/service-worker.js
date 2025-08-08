// Service Worker for Simple Calculator PWA - offline functionality and caching
const CACHE_NAME = 'calculator-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/calculator.css',
  '/calculator.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install event - cache calculator assets (app shell)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Calculator PWA: Opened cache', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Activate this service worker immediately after installation
        return self.skipWaiting();
      })
  );
});

// Activate event - take control and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Calculator PWA: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Start controlling all clients without reload
      return self.clients.claim();
    })
  );
});

// Fetch event - smart caching strategy tuned for a simple calculator app
self.addEventListener('fetch', event => {
  event.respondWith((async () => {
    const req = event.request;

    // Treat navigation / HTML requests: network-first, fallback to cache/offline page
    if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
      try {
        const networkResponse = await fetch(req);
        // Update cache with the latest HTML for offline use
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        // If offline, return cached page or offline fallback
        const cached = await caches.match(req);
        return cached || await caches.match('/offline.html');
      }
    }

    // For other requests (CSS/JS/images), prefer cache, then network; cache useful responses
    const cachedResponse = await caches.match(req);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(req);
      // Cache runtime assets that benefit offline (scripts, styles, icons)
      if (req.method === 'GET' && (req.destination === 'script' || req.destination === 'style' || req.destination === 'image')) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, networkResponse.clone());
      }
      return networkResponse;
    } catch (err) {
      // If an image failed to load and we have a fallback icon, return it
      if (req.destination === 'image') {
        return caches.match('/icons/icon-192.png');
      }
      // Generic offline response for other requests
      return new Response('Offline - simple calculator is not available right now.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    }
  })());
});

// Listen for messages from the page (e.g., to trigger skipWaiting on update)
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});