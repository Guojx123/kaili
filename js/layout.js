/* ===== layout.js — 公共页面壳模块 =====
 * 负责注入：吸顶顶栏（定位/搜索/热词）、底部 Tab、详情浮层（预订栏）、Toast、回到顶部
 * 页面只需提供 <body data-page="home"> 与各自的内容 <main id="app">
 */
(function () {
  "use strict";

  var page = document.body.dataset.page || "home";

  /* 全站导航表 */
  var NAV = [
    { id: "home",    label: "首页", href: "index.html",
      icon: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>' },
    { id: "explore", label: "探索", href: "explore.html",
      icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>' },
    { id: "trip",    label: "行程", href: "trip.html",
      icon: '<path d="M8 3v3M16 3v3"/><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M4 11h16"/>' },
    { id: "culture", label: "苗侗", href: "culture.html",
      icon: '<path d="M12 3 4 8h16zM7 8v9M17 8v9M5 17h14M10 8v9M14 8v9"/>' },
    { id: "me",      label: "我的", href: "me.html",
      icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5"/>' }
  ];

  /* 热词 → 目标页 + 关键词 */
  var CHIPS = [
    { kw: "西江", label: "西江千户苗寨", href: "index.html?kw=西江" },
    { kw: "下司", label: "下司古镇", href: "index.html?kw=下司" },
    { kw: "酸汤鱼", label: "酸汤鱼", href: "explore.html?kw=酸汤鱼" },
    { kw: "苗绣", label: "苗绣", href: "explore.html?kw=苗绣" }
  ];

  var HAS_SEARCH = page === "home" || page === "explore";

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ---------- 顶栏 ---------- */
  var header = el(
    '<header class="topbar">' +
      '<div class="topbar-row">' +
        '<button class="loc-btn" id="locBtn" aria-label="定位">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
          '<span id="locText">凯里 · 贵州</span>' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
        '</button>' +
        '<span class="topbar-title">苗侗明珠 · 山水凯里</span>' +
      '</div>' +
      (HAS_SEARCH
        ? '<div class="search-wrap">' +
            '<svg class="search-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input id="searchInput" type="search" placeholder="搜索：西江 / 下司 / 酸汤鱼 / 苗绣" autocomplete="off" aria-label="搜索目的地、美食、非遗">' +
            '<button class="search-clear" id="searchClear" hidden aria-label="清空搜索">✕</button>' +
          '</div>' +
          '<div class="hot-chips" id="hotChips">' +
            CHIPS.map(function (c) {
              return '<a class="chip-link" href="' + c.href + '" data-kw="' + c.kw + '">' + c.label + '</a>';
            }).join("") +
          '</div>'
        : "") +
    '</header>');
  document.body.insertBefore(header, document.body.firstChild);

  /* ---------- Toast ---------- */
  document.body.appendChild(el('<div class="toast" id="toast" hidden></div>'));

  /* ---------- 详情浮层（底部固定预订栏） ---------- */
  document.body.appendChild(el(
    '<div class="detail" id="detail" hidden role="dialog" aria-modal="true">' +
      '<div class="detail-mask" data-close></div>' +
      '<div class="detail-panel">' +
        '<button class="detail-close" data-close aria-label="关闭">✕</button>' +
        '<div class="detail-body" id="detailBody"></div>' +
        '<div class="book-bar">' +
          '<button class="fav-btn" id="favBtn" aria-label="收藏此目的地" aria-pressed="false">♡</button>' +
          '<div class="book-price"><b>¥128</b><i>起 · 人均参考</i></div>' +
          '<button class="btn-cta book-btn" data-book>立即预订</button>' +
          '<button class="btn-ghost book-btn" data-consult>咨询</button>' +
        '</div>' +
      '</div>' +
    '</div>'));

  /* ---------- 回到顶部 ---------- */
  document.body.appendChild(el('<button id="topBtn" aria-label="回到顶部" hidden>↑</button>'));

  /* ---------- 底部 Tab ---------- */
  var active = NAV.filter(function (n) { return n.id === page; })[0] || NAV[0];
  document.body.appendChild(el(
    '<nav class="tabbar" aria-label="主导航">' +
      NAV.map(function (n) {
        return '<a class="tab' + (n.id === active.id ? " active" : "") + '" href="' + n.href + '" aria-label="' + n.label + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + n.icon + '</svg>' +
          '<span>' + n.label + '</span></a>';
      }).join("") +
    '</nav>'));

  /* ---------- 全站命名空间 ---------- */
  window.KL = {
    page: page,
    NAV: NAV,
    href: function (id) {
      var n = NAV.filter(function (x) { return x.id === id; })[0];
      return n ? n.href : "index.html";
    }
  };
})();
