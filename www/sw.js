// Offline cache. Bump V on each release so installed copies refresh.
const V = 'psv1', ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'tools.js', 'platform.js', 'icons/icon-192.png', 'icons/icon-512.png',
  ...['pdf.min.js', 'pdf.worker.min.js', 'pdf-lib.min.js', 'jszip.min.js', 'xlsx.full.min.js', 'mammoth.browser.min.js', 'fontkit.umd.min.js'].map(f => 'vendor/' + f)];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit || c.match('index.html'));
    return hit || net;
  }));
});
