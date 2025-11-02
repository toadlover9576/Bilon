// sw.js - minimal cache-first shell
const CACHE = 'dash-shell-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', 'https://unpkg.com/dexie@3/dist/dexie.min.js', 'https://unpkg.com/fuse.js@6'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(networkRes => {
    // optionally cache navigations or runtime requests
    return networkRes;
  })).catch(()=>caches.match('/index.html')));
});
