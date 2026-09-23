# -*- coding: utf-8 -*-
"""生成凯里旅行站点用的 WebP 图片素材：渐变底 + 苗绣几何纹样。"""
import math
from PIL import Image, ImageDraw

OUT = "/Users/guojunxian/个人/接单/案例/kaili/kaili-travel/assets/img"

INDIGO = (27, 58, 92)
TEAL = (15, 118, 110)
RED = (217, 79, 48)
SILVER = (192, 199, 209)
CREAM = (250, 247, 240)

SCENES = {
    "banner-kaili":  (INDIGO, TEAL,  0.10),
    "xijiang":       (INDIGO, RED,   0.12),
    "xiasi":         (TEAL,  INDIGO, 0.10),
    "langde":        (TEAL,  RED,    0.12),
    "wudong":        (INDIGO, TEAL,  0.14),
    "qingyun":       (RED,   INDIGO, 0.10),
    "xiulitao":      (RED,   TEAL,   0.12),
    "food-suantang": (RED,   INDIGO, 0.10),
    "craft-miaoxiu": (INDIGO, RED,   0.08),
    "craft-yinshi":  (SILVER, INDIGO, 0.14),
    "craft-ran":     (TEAL,  INDIGO, 0.10),
    "village-cunt":  (RED,   TEAL,   0.12),
    "moon":          (INDIGO, INDIGO, 0.10),
}

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def diamond(draw, cx, cy, r, color, width=3):
    draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], outline=color, width=width)

def draw_pattern(draw, w, h, color, alpha_scale=1.0):
    """苗绣几何纹样：菱形网格 + 八角星 + 锯齿边。"""
    step = 64
    for y in range(-step, h + step, step):
        for x in range(-step, w + step, step):
            off = step // 2 if (x // step + y // step) % 2 else 0
            diamond(draw, x + off, y, 22, color, 3)
            diamond(draw, x + off, y, 10, color, 2)
    # 八角星点缀
    for (sx, sy) in [(w * 0.2, h * 0.3), (w * 0.8, h * 0.25), (w * 0.5, h * 0.7)]:
        r = 34
        pts = []
        for i in range(16):
            rr = r if i % 2 == 0 else r * 0.45
            ang = math.pi * i / 8
            pts.append((sx + rr * math.cos(ang), sy + rr * math.sin(ang)))
        draw.polygon(pts, outline=color, width=3)
    # 上下锯齿边
    tooth = 24
    for i in range(0, w + tooth, tooth * 2):
        draw.polygon([(i, 0), (i + tooth, 18), (i + tooth * 2, 0)], outline=color, width=2)
        draw.polygon([(i, h), (i + tooth, h - 18), (i + tooth * 2, h)], outline=color, width=2)

def make(name, c1, c2, pat_alpha):
    for w, h in [(400, 300), (800, 600)]:
        img = Image.new("RGB", (w, h), c1)
        draw = ImageDraw.Draw(img)
        # 对角渐变
        for y in range(h):
            for_seg = lerp(c1, c2, (y / h) * 0.9 + (0.05))
            draw.line([(0, y), (w, y)], fill=for_seg)
        # 山影剪影（山水凯里）
        ridge_color = lerp(c1, (0, 0, 0), 0.35)
        pts = [(0, h)]
        for i in range(0, w + 20, 20):
            pts.append((i, h * 0.62 + math.sin(i / w * math.pi * 2.2) * h * 0.13))
        pts.append((w, h))
        draw.polygon(pts, fill=ridge_color)
        pts2 = [(0, h)]
        for i in range(0, w + 20, 20):
            pts2.append((i, h * 0.78 + math.sin(i / w * math.pi * 3.1 + 1) * h * 0.08))
        pts2.append((w, h))
        draw.polygon(pts2, fill=lerp(ridge_color, (0, 0, 0), 0.4))
        # 苗绣纹样水印层
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        draw_pattern(od, w, h, (255, 255, 255, int(255 * pat_alpha)))
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        img.save(f"{OUT}/{name}-{w}.webp", "WEBP", quality=72, method=6)
    print("ok", name)

for k, v in SCENES.items():
    make(k, *v)

# PWA 图标 192/512
for size in (192, 512):
    img = Image.new("RGB", (size, size), INDIGO)
    d = ImageDraw.Draw(img)
    draw_pattern(d, size, size, (255, 255, 255, int(255 * 0.18)))
    cx = cy = size // 2
    d.polygon([(cx, cy - size * 0.22), (cx + size * 0.22, cy), (cx, cy + size * 0.22), (cx - size * 0.22, cy)],
              outline=CREAM, width=max(4, size // 40))
    d.polygon([(cx, cy - size * 0.11), (cx + size * 0.11, cy), (cx, cy + size * 0.11), (cx - size * 0.11, cy)],
              fill=(217, 79, 48))
    img.save(f"{OUT.rsplit('/img',1)[0]}/icon-{size}.png", "PNG")
    print("icon", size)
print("DONE")
