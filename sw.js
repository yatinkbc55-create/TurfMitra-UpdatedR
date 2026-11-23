const V = 'turfmitra-v6';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/i18n.js', 'js/logic.js', 'js/store.js', 'js/license.js', 'js/config.js', 'js/fx.js', 'js/facilities.js', 'assets/logo/logo.png', 'assets/i18n/en.json', 'assets/i18n/mr.json', 'assets/i18n/hi.json', 'manifest.webmanifest', 'icons/icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(V).then((c) => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
