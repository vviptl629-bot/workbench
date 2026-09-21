const CACHE = 'wb-pwa-v69';
const ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './happy-stroll.mp3'];

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

/* v68：到点通知出现在锁屏之上时，用户在通知条上直接操作 ——
   「稍后 5 分钟」→ ./?fp=snooze（页面收到后起一个延时再提醒，同样带保活音）；
   「知道了」→ ./?fp=ack（页面停掉还在响的铃声）；点通知本体等同 ack。
   注意：已存在的窗口用 navigate 而不是新开，避免同一个 PWA 被开成两个实例、各跑一份计时。 */
self.addEventListener('notificationclick', e => {
  const act = e.action || 'ack';
  e.notification.close();
  const url = act === 'snooze' ? './?fp=snooze' : './?fp=ack';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.indexOf(self.registration.scope) === 0) {
          try { if ('navigate' in c) c.navigate(url); } catch (_) { }
          return 'focus' in c ? c.focus() : null;
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : null;
    }).catch(() => { })
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
