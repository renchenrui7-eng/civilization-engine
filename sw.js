/* 文明引擎 Service Worker
 * 策略：network-first（网络优先）——保证线上永远最新版本，
 *      断网/弱网时用缓存兜底，实现离线可用。
 */
const CACHE = 'civ-mixing-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // 只缓存同源资源（页面/JS/CSS/图片），跨域资源不缓存
        if (res && res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((m) => m || caches.match('./index.html'))
      )
  );
});
