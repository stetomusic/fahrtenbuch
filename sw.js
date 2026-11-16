// Offline cache for the app shell. Maps, address lookup and routing need a connection.
const CACHE = 'fahrtenbuch-v10';
const SHELL = ['./', './index.html', './manifest.webmanifest', './fb-icon-180.png', './fb-icon-192.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.searchParams.has('check')) return;
  const sameOrigin = url.origin === self.location.origin;
  const staticCdn = url.host === 'unpkg.com' || url.host === 'cdn.jsdelivr.net' || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com');
  // icons and the manifest go straight to the network: the iPhone reads them when adding to the home screen
  if (sameOrigin && /\.(png|svg|webmanifest)$/.test(url.pathname)) return;
  if (sameOrigin) {
    // Network first, so updates arrive; the cache answers when offline or when the network takes longer than 3.5 s
    // (weak reception in the car or garage must not leave the app on a white screen).
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
    const cached = () => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    e.respondWith(Promise.race([net.catch(() => null), new Promise(r => setTimeout(() => r(null), 3500))])
      .then(r => r || cached().then(c => c || net)).catch(() => Response.error()));
    e.waitUntil(net.catch(() => {}));
  } else if (staticCdn) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
  }
});
