#!/usr/bin/env python3
"""把公共壳（顶栏 + 底部 Tab + 首帧底色）写进 6 个 HTML 的静态标记里。

为什么需要它
------------
原先壳由 js/layout.js 注入，而 layout.js 是 <script defer>：浏览器解析到 body
内容就开始渐进渲染，而 defer 脚本要等整份 HTML 解析完才执行。慢网下这段间隔里
页面是"有内容、没顶栏、没底部 Tab"的，随后壳才补上、整页往下跳一下 —— 就是点击
Tab 时看到的闪。把壳写进 HTML 后，首帧就带着它，不存在补的过程。

用法
----
    python3 tools/build-shell.py            # 写入 / 更新（幂等）
    python3 tools/build-shell.py --check     # 只检查是否已同步，不写文件

改壳（导航项、热词、顶栏文案）请改本脚本的模板后重跑，不要手改 HTML，
否则 6 个页面迟早漂移成 6 个样子。
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------- 数据源：与 js/layout.js 的 NAV / CHIPS 保持一致 ----------
NAV = [
    ("home", "首页", "index.html",
     '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
    ("explore", "探索", "explore.html",
     '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
    ("trip", "行程", "trip.html",
     '<path d="M8 3v3M16 3v3"/><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M4 11h16"/>'),
    ("pack", "打包", "pack.html",
     '<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 12v4M15 12v4"/>'),
    ("me", "我的", "me.html",
     '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5"/>'),
]

CHIPS = [
    ("西江", "西江千户苗寨", "index.html?kw=西江"),
    ("下司", "下司古镇", "index.html?kw=下司"),
    ("酸汤鱼", "酸汤鱼", "explore.html?kw=酸汤鱼"),
    ("苗绣", "苗绣", "explore.html?kw=苗绣"),
]

# 只有这两页有搜索框；顶栏高度因此不同，是既有设计
SEARCH_PAGES = ("home", "explore")

ICON = ('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" '
        'stroke="currentColor" stroke-width="2">')

CRITICAL = (
    "<!-- shell:critical — 首帧即上主题底色，避免外部样式表到达前出现白闪 -->\n"
    "<style>html{background:#FAF7F0}</style>"
)

SEARCH_BLOCK = """  <div class="search-wrap">
    <svg class="search-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    <input id="searchInput" type="search" placeholder="搜索：西江 / 下司 / 酸汤鱼 / 苗绣" autocomplete="off" aria-label="搜索目的地、美食、非遗">
    <button class="search-clear" id="searchClear" hidden aria-label="清空搜索">\u2715</button>
  </div>
  <div class="hot-chips" id="hotChips">%s
  </div>"""


def topbar_html(page: str) -> str:
    search = ""
    if page in SEARCH_PAGES:
        chips = "".join(
            '\n    <a class="chip-link" href="%s" data-kw="%s">%s</a>' % (href, kw, label)
            for kw, label, href in CHIPS
        )
        search = "\n" + (SEARCH_BLOCK % chips)
    return (
        "<!-- shell:topbar — 由 tools/build-shell.py 生成，改壳请改脚本后重跑 -->\n"
        '<header class="topbar">\n'
        '  <div class="topbar-row">\n'
        '    <button class="loc-btn" id="locBtn" aria-label="定位">\n'
        '      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>\n'
        '      <span id="locText">凯里 · 贵州</span>\n'
        '      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>\n'
        '    </button>\n'
        '    <span class="topbar-title">苗侗明珠 · 山水凯里</span>\n'
        '  </div>%s\n'
        '</header>\n'
        '<!-- /shell:topbar -->' % search
    )


def tabbar_html(page: str) -> str:
    items = []
    for pid, label, href, icon in NAV:
        cls = "tab active" if pid == page else "tab"
        items.append(
            '  <a class="%s" href="%s" aria-label="%s">\n'
            '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">%s</svg>\n'
            '    <span>%s</span>\n'
            '  </a>' % (cls, href, label, icon, label)
        )
    return (
        "<!-- shell:tabbar — 由 tools/build-shell.py 生成，改壳请改脚本后重跑 -->\n"
        '<nav class="tabbar" aria-label="主导航">\n'
        + "\n".join(items) + "\n"
        "</nav>\n"
        "<!-- /shell:tabbar -->"
    )


def block_re(name: str) -> re.Pattern:
    return re.compile(
        r"<!-- shell:%s\b[^>]*-->.*?<!-- /shell:%s -->" % (name, name), re.S
    )


def sync(path: str, write: bool) -> list[str]:
    src = open(path, encoding="utf-8").read()
    page = (re.search(r'<body[^>]*data-page="([a-z]+)"', src) or [None, None])[1]
    if not page:
        return ["%s：找不到 data-page，跳过" % os.path.basename(path)]
    out = src
    notes = []

    # 1) head 里的首帧底色
    if not re.search(r"<!-- shell:critical\b", out):
        m = re.search(r'^<link rel="preload" as="font".*$', out, re.M)
        if m:
            out = out[:m.start()] + CRITICAL + "\n" + out[m.start():]
        else:
            out = out.replace("</head>", CRITICAL + "\n</head>", 1)
        notes.append("插入首帧底色")

    # 2) 顶栏 + 底部 Tab（整块插入，保证顶栏在前、Tab 在后）
    shell = topbar_html(page) + "\n\n" + tabbar_html(page)
    stripped = out
    for name in ("topbar", "tabbar"):
        stripped = block_re(name).sub("", stripped)
    stripped = re.sub(r"\n{3,}", "\n\n", stripped)
    bm = re.search(r"<body[^>]*>\n", stripped)
    if not bm:
        return notes + ["%s：找不到 <body>，跳过" % os.path.basename(path)]
    out = stripped[:bm.end()] + shell + "\n\n" + stripped[bm.end():]

    if out == src:
        return []          # 已同步，无需改动
    notes.append("更新 shell 块")
    if write:
        # 临时文件 + 原子替换：预览层会抢占 HTML，原地写常失败
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(out)
        os.replace(tmp, path)
    else:
        notes.append("需要写入")
    return notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只检查，不写文件")
    ap.add_argument("--site-root", default=ROOT)
    args = ap.parse_args()

    pages = sorted(glob.glob(os.path.join(args.site_root, "*.html")))
    if not pages:
        print("没有找到 HTML 文件", file=sys.stderr)
        return 1
    changed = 0
    for p in pages:
        notes = sync(p, write=not args.check)
        name = os.path.basename(p)
        if notes:
            changed += 1
            print("%-14s %s" % (name, "，".join(notes)))
        else:
            print("%-14s 已是同步状态" % name)
    print()
    if args.check and changed:
        print("✗ 有 %d 个页面未同步" % changed)
        return 1
    if args.check:
        print("✅ %d 个页面均已同步" % len(pages))
    else:
        print("✅ 已处理 %d 个页面（%d 个有改动）" % (len(pages), changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
