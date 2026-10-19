// Мінімальний service worker: потрібен для встановлення PWA.
// API й дані не кешуємо; лише віддаємо запасну сторінку, коли немає мережі.
const CACHE = 'sinfo-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  event.respondWith(
    fetch(req).catch(() => caches.match('/').then((r) => r ?? Response.error())),
  )
})
