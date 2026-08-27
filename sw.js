const CACHE = 'wb-pwa-v15';
const ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      // 新版本装好后，强制已打开的页面重载到新代码（解决安卓 PWA 更新卡住）
      .then(() => self.clients.matchAll({type:'window',includeUncontrolled:true})
        .then(cls => cls.forEach(c => { try{ c.navigate(c.url); }catch(_){} })))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    // 导航请求：先网络拿最新，失败再用缓存（离线可用）
    e.respondWith(
      fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    // 其他资源：缓存优先，缺失再网络
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, cp)); return r; })
        .catch(() => c))
    );
  }
});
