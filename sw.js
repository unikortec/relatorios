/* Serra Nobre – Relatórios: Service Worker */
const APP_VERSION = '3.2.8';
const SW_VERSION  = `relatorios-v${APP_VERSION}-2025-09-22`;
const CACHE_NAME  = `sn-relatorios::${SW_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const core = [
      './',
      './index.html',
      './manifest.json',
      './css/style.css',
      './js/app.js',
      './js/firebase.js',
      './js/api.js',
      './js/render.js',
      './js/modal.js',
      './js/export.js',
      './sw.js'
    ];
    await Promise.allSettled(core.map(u => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sn-relatorios::') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isHTMLRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (isHTMLRequest(req)) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
        return net;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req, { ignoreSearch: true }) || await cache.match('./index.html');
        return cached || new Response('<h1>Offline</h1>', { headers: { 'Content-Type':'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try { return await fetch(req); }
    catch {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, { ignoreSearch: true });
      return cached || new Response('', { status: 504 });
    }
  })());
});
