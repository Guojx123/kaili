/* Service Worker：凯里行 PWA 离线支持 */
var CACHE = "kaili-trip-v2";
var SHELL = [
  "./",
  "index.html",
  "explore.html",
  "trip.html",
  "culture.html",
  "me.html",
  "food.html",
  "css/style.css",
  "js/app.js",
  "js/layout.js",
  "js/data.js",
  "manifest.webmanifest",
  "assets/icon-192.png",
  "assets/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  // HTML 导航请求：网络优先，失败回退缓存（离线看行程）
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match("index.html"); });
      })
    );
    return;
  }

  // 同源 JS/CSS/manifest：网络优先（保证部署后立刻生效），失败回退缓存
  if (req.url.indexOf(self.location.origin) === 0 &&
      /\.(js|css|webmanifest|json)(\?|$)/.test(req.url)) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // 图片/字体等：缓存优先
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res.ok && (req.url.indexOf(self.location.origin) === 0 ||
            req.url.indexOf("fonts.g") > -1)) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
    })
  );
});
