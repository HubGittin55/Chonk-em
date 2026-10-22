'use strict';
/* CHONK'EM service worker — cache-first offline shell (2026-10-16).
   Core files precache on install; sprites and everything else runtime-cache
   on first fetch. Versioned cache name: bump on asset changes. */

const CACHE = 'chonk-em-v1';
const CORE = [
  '.', 'index.html', 'manifest.webmanifest',
  'css/style.css',
  'js/audio.js', 'js/physics.js', 'js/levels.js', 'js/barrels.js',
  'js/conveyor.js', 'js/vacuum.js', 'js/catphysics.js', 'js/cats.js',
  'js/input.js', 'js/fx.js', 'js/save.js', 'js/weighin.js', 'js/main.js',
  'icons/icon-192.svg', 'icons/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
