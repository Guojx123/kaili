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

  /* 两地距离（km）：平面近似，够用且不引入任何外部依赖 */
  function kmBetween(lat1, lon1, lat2, lon2) {
    var dy = (lat1 - lat2) * 111;
    var dx = (lon1 - lon2) * 111 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }

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
          // 平面近似：1 度纬度 ≈ 111km，1 度经度 ≈ 111km × cos(纬度)。
          // 比原来「经纬度差直接相加」的曼哈顿距离准得多 —— 那套算法下
          // 在广州点定位也会判定成贵阳。
          var dKaili = kmBetween(lat, lon, 26.58, 107.98);
          var dGuiyang = kmBetween(lat, lon, 26.65, 106.63);
          var near = dKaili <= dGuiyang
            ? { name: "凯里", km: dKaili }
            : { name: "贵阳", km: dGuiyang };
          var km = Math.round(near.km);
          // 50km 内算「已经到了」，否则如实报距离，别硬说人在贵阳
          if (km <= 50) {
            el.textContent = near.name + " · 贵州";
            toast("定位成功（仅在本机计算，不上传）");
          } else {
            el.textContent = "距" + near.name + " " + km + " km";
            toast("定位成功：你离" + near.name + "还有约 " + km + " km");
          }
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
      // 注意用 $$ 遍历：美食页有 5 个 .food-list，只取第一个的话
      // 后面几个分组的标题不会跟着隐藏，搜索完会剩下一堆空的「酸汤类 / 牛肉类」小标题
      SEARCH_GROUPS.forEach(function (pair) {
        $$(pair[0]).forEach(function (wrap) {
          var any = $$(pair[1], wrap).some(function (c) { return !c.classList.contains("hide-by-search"); });
          wrap.classList.toggle("hide-by-search", !any);
          var head = wrap.previousElementSibling;
          if (head && head.classList.contains("sec-head")) head.classList.toggle("hide-by-search", !any);
        });
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
  var bookPrice = $("#bookPrice"), bookPriceNote = $("#bookPriceNote");
  var currentDetail = null, lastFocused = null;

  /* 让 data-detail 卡片对键盘/读屏可用：
     景点类本来就是 <button>/<a>（原生可聚焦），但美食 / 文化 / 游记是 <div>/<article>，
     CSS 里写了 :active 反馈、看着可点，实际 Tab 不到。这里统一补 role + tabindex，
     省得以后新增卡片时又漏掉 —— 补在 JS 里比手写 60 处 HTML 属性可靠。 */
  $$("[data-detail]").forEach(function (el) {
    if (el.tagName === "BUTTON" || el.tagName === "A") return;
    if (!el.hasAttribute("role")) el.setAttribute("role", "button");
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  });

  /* ---------- 手绘 SVG 图标：详情浮层头图（无真实照片的条目用，替代系统 emoji） ----------
     统一 320x180（16:9，同照片头图比例）、靛蓝夜景底 + 项目配色。
     加新条目时在 data.js 里写 icon:"类型"，这里的键要能对上。 */
  var ICON_BG =
    "<rect width='320' height='180' fill='#1B3A5C'/>" +
    "<g fill='#FAF7F0' opacity='.05'>" +
    "<rect x='20' y='16' width='34' height='34' transform='rotate(45 37 33)'/>" +
    "<rect x='272' y='128' width='34' height='34' transform='rotate(45 289 145)'/>" +
    "<rect x='286' y='22' width='20' height='20' transform='rotate(45 296 32)'/>" +
    "</g>";
  var ICONS = {
    noodle: ICON_BG +
      "<path d='M118 58 q9 -13 0 -24 q-9 -11 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.5' stroke-linecap='round'/>" +
      "<path d='M158 60 q9 -13 0 -24 q-9 -11 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.7' stroke-linecap='round'/>" +
      "<line x1='218' y1='26' x2='254' y2='82' stroke='#C98A4B' stroke-width='6' stroke-linecap='round'/>" +
      "<line x1='234' y1='22' x2='264' y2='74' stroke='#B5763A' stroke-width='6' stroke-linecap='round'/>" +
      "<path d='M74 96 C74 142 110 160 160 160 C210 160 246 142 246 96 Z' fill='#0F766E'/>" +
      "<rect x='68' y='86' width='184' height='13' rx='6.5' fill='#0B5D57'/>" +
      "<ellipse cx='160' cy='92' rx='84' ry='10' fill='#D94F30'/>" +
      "<path d='M96 90 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0' stroke='#FAF7F0' stroke-width='4.5' fill='none' opacity='.95'/>" +
      "<path d='M104 96 q12 6 24 0 t24 0 t24 0 t24 0 t24 0' stroke='#F0E3C0' stroke-width='4' fill='none' opacity='.8'/>" +
      "<circle cx='130' cy='92' r='3.5' fill='#B03A22'/><circle cx='186' cy='95' r='3' fill='#2A9D8F'/><circle cx='212' cy='90' r='3' fill='#B03A22'/>",
    "soup-pot": ICON_BG +
      "<path d='M118 60 q9 -13 0 -24 q-9 -11 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.55' stroke-linecap='round'/>" +
      "<path d='M162 62 q9 -13 0 -24 q-9 -11 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.75' stroke-linecap='round'/>" +
      "<circle cx='84' cy='108' r='11' fill='none' stroke='#955232' stroke-width='8'/>" +
      "<circle cx='236' cy='108' r='11' fill='none' stroke='#955232' stroke-width='8'/>" +
      "<path d='M96 96 C96 140 124 158 160 158 C196 158 224 140 224 96 Z' fill='#955232'/>" +
      "<rect x='86' y='86' width='148' height='13' rx='6.5' fill='#7A4227'/>" +
      "<ellipse cx='160' cy='92' rx='66' ry='9' fill='#D94F30'/>" +
      "<path d='M148 92 L204 92 L186 76 L156 76 Z' fill='#FAF7F0'/>" +
      "<path d='M156 76 L144 68 L146 80 Z' fill='#FAF7F0'/>" +
      "<circle cx='120' cy='92' r='7' fill='#F2B65A'/><circle cx='120' cy='92' r='3' fill='#B03A22'/>" +
      "<circle cx='196' cy='96' r='5' fill='#B03A22'/>",
    rice: ICON_BG +
      "<path d='M150 54 q8 -12 0 -22 q-8 -10 0 -20' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.6' stroke-linecap='round'/>" +
      "<line x1='216' y1='34' x2='248' y2='88' stroke='#C98A4B' stroke-width='6' stroke-linecap='round'/>" +
      "<line x1='230' y1='30' x2='258' y2='80' stroke='#B5763A' stroke-width='6' stroke-linecap='round'/>" +
      "<circle cx='132' cy='82' r='18' fill='#FAF7F0'/><circle cx='160' cy='72' r='22' fill='#FAF7F0'/><circle cx='188' cy='82' r='18' fill='#FAF7F0'/>" +
      "<rect x='136' y='62' width='52' height='9' rx='4.5' fill='#7A4227' transform='rotate(-4 162 66)'/>" +
      "<circle cx='146' cy='70' r='2.5' fill='#0F766E'/><circle cx='172' cy='66' r='2.5' fill='#0F766E'/><circle cx='186' cy='76' r='2.5' fill='#0F766E'/>" +
      "<path d='M84 92 C84 132 116 150 160 150 C204 150 236 132 236 92 Z' fill='#0F766E'/>" +
      "<rect x='78' y='84' width='164' height='12' rx='6' fill='#0B5D57'/>" +
      "<rect x='146' y='150' width='28' height='8' rx='4' fill='#0B5D57'/>",
    grill: ICON_BG +
      "<path d='M128 44 q8 -12 0 -22 q-8 -10 0 -18' stroke='#FAF7F0' stroke-width='4.5' fill='none' opacity='.45' stroke-linecap='round'/>" +
      "<path d='M196 48 q7 -10 0 -18' stroke='#FAF7F0' stroke-width='4.5' fill='none' opacity='.3' stroke-linecap='round'/>" +
      "<g transform='rotate(-14 160 96)'>" +
      "<line x1='86' y1='104' x2='238' y2='92' stroke='#C98A4B' stroke-width='5' stroke-linecap='round'/>" +
      "<rect x='106' y='88' width='22' height='20' rx='5' fill='#D94F30'/>" +
      "<rect x='134' y='86' width='22' height='20' rx='5' fill='#E2A15C'/>" +
      "<rect x='162' y='84' width='22' height='20' rx='5' fill='#0F766E'/>" +
      "<rect x='190' y='82' width='22' height='20' rx='5' fill='#D94F30'/></g>" +
      "<g transform='rotate(10 160 118)'>" +
      "<line x1='92' y1='122' x2='236' y2='112' stroke='#C98A4B' stroke-width='5' stroke-linecap='round'/>" +
      "<rect x='116' y='106' width='22' height='20' rx='5' fill='#E2A15C'/>" +
      "<rect x='144' y='104' width='22' height='20' rx='5' fill='#D94F30'/>" +
      "<rect x='172' y='102' width='22' height='20' rx='5' fill='#E2A15C'/></g>" +
      "<rect x='66' y='140' width='188' height='9' rx='4.5' fill='#2A5075'/>" +
      "<path d='M120 176 q-14 -10 -6 -22 q4 8 10 10 q-2 -12 8 -18 q0 10 6 14 q6 -8 12 -2 q8 10 -4 18 Z' fill='#D94F30'/>" +
      "<path d='M136 176 q-6 -8 0 -14 q6 6 8 14 Z' fill='#F2B65A'/>" +
      "<path d='M226 176 q-14 -10 -6 -22 q4 8 10 10 q-2 -12 8 -18 q0 10 6 14 q6 -8 12 -2 q8 10 -4 18 Z' fill='#D94F30' opacity='.85'/>",
    chili: ICON_BG +
      "<path d='M124 148 C104 118 108 76 134 58 C150 47 168 50 172 62 C140 70 128 100 138 128 C142 140 136 150 124 148 Z' fill='#D94F30'/>" +
      "<path d='M136 66 C158 62 176 70 184 84 C172 80 152 78 140 84 Z' fill='#B03A22'/>" +
      "<path d='M168 52 q14 -14 26 -8 q-4 12 -18 14 q10 2 14 10 q-14 6 -26 -4 Z' fill='#0F766E'/>" +
      "<path d='M196 120 q10 -20 26 -18 q-2 14 -14 22 q12 -2 18 8 q-14 10 -30 -12 Z' fill='#D94F30'/>" +
      "<path d='M212 108 q6 -12 16 -10 q0 10 -8 16 Z' fill='#0F766E'/>" +
      "<g fill='#F2B65A'><circle cx='236' cy='52' r='4'/><circle cx='256' cy='70' r='3'/><circle cx='70' cy='96' r='3'/><circle cx='88' cy='132' r='4'/></g>",
    drypot: ICON_BG +
      "<path d='M120 56 q9 -13 0 -24' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.6' stroke-linecap='round'/>" +
      "<path d='M166 56 q9 -13 0 -24' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.45' stroke-linecap='round'/>" +
      "<path d='M80 92 C96 130 224 130 240 92 Z' fill='#2A5075'/>" +
      "<rect x='72' y='84' width='176' height='12' rx='6' fill='#1F3F63'/>" +
      "<ellipse cx='160' cy='90' rx='78' ry='9' fill='#D94F30'/>" +
      "<circle cx='126' cy='89' r='6' fill='#955232'/><circle cx='158' cy='92' r='7' fill='#B03A22'/><circle cx='192' cy='89' r='6' fill='#E2A15C'/><circle cx='176' cy='88' r='4' fill='#0F766E'/>" +
      "<line x1='110' y1='126' x2='96' y2='156' stroke='#2A5075' stroke-width='8' stroke-linecap='round'/>" +
      "<line x1='210' y1='126' x2='224' y2='156' stroke='#2A5075' stroke-width='8' stroke-linecap='round'/>" +
      "<path d='M148 172 q-12 -12 -4 -24 q4 8 9 10 q-1 -12 8 -18 q0 10 6 13 q5 -7 11 -2 q7 9 -4 16 Z' fill='#D94F30'/>" +
      "<path d='M160 172 q-5 -7 0 -12 q5 5 6 12 Z' fill='#F2B65A'/>",
    bun: ICON_BG +
      "<path d='M160 34 q9 -12 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.6' stroke-linecap='round'/>" +
      "<path d='M124 100 q36 -48 72 0 Z' fill='#FAF7F0'/>" +
      "<path d='M152 62 q8 6 16 0 M146 72 q14 8 28 0' stroke='#E0D4B8' stroke-width='3.5' fill='none' stroke-linecap='round'/>" +
      "<path d='M74 100 L74 132 L246 132 L246 100' fill='#C98A4B'/>" +
      "<ellipse cx='160' cy='100' rx='86' ry='14' fill='#D9A268'/>" +
      "<ellipse cx='160' cy='100' rx='66' ry='9' fill='none' stroke='#B5763A' stroke-width='3'/>" +
      "<g stroke='#B5763A' stroke-width='3'><line x1='96' y1='108' x2='96' y2='130'/><line x1='128' y1='112' x2='128' y2='132'/><line x1='160' y1='113' x2='160' y2='133'/><line x1='192' y1='112' x2='192' y2='132'/><line x1='224' y1='108' x2='224' y2='130'/></g>" +
      "<ellipse cx='160' cy='133' rx='92' ry='11' fill='#B5763A'/>",
    tofu: ICON_BG +
      "<path d='M120 52 q8 -12 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.5' stroke-linecap='round'/>" +
      "<rect x='64' y='132' width='192' height='9' rx='4.5' fill='#2A5075'/>" +
      "<g stroke='#2A5075' stroke-width='4'><line x1='84' y1='141' x2='84' y2='158'/><line x1='128' y1='141' x2='128' y2='158'/><line x1='192' y1='141' x2='192' y2='158'/><line x1='236' y1='141' x2='236' y2='158'/></g>" +
      "<rect x='88' y='92' width='44' height='42' rx='6' fill='#FAF7F0'/>" +
      "<rect x='186' y='92' width='44' height='42' rx='6' fill='#FAF7F0'/>" +
      "<rect x='138' y='86' width='46' height='48' rx='6' fill='#FAF7F0'/>" +
      "<path d='M150 86 q10 14 4 24 q-4 8 4 12 q10 4 6 14' stroke='#F2B65A' stroke-width='7' fill='none' stroke-linecap='round'/>" +
      "<circle cx='104' cy='102' r='3' fill='#D94F30'/><circle cx='206' cy='112' r='3' fill='#D94F30'/><circle cx='160' cy='96' r='3' fill='#0F766E'/>" +
      "<circle cx='216' cy='98' r='3' fill='#D94F30'/>",
    drink: ICON_BG +
      "<circle cx='228' cy='42' r='16' fill='#F2B65A'/>" +
      "<path d='M116 48 L204 48 L194 156 L126 156 Z' fill='#FAF7F0' opacity='.16'/>" +
      "<path d='M122 78 L198 78 L191 152 L129 152 Z' fill='#B03A22'/>" +
      "<path d='M122 78 L198 78 L197 96 L123 96 Z' fill='#FAF7F0' opacity='.25'/>" +
      "<rect x='140' y='96' width='22' height='22' rx='4' fill='#FAF7F0' opacity='.75' transform='rotate(12 151 107)'/>" +
      "<rect x='166' y='112' width='20' height='20' rx='4' fill='#FAF7F0' opacity='.6' transform='rotate(-10 176 122)'/>" +
      "<circle cx='140' cy='120' r='7' fill='#7E1F2D'/><circle cx='182' cy='100' r='7' fill='#7E1F2D'/><circle cx='168' cy='136' r='6' fill='#7E1F2D'/>" +
      "<line x1='188' y1='30' x2='170' y2='104' stroke='#0F766E' stroke-width='7' stroke-linecap='round'/>" +
      "<circle cx='112' cy='140' r='3' fill='#FAF7F0' opacity='.5'/><circle cx='206' cy='130' r='3' fill='#FAF7F0' opacity='.5'/>",
    cake: ICON_BG +
      "<path d='M138 52 q8 -12 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.55' stroke-linecap='round'/>" +
      "<line x1='160' y1='170' x2='176' y2='52' stroke='#C98A4B' stroke-width='7' stroke-linecap='round'/>" +
      "<circle cx='163' cy='128' r='27' fill='#E2A15C'/>" +
      "<circle cx='167' cy='92' r='23' fill='#FAF7F0'/>" +
      "<circle cx='171' cy='62' r='19' fill='#E2A15C'/>" +
      "<g fill='#5C3317'><circle cx='162' cy='56' r='2'/><circle cx='174' cy='60' r='2'/><circle cx='170' cy='68' r='2'/><circle cx='178' cy='66' r='1.6'/></g>" +
      "<g fill='#E0D4B8' opacity='.8'><circle cx='158' cy='86' r='1.8'/><circle cx='172' cy='90' r='1.8'/><circle cx='166' cy='98' r='1.8'/></g>" +
      "<circle cx='160' cy='172' r='4' fill='#B5763A'/>",
    coldnoodle: ICON_BG +
      "<ellipse cx='160' cy='116' rx='104' ry='30' fill='#FAF7F0'/>" +
      "<ellipse cx='160' cy='112' rx='84' ry='22' fill='#F0E3C0'/>" +
      "<path d='M108 112 q14 -12 28 0 t28 0 t28 0 t28 0' stroke='#E2A15C' stroke-width='5' fill='none'/>" +
      "<path d='M116 104 q12 -8 24 0 t24 0 t24 0 t24 0 t24 0' stroke='#FAF7F0' stroke-width='4.5' fill='none'/>" +
      "<g stroke='#0F766E' stroke-width='4' stroke-linecap='round'><line x1='122' y1='96' x2='142' y2='90'/><line x1='188' y1='94' x2='206' y2='88'/><line x1='150' y1='98' x2='164' y2='92'/></g>" +
      "<circle cx='132' cy='114' r='4' fill='#D94F30'/><circle cx='198' cy='112' r='4' fill='#D94F30'/><circle cx='164' cy='118' r='3.5' fill='#D94F30'/>" +
      "<path d='M138 62 q9 -13 0 -24 q-9 -11 0 -22' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.55' stroke-linecap='round'/>" +
      "<path d='M180 60 q9 -13 0 -24' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.35' stroke-linecap='round'/>",
    stirfry: ICON_BG +
      "<path d='M148 42 q9 -13 0 -24' stroke='#FAF7F0' stroke-width='5' fill='none' opacity='.5' stroke-linecap='round'/>" +
      "<g transform='rotate(-10 160 100)'>" +
      "<path d='M78 96 C96 134 224 134 242 96 Z' fill='#2A5075'/>" +
      "<rect x='70' y='88' width='180' height='12' rx='6' fill='#1F3F63'/>" +
      "<ellipse cx='160' cy='94' rx='76' ry='9' fill='#E2A15C'/>" +
      "<circle cx='128' cy='93' r='6' fill='#0F766E'/><circle cx='156' cy='95' r='6' fill='#D94F30'/><circle cx='188' cy='92' r='6' fill='#FAF7F0'/></g>" +
      "<circle cx='106' cy='52' r='7' fill='#0F766E'/><circle cx='140' cy='38' r='6' fill='#D94F30'/><circle cx='210' cy='44' r='6' fill='#0F766E'/><circle cx='238' cy='60' r='5' fill='#FAF7F0'/>" +
      "<g stroke='#FAF7F0' stroke-width='3' opacity='.5' stroke-linecap='round'><line x1='96' y1='70' x2='84' y2='62'/><line x1='218' y1='74' x2='230' y2='66'/></g>" +
      "<line x1='88' y1='128' x2='76' y2='156' stroke='#2A5075' stroke-width='8' stroke-linecap='round'/>" +
      "<line x1='232' y1='128' x2='244' y2='156' stroke='#2A5075' stroke-width='8' stroke-linecap='round'/>" +
      "<path d='M146 174 q-12 -11 -4 -23 q4 8 9 10 q-1 -12 8 -18 q0 10 6 13 q5 -7 11 -2 q7 9 -4 16 Z' fill='#D94F30'/>" +
      "<line x1='196' y1='52' x2='252' y2='30' stroke='#C98A4B' stroke-width='5' stroke-linecap='round'/>",
    hotel: ICON_BG +
      "<circle cx='258' cy='40' r='18' fill='#F2B65A'/>" +
      "<rect x='96' y='46' width='128' height='112' fill='#2A5075'/>" +
      "<path d='M96 46 L160 22 L224 46 Z' fill='#1F3F63'/>" +
      "<g fill='#F2B65A'><rect x='108' y='58' width='18' height='14' rx='2'/><rect x='138' y='58' width='18' height='14' rx='2'/><rect x='168' y='58' width='18' height='14' rx='2'/><rect x='198' y='58' width='18' height='14' rx='2'/><rect x='108' y='84' width='18' height='14' rx='2'/><rect x='168' y='84' width='18' height='14' rx='2'/><rect x='198' y='84' width='18' height='14' rx='2'/><rect x='108' y='110' width='18' height='14' rx='2'/><rect x='198' y='110' width='18' height='14' rx='2'/></g>" +
      "<g fill='#FAF7F0' opacity='.3'><rect x='138' y='84' width='18' height='14' rx='2'/><rect x='168' y='110' width='18' height='14' rx='2'/></g>" +
      "<rect x='142' y='124' width='36' height='34' rx='3' fill='#16304C'/>" +
      "<circle cx='152' cy='142' r='3' fill='#F2B65A'/><circle cx='168' cy='142' r='3' fill='#F2B65A'/>" +
      "<line x1='128' y1='108' x2='128' y2='132' stroke='#C98A4B' stroke-width='2.5'/>" +
      "<ellipse cx='128' cy='138' rx='7' ry='9' fill='#D94F30'/><ellipse cx='128' cy='141' rx='3' ry='5' fill='#F2B65A'/>" +
      "<rect x='66' y='158' width='188' height='6' rx='3' fill='#16304C'/>" +
      "<circle cx='66' cy='128' r='16' fill='#0F766E'/><rect x='62' y='140' width='8' height='18' fill='#0B5D57'/>" +
      "<circle cx='252' cy='134' r='13' fill='#0F766E'/><rect x='249' y='144' width='7' height='14' fill='#0B5D57'/>",
    list: ICON_BG +
      "<g transform='rotate(-4 160 100)'>" +
      "<rect x='92' y='34' width='136' height='112' rx='8' fill='#FAF7F0'/>" +
      "<rect x='92' y='34' width='136' height='20' rx='8' fill='#D94F30'/>" +
      "<g stroke='#0F766E' stroke-width='5' fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='M108 74 l7 7 l12 -13'/><path d='M108 100 l7 7 l12 -13'/><path d='M108 126 l7 7 l12 -13'/></g>" +
      "<g stroke='#B8AD93' stroke-width='5' stroke-linecap='round'><line x1='140' y1='74' x2='212' y2='74'/><line x1='140' y1='100' x2='200' y2='100'/><line x1='140' y1='126' x2='206' y2='126'/></g></g>" +
      "<line x1='236' y1='40' x2='266' y2='140' stroke='#C98A4B' stroke-width='5' stroke-linecap='round'/>" +
      "<line x1='252' y1='36' x2='276' y2='134' stroke='#B5763A' stroke-width='5' stroke-linecap='round'/>",
    song: ICON_BG +
      "<g fill='#2A5075'><path d='M160 14 L184 46 L136 46 Z'/><rect x='150' y='46' width='20' height='14'/><path d='M142 60 L178 60 L188 88 L132 88 Z'/><rect x='136' y='88' width='48' height='8'/><path d='M124 96 L196 96 L206 126 L114 126 Z'/></g>" +
      "<g><path d='M74 178 L74 148 Q74 132 96 132 L112 132 Q132 132 132 148 L132 178 Z' fill='#1F3F63'/>" +
      "<path d='M96 132 Q104 124 112 132 Z' fill='#D94F30'/>" +
      "<path d='M88 118 L118 118 L103 96 Z' fill='#D9DEE6'/>" +
      "<circle cx='103' cy='122' r='12' fill='#FAF7F0'/><circle cx='103' cy='122' r='4.5' fill='#16304C'/></g>" +
      "<g><path d='M128 178 L128 146 Q128 128 152 128 L168 128 Q190 128 190 146 L190 178 Z' fill='#1F3F63'/>" +
      "<path d='M152 128 Q160 119 168 128 Z' fill='#D94F30'/>" +
      "<path d='M142 112 L178 112 L160 86 Z' fill='#D9DEE6'/>" +
      "<circle cx='160' cy='116' r='13' fill='#FAF7F0'/><circle cx='160' cy='116' r='5' fill='#16304C'/></g>" +
      "<g><path d='M186 178 L186 148 Q186 132 208 132 L224 132 Q244 132 244 148 L244 178 Z' fill='#1F3F63'/>" +
      "<path d='M208 132 Q216 124 224 132 Z' fill='#D94F30'/>" +
      "<path d='M200 118 L230 118 L215 96 Z' fill='#D9DEE6'/>" +
      "<circle cx='215' cy='122' r='12' fill='#FAF7F0'/><circle cx='215' cy='122' r='4.5' fill='#16304C'/></g>" +
      "<g fill='#F2B65A'><circle cx='262' cy='60' r='5'/><rect x='275' y='60' width='3' height='20'/><path d='M275 80 q9 -2 9 -9'/><circle cx='286' cy='98' r='5'/><rect x='299' y='98' width='3' height='20'/><path d='M299 118 q9 -2 9 -9'/></g>" +
      "<circle cx='52' cy='70' r='4' fill='#FAF7F0' opacity='.6'/><circle cx='68' cy='52' r='3' fill='#FAF7F0' opacity='.4'/>"
  };

  function openDetail(key, fromHistory) {
    var d = DETAILS[key];
    if (!d) { toast("详情整理中…"); return; }
    currentDetail = key;
    lastFocused = document.activeElement;        // 关闭后要把焦点还回去
    // 没有真实照片的条目用手绘 SVG 图标头图（ICONS 表），不再用系统 emoji
    var head = d.img
      ? "<img src='" + d.img + "' alt='" + d.title + "' loading='lazy' decoding='async'>"
      : "<div class='detail-emoji detail-icon' aria-hidden='true'>" +
        "<svg viewBox='0 0 320 180' preserveAspectRatio='xMidYMid slice' role='img'>" +
        (ICONS[d.icon] || "") + "</svg></div>";
    detailBody.innerHTML =
      head +
      "<h2 id='detailTitle'>" + d.title + "</h2>" +
      "<span class='d-tag'>📍 " + d.tag + "</span>" +
      "<p>" + d.desc + "</p>" +
      "<ul>" + d.tips.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
    if (bookPrice) bookPrice.textContent = d.price || "—";
    if (bookPriceNote) bookPriceNote.textContent = d.note || "价格以到店为准";
    detail.hidden = false;
    document.body.style.overflow = "hidden";
    syncFavBtn();
    // 同步到地址栏：这样卡片上的 href="#/xxx" 才是真链接（新标签打开能直接落到该详情），
    // 手机返回键也能关浮层而不是退出整页。fromHistory 表示这次打开本身就是历史记录触发的，
    // 不能再压一条，否则返回键会陷在原地。
    if (!fromHistory) {
      try { history.pushState({ klDetail: key }, "", "#/" + key); } catch (e) {}
    }
    // 焦点移进浮层：否则键盘用户按 Tab 会跑到被遮住的背景下文里，读屏也不会播报弹出内容
    var closeBtn = $(".detail-close", detail);
    if (closeBtn) closeBtn.focus();
  }
  function closeDetail(fromHistory) {
    if (detail.hidden) return;
    detail.hidden = true;
    document.body.style.overflow = "";
    currentDetail = null;
    // 可能刚在浮层里取消了收藏，「我的」页的列表要跟着变
    renderFavList();
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
    // 用户主动关闭：把刚才压进去的历史记录退掉，让返回键行为前后一致
    if (!fromHistory && location.hash.indexOf("#/") === 0) {
      try { history.back(); } catch (e) {}
    }
  }
  /* 返回键 / 前进键：按 hash 决定开关 */
  window.addEventListener("popstate", function () {
    var key = location.hash.indexOf("#/") === 0 ? location.hash.slice(2) : null;
    if (key && DETAILS[key]) openDetail(key, true);
    else closeDetail(true);
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-detail]");
    if (t) { e.preventDefault(); openDetail(t.dataset.detail); return; }
    if (e.target.closest("[data-close]")) closeDetail();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeDetail(); return; }
    // 补过 role=button 的 <div>/<article> 不会自己响应键盘，手动触发一次
    if ((e.key === "Enter" || e.key === " " || e.key === "Spacebar") &&
        document.activeElement && document.activeElement.closest) {
      var card = document.activeElement.closest("[data-detail]");
      if (card && card.tagName !== "BUTTON" && card.tagName !== "A") {
        e.preventDefault();            // 空格默认会滚页
        openDetail(card.dataset.detail);
        return;
      }
    }
    // 焦点锁在浮层内：背景只是被遮住、仍在 DOM 里，Tab 默认会走出浮层
    if (e.key !== "Tab" || !detail || detail.hidden) return;
    var f = $$("button, [href], [tabindex]:not([tabindex='-1'])", detail)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* 首屏直达：地址栏带 #/key 就直接开浮层。
     首页卡片本来就是 <a href="#/xijiang">，以前靠 preventDefault 拦进浮层，
     右键「在新标签打开」只会得到一个空白锚点页；现在这个链接是真的能用了。 */
  if (location.hash.indexOf("#/") === 0) {
    var initialKey = location.hash.slice(2);
    if (DETAILS[initialKey]) openDetail(initialKey, true);
  }

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
      syncFavBtn(); favCount(); renderFavList();
      var name = DETAILS[currentDetail] ? DETAILS[currentDetail].title : currentDetail;
      toast(favState[currentDetail] ? "已收藏「" + name + "」" : "已取消收藏「" + name + "」");
    });
  }
  favCount();

  /* 收藏列表：列出已收藏项，点进去开详情（详情里的 ♡ 可取消）。
     列表项带 data-detail，直接复用详情浮层那套点击逻辑，不用再写一遍。 */
  var favList = $("#favList"), favHead = $("#favHead"), favSub = $("#favSub");
  function favKeys() {
    return Object.keys(favState).filter(function (k) { return favState[k] && DETAILS[k]; });
  }
  function renderFavList() {
    if (!favList) return;
    var keys = favKeys();
    if (!keys.length) {
      favList.innerHTML = "<p class='fav-empty'>还没有收藏。在目的地 / 美食 / 文化卡片里点开详情，按底部的 ♡ 就能收进来。</p>";
    } else {
      favList.innerHTML = keys.map(function (k) {
        var d = DETAILS[k];
        var face = d.img ? "<img src='" + d.img.replace("-800.webp", "-400.webp") + "' alt='' loading='lazy' decoding='async'>"
                         : "<span class='fav-face' aria-hidden='true'>" + (d.emoji || "📍") + "</span>";
        return "<div class='fav-row' data-detail='" + k + "'>" + face +
               "<div><b>" + d.title + "</b><i>" + (d.tag || "") + " · " + (d.price || "") + "</i></div>" +
               "<span class='fav-go' aria-hidden='true'>›</span></div>";
      }).join("");
      // 与详情页卡片一致：非原生元素补 role/tabindex，键盘才 Tab 得到
      $$(".fav-row", favList).forEach(function (el) {
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
      });
    }
    if (favSub) favSub.textContent = keys.length ? keys.length + " 项 · 点击查看详情" : "";
  }
  var meFav = $("#meFav");
  if (meFav) {
    meFav.addEventListener("click", function () {
      renderFavList();
      if (!favKeys().length) { toast("还没有收藏，去目的地卡片看看吧"); return; }
      var show = favList.hidden;
      favList.hidden = !show;
      if (favHead) favHead.hidden = !show;
      meFav.setAttribute("aria-expanded", show ? "true" : "false");
      if (show) favList.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    meFav.setAttribute("aria-expanded", "false");
  }
  renderFavList();

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
  var CACHE_NAME = "kaili-trip-v9";   // 必须与 sw.js 的 CACHE 一致，否则离线缓存会被 SW 激活时清理掉
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
     "craft-miaoxiu", "craft-yinshi", "craft-ran", "village-cunt", "food-suantang"]
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
