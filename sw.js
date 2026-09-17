/* Malorca 2026 – offline service worker */
const VERSION = 'v12';
const CORE = ['./', 'index.html', 'vylety.html', 'jidlo.html', 'prakticke.html',
  'assets/style.css', 'assets/places.js', 'assets/places.json', 'assets/icon.svg', 'manifest.webmanifest',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
const CACHE = 'malorca-' + VERSION, IMG = 'malorca-img';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('malorca-') && k !== CACHE && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const isImg = u.hostname.endsWith('wikimedia.org') || u.hostname.endsWith('openstreetmap.org') || u.hostname.endsWith('opentopomap.org') || u.hostname.endsWith('arcgisonline.com');
  if (isImg) {
    // cache-first for photos and map tiles
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  if (u.origin !== location.origin && !u.hostname.endsWith('cdnjs.cloudflare.com') && !u.hostname.endsWith('gstatic.com') && !u.hostname.endsWith('googleapis.com')) return;
  if (u.origin === location.origin) {
    // own pages and data: network-first (site changes until departure), cache when offline or slow
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = c.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
      const timeout = new Promise(res => setTimeout(() => res(null), 4000));
      const r = await Promise.race([net, timeout]);
      return r || (await hit) || (await net) || Response.error();
    }));
    return;
  }
  // CDN and fonts: stale-while-revalidate
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  }));
});
self.addEventListener('message', async e => {
  if (!e.data || e.data.type !== 'PRECACHE') return;
  const urls = e.data.urls || [], c = await caches.open(IMG);
  let done = 0, failed = 0;
  const port = e.source; const say = m => { try { if (port) port.postMessage(m); } catch (err) {} };
  const worker = async () => {
    while (urls.length) {
      const u = urls.shift();
      try { if (!(await c.match(u))) { const r = await fetch(u, { mode: 'no-cors' }); await c.put(u, r); } } catch (err) { failed++; }
      done++; if (done % 10 === 0 || !urls.length) say({ type: 'PROGRESS', done, failed, total: e.data.total });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  say({ type: 'DONE', done, failed, total: e.data.total });
});
