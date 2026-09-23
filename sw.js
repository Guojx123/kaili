/* Service Worker：凯里行 PWA 离线支持
 * v6 策略：全站 stale-while-revalidate
 *   - 命中缓存 → 立即返回（首屏不等网络），同时后台静默拉取最新版写回缓存
 *   - 未命中缓存 → 走网络，失败时回退到相应兜底页
 * 相比 v4 的"网络优先"，重复访问不再被网络往返卡住；部署新版后下一次导航自动生效。
 * v6 变更：标题字体改为自托管子集，纳入预缓存清单。
 */
var CACHE = "kaili-trip-v6";
var SHELL = [
  "./",
  "index.html",
  "explore.html",
  "trip.html",
  "pack.html",
  "me.html",
  "food.html",
  "css/style.css",
  "js/app.js",
  "js/layout.js",
  "js/data.js",
  "manifest.webmanifest",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/fonts/noto-serif-sc-subset.woff2",
  "assets/img/banner-kaili-400.webp",
  "assets/img/banner-kaili-800.webp"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 逐个缓存：单个资源缺失不会让整个安装失败（addAll 是"全有或全无"）
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
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

var ORIGIN = self.location.origin;

/* 缓存即时命中 + 后台更新；未命中回退网络，网络也失败再用 fallback 页 */
function staleWhileRevalidate(e, fallback) {
  var req = e.request;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var fromNetwork = fetch(req).then(function (res) {
          if (res && res.ok && res.type !== "opaque") cache.put(req, res.clone());
          return res;
        }).catch(function () { return null; });

        if (cached) return cached;          // 命中：不等待网络，后台自行更新
        return fromNetwork.then(function (res) {
          if (res) return res;
          return caches.match(fallback || req).then(function (r) { return r || Response.error(); });
        });
      });
    })
  );
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = req.url;
  if (url.indexOf("http") !== 0) return;            // 跳过 chrome-extension 等非 http(s) 请求

  // HTML 导航：缓存优先，离线回退到首页
  if (req.mode === "navigate") { staleWhileRevalidate(e, "index.html"); return; }

  // 同源静态资源（JS/CSS/图片/图标/manifest）与 Google Fonts：同样的缓存优先 + 后台更新
  if (url.indexOf(ORIGIN) === 0 || url.indexOf("fonts.g") > -1) {
    staleWhileRevalidate(e);
  }
  // 其余第三方请求不拦截，走默认网络
});
