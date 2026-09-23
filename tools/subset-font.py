#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""标题字体子集化工具 —— 生成 assets/fonts/noto-serif-sc-subset.woff2

背景
    站点标题使用 Noto Serif SC。直接引用 Google Fonts 时，首次访问会拉取
    约 221KB 的 CSS + 1195KB 的字体分片（中文按 unicode-range 切成 200 多个分片）。
    本站标题实际只用到约 280 个汉字，子集化后单个 woff2 仅 167KB，且不依赖第三方域名。

用法
    python3 tools/subset-font.py

    首次运行会把 Noto Serif SC 可变字体（约 24MB）下载到 tools/.cache/ 并复用。
    需要 fonttools + brotli：pip install fonttools brotli

维护约定
    新增/修改标题文案后重跑本脚本即可。字符集来自两处合并：
      1) 自动扫描源文件：HTML 里的 h1/h2/h3 文本、静态壳的顶栏标题与底部 Tab 标签、
         js/data.js 的 title
      2) tools/title-chars.txt —— 历史上累计的字符清单（自动追加，只增不减，防止改版丢字）
    未被收录的字符会回退到系统宋体，不会显示为方块，但字形会和其它标题不一致。
"""
import os
import re
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "tools", ".cache")
SOURCE_URL = "https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
SOURCE_FILE = os.path.join(CACHE_DIR, "NotoSerifSC[wght].ttf")
CHARS_FILE = os.path.join(ROOT, "tools", "title-chars.txt")
OUT_FILE = os.path.join(ROOT, "assets", "fonts", "noto-serif-sc-subset.woff2")

# 兜底字符：ASCII + 中文标点 + 货币/度量符号。这些不会随文案变化。
SAFETY = "".join(chr(c) for c in range(0x20, 0x7F)) + "　·—…、。，；：！？（）《》“”‘’【】％¥￥°×÷－～±"


class HeadingText(HTMLParser):
    """收集 h1/h2/h3 标签内的文本（标题字体只作用在这些元素上）。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.buf = []

    def handle_starttag(self, tag, attrs):
        if tag in ("h1", "h2", "h3"):
            self.depth += 1

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3") and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.buf.append(data)

    def text(self):
        return "".join(self.buf)


def collect_chars():
    chars = set(SAFETY)

    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".html"):
            continue
        parser = HeadingText()
        parser.feed(open(os.path.join(ROOT, name), encoding="utf-8").read())
        chars |= set(parser.text())

    data_js = os.path.join(ROOT, "js", "data.js")
    if os.path.exists(data_js):
        # 详情浮层的标题由 data.js 注入到 <h2>
        for m in re.finditer(r"title:\s*\"([^\"]*)\"", open(data_js, encoding="utf-8").read()):
            chars |= set(m.group(1))

    layout_js = os.path.join(ROOT, "js", "layout.js")
    if os.path.exists(layout_js):
        for m in re.finditer(r'class="topbar-title">([^<]*)<', open(layout_js, encoding="utf-8").read()):
            chars |= set(m.group(1))

    # 静态壳（顶栏标题 + 底部 Tab 标签）
    # 壳由 tools/build-shell.py 写进各页 HTML，不再由 layout.js 注入，
    # 所以必须从这里取字，否则改了壳文案就会漏字。
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".html"):
            continue
        html = open(os.path.join(ROOT, name), encoding="utf-8").read()
        for m in re.finditer(r'class="topbar-title">([^<]*)<', html):
            chars |= set(m.group(1))
        tabbar = re.search(r'<nav class="tabbar".*?</nav>', html, re.S)
        if tabbar:
            chars |= set(re.sub(r"<[^>]+>", " ", tabbar.group(0)))

    # 合并历史清单（只增不减，避免改版后丢字）
    if os.path.exists(CHARS_FILE):
        chars |= set(open(CHARS_FILE, encoding="utf-8").read())

    return {c for c in chars if c.strip()}


def ensure_source():
    if os.path.exists(SOURCE_FILE):
        return
    os.makedirs(CACHE_DIR, exist_ok=True)
    print("下载源字体（约 24MB，仅首次）…")
    urllib.request.urlretrieve(SOURCE_URL, SOURCE_FILE)


def main():
    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        sys.exit("缺少依赖，请先执行：pip install fonttools brotli")

    chars = collect_chars()
    if len(chars) < 100:
        sys.exit(f"只收集到 {len(chars)} 个字符，明显异常，已中止")

    ensure_source()
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

    # 写出字符清单（持久化，供下次合并）
    with open(CHARS_FILE, "w", encoding="utf-8") as f:
        f.write("".join(sorted(chars)))

    chars_tmp = os.path.join(CACHE_DIR, "chars.txt")
    with open(chars_tmp, "w", encoding="utf-8") as f:
        f.write("".join(sorted(chars)))

    # 保留 wght 可变轴：单文件同时服务 700（标题默认）与 900（序号/重点）
    cmd = [
        sys.executable, "-m", "fontTools.subset", SOURCE_FILE,
        "--text-file=" + chars_tmp,
        "--layout-features=*",
        "--flavor=woff2",
        "--no-hinting",
        "--desubroutinize",
        "--output-file=" + OUT_FILE,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("子集化失败：\n" + r.stderr[:2000])

    size_kb = os.path.getsize(OUT_FILE) / 1024
    cjk = sum(1 for c in chars if "\u4e00" <= c <= "\u9fff")
    print(f"字符集 {len(chars)} 个（汉字 {cjk}）")
    print(f"输出 {os.path.relpath(OUT_FILE, ROOT)}  {size_kb:.1f} KB")
    print("完成。若标题文案有新增字符，本脚本已自动收录。")


if __name__ == "__main__":
    main()
