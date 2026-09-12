// Кеш оболочки приложения: страница открывается и без сети.
// Запросы к GitHub никогда не кешируем — данные должны быть свежими.
const CACHE = 'fw-shell-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;          // GitHub API — мимо кеша
  if (event.request.method !== 'GET') return;

  // Саму страницу берём из сети, кеш — только запасной вариант на случай офлайна.
  // Иначе после обновления на GitHub телефон ещё раз показал бы старую версию.
  const isPage = event.request.mode === 'navigate' || url.pathname.endsWith('/index.html');

  if (isPage) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./'))));
    return;
  }

  // Иконки и манифест меняются редко — их отдаём из кеша сразу, обновляя в фоне.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }));
});
