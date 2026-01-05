const CACHE_NAME = 'impostor-v2'; // Bump de versão
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/client.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Força a atualização imediata
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('socket.io')) return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Estratégia Stale-while-revalidate (Usa cache, mas atualiza em background)
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            });
            return response || fetchPromise;
        })
    );
});