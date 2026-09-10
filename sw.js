const CACHE = 'wb-pwa-v40';
const ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    // D1：单个资源 404 不再让整个 install 失败（旧版 addAll 会全盘中断离线能力）
    caches.open(CACHE).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(()=>null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      // D2：不再强制 reload（会打断用户输入）。改为通知页面显示「有新版本」提示条，
      // 由页面在无聚焦输入框、无打开弹层时才自动重载。
      .then(() => self.clients.matchAll({type:'window',includeUncontrolled:true})
        .then(cls => cls.forEach(c => { try{ c.postMessage({type:'SW_UPDATED',cache:CACHE}); }catch(_){} })))
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
