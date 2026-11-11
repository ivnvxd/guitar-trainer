/* Offline cache. Change VERSION when you publish new files, so browsers fetch them again. */
const VERSION = 'guitar-trainer-1';
const FILES = [
  './', 'index.html', 'css/app.css', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest',
  'js/theory.js', 'js/audio.js', 'js/fretboard.js', 'js/core.js', 'js/progress.js', 'js/library.js',
  'js/train.js', 'js/drills-ear.js', 'js/drills-neck.js', 'js/drills-keys.js', 'js/tools.js', 'js/pages.js', 'js/app.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, so a new version shows at once; the cache answers when you are offline.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then(response => {
      const copy = response.clone();
      caches.open(VERSION).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
