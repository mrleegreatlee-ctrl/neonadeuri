/* 너나들이 service worker
   전략: HTML은 네트워크 우선(항상 최신 반영) + 오프라인 시 캐시 폴백.
   외부 도메인(카카오맵·Supabase·CDN)은 절대 가로채지 않음 → 지도/API 무간섭.
   버전 문자열(CACHE)을 올리면 구 캐시가 자동 정리됨. */
const CACHE = 'neonadeuri-v1';
const CORE = ['./', './index.html',
  './pwa/icon-192.png', './pwa/icon-512.png', './pwa/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // 외부 출처(카카오·Supabase·CDN 등)는 서비스워커가 손대지 않는다.
  if (url.origin !== location.origin) return;

  var isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isHTML) {
    // 네트워크 우선: 온라인이면 항상 최신 index.html. 실패 시 캐시.
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  // 그 외 동일 출처 정적 자원: 캐시 우선, 없으면 네트워크 후 캐시.
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
