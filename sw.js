/* =========================================================
   SERVICE WORKER / SERVICE WORKER
   Basic shell-first cache for app shell and core pages
   Базовый shell-first cache для app shell и основных страниц
========================================================= */

const CACHE_NAME = 'ai-center-shell-v1';

/* =========================================================
   PRECACHE ASSETS / ПРЕДЗАГРУЗКА ОСНОВНЫХ РЕСУРСОВ
   Core shell files and key pages for faster startup
   Основные shell-файлы и ключевые страницы для быстрого старта
========================================================= */
const PRECACHE_URLS = [
  './',
  './app.html?tenant=fitline',
  './app.html',
  './home.html',
  './my-agent.html',
  './modules.html',
  './shared-chat.html',
  './partner.html',
  './payments.html',
  './settings.html',
  './css/styles.css',
  './css/modules.css',
  './js/runtime.js',
  './js/tenant-loader.js',
  './js/app-shell.js',
  './config/tenants/fitline.json'
];

/* =========================================================
   INSTALL / УСТАНОВКА
   Caches core files during service worker installation
   Кеширует основные файлы при установке service worker
========================================================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

/* =========================================================
   ACTIVATE / АКТИВАЦИЯ
   Removes outdated caches and activates current service worker
   Удаляет старые кеши и активирует текущий service worker
========================================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* =========================================================
   FETCH / ПЕРЕХВАТ ЗАПРОСОВ
   Uses cache-first strategy for same-origin requests
   Использует cache-first стратегию для same-origin запросов
========================================================= */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        const responseClone = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return networkResponse;
      });
    })
  );
});
