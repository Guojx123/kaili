/* ===== layout.js — 公共壳模块（运行时部分） =====
 * 顶栏与底部 Tab 现在是各页 HTML 里的静态标记，由 tools/build-shell.py 统一生成。
 *
 * 为什么不再用 JS 注入：layout.js 是 <script defer>，浏览器解析到 body 内容就已
 * 开始渐进渲染，而 defer 脚本要等整份 HTML 解析完才执行。慢网下这段间隔里页面是
 * "有内容、没顶栏、没底部 Tab"的，随后壳补上、整页往下跳一下 —— 就是点击底部
 * Tab 时看到的闪。写进 HTML 后首帧就带着壳，不存在补的过程。
 *
 * 本模块只负责运行时才需要的那几个元素（初始都是 hidden，晚注入不会造成视觉闪动）：
 * 详情浮层、Toast、回到顶部，以及全站命名空间 window.KL。
 * 改壳（导航项 / 热词 / 顶栏文案）请改 tools/build-shell.py 的模板后重跑。
 */
(function () {
  "use strict";

  var page = document.body.dataset.page || "home";

  /* 全站导航表：必须与 tools/build-shell.py 里的 NAV 保持一致 */
  var NAV = [
    { id: "home",    label: "首页", href: "index.html" },
    { id: "explore", label: "探索", href: "explore.html" },
    { id: "trip",    label: "行程", href: "trip.html" },
    { id: "pack",    label: "打包", href: "pack.html" },
    { id: "me",      label: "我的", href: "me.html" },
    { id: "food",    label: "美食", href: "food.html", hidden: true }
  ];

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

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
