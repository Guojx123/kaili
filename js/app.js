/* ===== app.js — 应用逻辑（多页模块化） =====
 * 公共壳（顶栏/Tab/详情浮层/Toast/回到顶部）由 layout.js 注入，
 * 本模块只负责页面行为，所有元素按存在性守卫，可在任一页面加载。
 */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KL = window.KL || { href: function (id) { return "index.html"; } };
  var DETAILS = window.KL_DETAILS || {};

  /* ---------- Toast ---------- */
  var toastEl = $("#toast"), toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }
  window.KLToast = toast;

  /* ---------- Tab / 站内跳转（data-goto → 页面链接） ---------- */
  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-goto]");
    if (go) { e.preventDefault(); location.href = KL.href(go.dataset.goto); }
  });

  /* ---------- 定位 ---------- */
  var locBtn = $("#locBtn");
  if (locBtn) {
    locBtn.addEventListener("click", function () {
      var el = $("#locText");
      if (!navigator.geolocation) { toast("当前浏览器不支持定位"); return; }
      el.textContent = "定位中…";
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude, lon = pos.coords.longitude;
          var dGuiyang = Math.abs(lat - 26.65) + Math.abs(lon - 106.63) * 0.9;
          var dKaili = Math.abs(lat - 26.58) + Math.abs(lon - 107.98) * 0.9;
          el.textContent = dKaili < dGuiyang ? "凯里 · 贵州" : "贵阳 · 贵州";
          toast("定位成功（仅在本机计算，不上传）");
        },
        function () {
          el.textContent = "凯里 · 贵州";
          toast("未授权定位，已显示默认城市");
        },
        { timeout: 6000 }
      );
    });
  }

  /* ---------- 吸顶搜索（首页 / 探索页） ---------- */
  var searchInput = $("#searchInput");
  if (searchInput) {
    var searchClear = $("#searchClear");
    var searchDebounce;
    var SEARCH_CARDS = [".dest-card", ".craft-card", ".food-item", ".route-card", ".note-card", ".ex-card", ".cul-card"];
    var SEARCH_GROUPS = [[".hscroll", ".dest-card"], [".craft-grid", ".craft-card"], [".food-list", ".food-item"],
      [".route-grid", ".route-card"], [".note-list", ".note-card"], [".cul-list", ".cul-card"], ["#exploreGrid", ".ex-card"]];
    // 卡片文本只在首次搜索时读一遍并缓存：避免每敲一个字都遍历几十个节点读 textContent（会强制重排）
    var searchIndex = null;
    function buildSearchIndex() {
      if (searchIndex) return searchIndex;
      searchIndex = [];
      SEARCH_CARDS.forEach(function (sel) {
        $$(sel).forEach(function (card) {
          searchIndex.push({ el: card, text: (card.textContent + " " + (card.dataset.keywords || "")).toLowerCase() });
        });
      });
      return searchIndex;
    }
    function runSearch(kw) {
      kw = (kw || "").trim();
      searchClear.hidden = !kw;
      if (!kw) {
        $$(".hide-by-search").forEach(function (el) { el.classList.remove("hide-by-search"); });
        return;
      }
      var kwLower = kw.toLowerCase();
      buildSearchIndex().forEach(function (item) {
        item.el.classList.toggle("hide-by-search", item.text.indexOf(kwLower) === -1);
      });
      SEARCH_GROUPS.forEach(function (pair) {
        var wrap = $(pair[0]);
        if (!wrap) return;
        var any = $$(pair[1], wrap).some(function (c) { return !c.classList.contains("hide-by-search"); });
        wrap.classList.toggle("hide-by-search", !any);
        var head = wrap.previousElementSibling;
        if (head && head.classList.contains("sec-head")) head.classList.toggle("hide-by-search", !any);
      });
    }
    searchInput.addEventListener("input", function () {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function () { runSearch(searchInput.value); }, 160);
    });
    searchClear.addEventListener("click", function () {
      searchInput.value = ""; runSearch(""); searchInput.focus();
    });
    // 热词 chip：本页直接筛选；跨页由 ?kw= 深链处理
    $$("#hotChips [data-kw]").forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        var target = chip.getAttribute("href").split("?")[0];
        if (target === location.pathname.split("/").pop()) {
          e.preventDefault();
          searchInput.value = chip.dataset.kw;
          runSearch(chip.dataset.kw);
          toast("已为你筛选「" + chip.dataset.kw + "」相关内容");
        }
      });
    });
    // 支持 ?kw= 深链（跨页热词跳转）
    var kwParam = new URLSearchParams(location.search).get("kw");
    if (kwParam) {
      searchInput.value = kwParam;
      runSearch(kwParam);
      toast("已为你筛选「" + kwParam + "」相关内容");
    }
  }

  /* ---------- 探索页分类筛选 ---------- */
  $$(".explore-tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      $$(".explore-tabs button").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var cat = btn.dataset.cat;
      $$(".ex-card").forEach(function (c) {
        c.classList.toggle("hidden", cat !== "all" && c.dataset.cat !== cat);
      });
    });
  });

  /* ---------- 详情浮层（底部固定预订栏） ---------- */
  var detail = $("#detail"), detailBody = $("#detailBody");
  var currentDetail = null, lastFocused = null;
  function openDetail(key) {
    var d = DETAILS[key];
    if (!d) { toast("详情整理中…"); return; }
    currentDetail = key;
    lastFocused = document.activeElement;        // 关闭后要把焦点还回去
    detailBody.innerHTML =
      "<img src='" + d.img + "' alt='" + d.title + "' loading='lazy' decoding='async'>" +
      "<h2 id='detailTitle'>" + d.title + "</h2>" +
      "<span class='d-tag'>📍 " + d.tag + "</span>" +
      "<p>" + d.desc + "</p>" +
      "<ul>" + d.tips.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
    detail.hidden = false;
    document.body.style.overflow = "hidden";
    syncFavBtn();
    // 焦点移进浮层：否则键盘用户按 Tab 会跑到被遮住的背景下文里，读屏也不会播报弹出内容
    var closeBtn = $(".detail-close", detail);
    if (closeBtn) closeBtn.focus();
  }
  function closeDetail() {
    if (detail.hidden) return;
    detail.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-detail]");
    if (t) { e.preventDefault(); openDetail(t.dataset.detail); return; }
    if (e.target.closest("[data-close]")) closeDetail();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeDetail(); return; }
    // 焦点锁在浮层内：背景只是被遮住、仍在 DOM 里，Tab 默认会走出浮层
    if (e.key !== "Tab" || !detail || detail.hidden) return;
    var f = $$("button, [href], [tabindex]:not([tabindex='-1'])", detail)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- 预订 / 咨询 ---------- */
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-book]")) {
      toast("预订通道：跳转至对应平台完成支付（演示环境）");
    }
    if (e.target.closest("[data-consult]")) {
      toast("已接入本地向导，工作时间 9:00–22:00 秒回（演示环境）");
    }
  });

  /* ---------- 收藏（localStorage，全站可用） ---------- */
  var FAV_KEY = "kaili-fav-2026";
  var favState = (function () {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || {}; } catch (e) { return {}; }
  })();
  var favBtn = $("#favBtn");
  function favCount() {
    var n = Object.keys(favState).filter(function (k) { return favState[k]; }).length;
    var fc = $("#favCount");
    if (fc) fc.textContent = n + " 个";
    return n;
  }
  function syncFavBtn() {
    if (!favBtn) return;
    var on = currentDetail && !!favState[currentDetail];
    favBtn.textContent = on ? "❤" : "♡";
    favBtn.classList.toggle("on", !!on);
    favBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (favBtn) {
    favBtn.addEventListener("click", function () {
      if (!currentDetail) return;
      favState[currentDetail] = !favState[currentDetail];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(favState)); } catch (e) {}
      syncFavBtn(); favCount();
      var name = DETAILS[currentDetail] ? DETAILS[currentDetail].title : currentDetail;
      toast(favState[currentDetail] ? "已收藏「" + name + "」" : "已取消收藏「" + name + "」");
    });
  }
  favCount();
  var meFav = $("#meFav");
  if (meFav) {
    meFav.addEventListener("click", function () {
      var names = Object.keys(favState).filter(function (k) { return favState[k] && DETAILS[k]; })
        .map(function (k) { return DETAILS[k].title; });
      toast(names.length ? "❤️ 已收藏：" + names.join("、") : "还没有收藏，去目的地卡片看看吧");
    });
  }

  /* ---------- 打包清单（行程页 / 我的页联动） ----------
   * 条目 key 取 <li data-pack="...">（由正文派生，增删其他条目互不影响）。
   * 旧版本用「分类标题::序号」，中间插一条会让后面所有勾选整体错位，
   * 这里保留旧算法只为把老数据一次性迁移到新 key，迁移后旧 key 删除。 */
  var PACK_KEY = "kaili-pack-2026";
  function loadPack() {
    try { return JSON.parse(localStorage.getItem(PACK_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePack(s) { try { localStorage.setItem(PACK_KEY, JSON.stringify(s)); } catch (e) {} }
  var packState = loadPack();
  var packList = $("#packList");
  function legacyKey(li, i) {                     // 旧算法，仅用于迁移
    var card = li.closest(".pack-card");
    var head = card ? card.querySelector("h3") : null;
    return (head ? head.textContent : "card") + "::" + i;
  }
  function markLi(li, on) {
    li.classList.toggle("done", on);
    li.setAttribute("aria-checked", on ? "true" : "false");   // 读屏要能念出勾选状态
  }
  function togglePack() {
    if (!packList) return;
    packList.hidden = !packList.hidden;
    if (!packList.hidden) packList.scrollIntoView({ behavior: "smooth", block: "start" });
    var pt = $("#packToggle");
    if (pt) pt.textContent = packList.hidden ? "🧳 打包清单" : "🙈 收起清单";
  }
  if (packList) {
    var migrated = false;
    $$("#packList li").forEach(function (li, i) {
      var key = li.dataset.pack || legacyKey(li, i);
      // 老数据迁移：旧 key 勾过、新 key 还没记录 → 沿用旧值后删掉旧 key
      if (li.dataset.pack) {
        var old = legacyKey(li, i);
        if (packState[old] && !(key in packState)) {
          packState[key] = true;
          delete packState[old];
          migrated = true;
        }
      }
      markLi(li, !!packState[key]);
      li.addEventListener("click", toggle);
      // 键盘可达：<li role="checkbox" tabindex="0">，空格/回车等价于点击
      li.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
          e.preventDefault();          // 空格默认会滚动页面
          toggle();
        }
      });

      function toggle() {
        var on = !li.classList.contains("done");
        markLi(li, on);
        packState[key] = on;
        savePack(packState);
      }
    });
    if (migrated) savePack(packState);
    var pt = $("#packToggle");
    if (pt) pt.addEventListener("click", togglePack);
    if (location.hash === "#pack") { packList.hidden = false; }
  }
  var mePack = $("#mePack");
  if (mePack) mePack.addEventListener("click", function () { location.href = KL.href("pack"); });
  var meClear = $("#meClear");
  if (meClear) {
    meClear.addEventListener("click", function () {
      packState = {}; savePack(packState);
      $$("#packList li").forEach(function (li) { markLi(li, false); });
      toast("清单勾选已重置");
    });
  }

  /* ---------- PWA：注册 Service Worker + 离线下载 ---------- */
  var OFF_KEY = "kaili-offline-ok";
  var CACHE_NAME = "kaili-trip-v8";   // 必须与 sw.js 的 CACHE 一致，否则离线缓存会被 SW 激活时清理掉
  var PAGES = ["index.html", "explore.html", "trip.html", "pack.html", "me.html", "food.html"];
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(function () {
      if (localStorage.getItem(OFF_KEY) === "1") {
        var os = $("#offlineState");
        if (os) os.textContent = "已就绪 ✓";
      }
    }).catch(function () {});
  }
  function cacheAll() {
    if (!("caches" in window)) { toast("当前浏览器不支持离线缓存"); return; }
    var urls = ["./"].concat(PAGES).concat([
      "css/style.css", "js/app.js", "js/layout.js", "js/data.js", "manifest.webmanifest",
      "assets/icon-192.png", "assets/icon-512.png",
      "assets/fonts/noto-serif-sc-subset.woff2",
      "assets/img/banner-kaili-400.webp", "assets/img/banner-kaili-800.webp"]);
    ["xijiang", "xiasi", "langde", "wudong", "qingyun", "xiulitao",
     "craft-miaoxiu", "craft-yinshi", "craft-ran", "village-cunt", "food-suantang", "moon"]
      .forEach(function (n) { urls.push("assets/img/" + n + "-400.webp", "assets/img/" + n + "-800.webp"); });
    caches.open(CACHE_NAME).then(function (c) {
      // 分批预取（每批 6 个）：一次并发 30+ 请求会把连接和带宽瞬间打满，弱网下反而更慢甚至超时
      var i = 0;
      function nextBatch() {
        if (i >= urls.length) return Promise.resolve();
        var batch = urls.slice(i, i + 6);
        i += 6;
        return Promise.all(batch.map(function (u) {
          return c.add(u).catch(function () {});
        })).then(nextBatch);
      }
      return nextBatch();
    }).then(function () {
      localStorage.setItem(OFF_KEY, "1");
      var os = $("#offlineState");
      if (os) os.textContent = "已就绪 ✓";
      toast("✅ 行程已缓存，离线也能看");
    }).catch(function () { toast("部分资源缓存失败，请检查网络"); });
  }
  var dlBtn = $("#dlBtn");
  if (dlBtn) dlBtn.addEventListener("click", cacheAll);
  var meOffline = $("#meOffline");
  if (meOffline) meOffline.addEventListener("click", cacheAll);

  /* ---------- 出发倒计时（首页 Banner） ---------- */
  (function countdown() {
    var el = $("#cdText");
    if (!el) return;
    var dep = new Date(2026, 8, 24); // 2026-09-24 出发
    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var d = Math.round((dep - today) / 86400000);
    if (d > 1) el.textContent = "距出发 " + d + " 天";
    else if (d === 1) el.textContent = "明天出发 🎑";
    else if (d === 0) el.textContent = "今天出发 🎑";
    else if (d >= -3) el.textContent = "行程进行中 · Day " + (1 - d);
    else el.textContent = "旅程圆满 · 载梦而归";
  })();

  /* ---------- PWA 安装引导（我的页） ---------- */
  var deferredPrompt = null, installBtn = $("#meInstall");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var s = $("#installState");
    if (s) s.textContent = "添加到主屏幕";
  });
  window.addEventListener("appinstalled", function () {
    var s = $("#installState");
    if (s) s.textContent = "已安装 ✓";
    deferredPrompt = null;
  });
  if (installBtn) {
    installBtn.addEventListener("click", function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
      } else if (window.matchMedia("(display-mode: standalone)").matches) {
        $("#installState").textContent = "已安装 ✓";
        toast("已经在主屏幕啦");
      } else {
        toast("iOS：Safari 分享 → 添加到主屏幕；Android：浏览器菜单 → 安装应用");
      }
    });
  }

  /* ---------- 回到顶部（全站） ---------- */
  // 只在显隐状态真正翻转时才写 DOM，避免每帧滚动都触发属性写入与样式重算
  var topBtn = $("#topBtn"), ticking = false, topBtnShown = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var show = window.scrollY >= 480;
      if (topBtn && show !== topBtnShown) { topBtn.hidden = !show; topBtnShown = show; }
      ticking = false;
    });
  }, { passive: true });
  if (topBtn) topBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ---------- 断网提示 ---------- */
  window.addEventListener("offline", function () {
    toast("📴 网络已断开，已缓存行程仍可离线查看");
  });
  window.addEventListener("online", function () {
    toast("📶 网络已恢复");
  });
})();
