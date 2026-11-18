/* Offline cache. Change VERSION when you publish new files, so browsers fetch them again.
   It matches GT.version in js/core.js. */
const VERSION = 'guitar-trainer-2.1.0';
const FILES = [
  './', 'index.html', 'css/app.css', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest',
  'fonts/geist.woff2', 'fonts/literata-names.woff2', 'icon-maskable-512.png',
  'js/theory.js', 'js/rhythm.js', 'js/audio.js', 'js/fretboard.js', 'js/core.js', 'js/progress.js', 'js/library.js',
  'js/player.js', 'js/drumcut.js', 'js/vendor/signalsmith-stretch.js',
  'js/train.js', 'js/drills-ear.js', 'js/drills-neck.js', 'js/drills-keys.js', 'js/drills-rhythm.js', 'js/tools.js', 'js/pages.js', 'js/app.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, so a new version shows at once. The stored copy answers when you are offline, when the network
// gives an error, or when it takes more than 3 seconds. Only good answers are stored, never an error page.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const stored = await caches.match(event.request, { ignoreSearch: true });
    const network = fetch(event.request, { cache: 'no-cache' }).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(VERSION).then(cache => cache.put(event.request, copy)); }
      return response.ok || !stored ? response : stored;
    });
    // With no stored copy, wait for the network. A page with no network at all gets the start page.
    if (!stored) return network.catch(() => event.request.mode === 'navigate' ? caches.match('index.html') : Response.error());
    const slow = new Promise(resolve => setTimeout(() => resolve(stored), 3000));
    return Promise.race([network.catch(() => stored), slow]);
  })());
});
