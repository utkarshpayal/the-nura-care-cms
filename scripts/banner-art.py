"""Draws the artwork for the Banners page templates (src/lib/bannerTemplates.ts).

    python3 scripts/banner-art.py path/to/Nunito[wght].ttf

Writes PNGs to public/banner-templates/: wide 3:1 banners with the words baked
in (the "Image" style) and small 6:5 illustrations for the "Card" style. Each
is drawn at 2x and scaled down so edges stay smooth.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = sys.argv[1] if len(sys.argv) > 1 else "Nunito.ttf"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "banner-templates")
S = 2  # supersampling

WIDE = (1200, 400)
THUMB = (344, 288)


def font(size, weight="ExtraBold"):
    f = ImageFont.truetype(FONT, size * S)
    f.set_variation_by_name(weight)
    return f


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def gradient(size, stops, angle=20):
    """Linear gradient across `size` through [(pos, "#hex"), ...]."""
    w, h = size
    img = Image.new("RGB", (w, h))
    px = img.load()
    a = math.radians(angle)
    dx, dy = math.cos(a), math.sin(a)
    lo = min(0, w * dx) + min(0, h * dy)
    hi = max(0, w * dx) + max(0, h * dy)
    cols = [(p, rgb(c)) for p, c in stops]
    for y in range(h):
        for x in range(w):
            t = ((x * dx + y * dy) - lo) / (hi - lo)
            for i in range(len(cols) - 1):
                p0, c0 = cols[i]
                p1, c1 = cols[i + 1]
                if t <= p1 or i == len(cols) - 2:
                    k = 0 if p1 == p0 else max(0, min(1, (t - p0) / (p1 - p0)))
                    px[x, y] = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                    break
    return img


def canvas(size, stops, angle=20):
    w, h = size
    # Gradients are slow per pixel; draw small and scale up (they're smooth anyway).
    g = gradient((w // 4, h // 4), stops, angle).resize((w * S, h * S), Image.BICUBIC)
    return g.convert("RGBA")


def layer(img):
    return Image.new("RGBA", img.size, (0, 0, 0, 0))


def glow(img, xy, r, color, alpha=90, blur=40):
    """Soft blurred circle behind things."""
    l = layer(img)
    d = ImageDraw.Draw(l)
    x, y = xy
    d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=rgb(color) + (alpha,))
    l = l.filter(ImageFilter.GaussianBlur(blur * S))
    img.alpha_composite(l)


def blob(img, box, color, alpha=255):
    l = layer(img)
    ImageDraw.Draw(l).ellipse([v * S for v in box], fill=rgb(color) + (alpha,))
    img.alpha_composite(l)


def rrect(img, box, r, color, alpha=255, outline=None, width=0):
    l = layer(img)
    ImageDraw.Draw(l).rounded_rectangle(
        [v * S for v in box], r * S, fill=(rgb(color) + (alpha,) if isinstance(color, str) else color) if color else None, outline=outline, width=width * S
    )
    img.alpha_composite(l)


def shadow(img, box, r, alpha=60, blur=14, off=8):
    l = layer(img)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(l).rounded_rectangle([x0 * S, (y0 + off) * S, x1 * S, (y1 + off) * S], r * S, fill=(40, 10, 40, alpha))
    img.alpha_composite(l.filter(ImageFilter.GaussianBlur(blur * S)))


def poly(img, pts, color, alpha=255):
    l = layer(img)
    ImageDraw.Draw(l).polygon([(x * S, y * S) for x, y in pts], fill=rgb(color) + (alpha,))
    img.alpha_composite(l)


def star(cx, cy, r, points=5, inner=0.45, rot=-90):
    pts = []
    for i in range(points * 2):
        rr = r if i % 2 == 0 else r * inner
        a = math.radians(rot + i * 180 / points)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def sparkle(img, cx, cy, r, color="#ffffff", alpha=230):
    poly(img, star(cx, cy, r, 4, 0.28, -90), color, alpha)


def heart(cx, cy, s):
    pts = []
    for i in range(80):
        t = 2 * math.pi * i / 80
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * s / 17, cy + y * s / 17))
    return pts


def text(img, xy, s, size, color="#ffffff", weight="ExtraBold", alpha=255, anchor="la"):
    d = ImageDraw.Draw(img)
    d.text((xy[0] * S, xy[1] * S), s, font=font(size, weight), fill=rgb(color) + (alpha,), anchor=anchor)


def text_w(s, size, weight="ExtraBold"):
    return font(size, weight).getlength(s) / S


def pill(img, xy, label, bg="#ffffff", fg="#000000", size=24, arrow=True):
    x, y = xy
    tw = text_w(label, size)
    aw = 26 if arrow else 0
    w = tw + aw + 48
    h = size + 30
    shadow(img, (x, y, x + w, y + h), h / 2, alpha=50, blur=8, off=5)
    rrect(img, (x, y, x + w, y + h), h / 2, bg)
    text(img, (x + 24, y + h / 2 + 1), label, size, fg, anchor="lm")
    if arrow:
        # Drawn, not typed: Nunito has no arrow glyph.
        ax, ay = x + 24 + tw + 12, y + h / 2
        rrect(img, (ax, ay - 1.5, ax + 14, ay + 1.5), 1.5, fg)
        poly(img, [(ax + 8, ay - 6), (ax + 15, ay), (ax + 8, ay + 6), (ax + 7, ay + 4), (ax + 11, ay), (ax + 7, ay - 4)], fg)


def headline(img, lines, eyebrow=None, color="#ffffff", x=64, top=None, size=52):
    """Eyebrow + up to two headline lines, left aligned; returns y below them."""
    h = (34 if eyebrow else 0) + len(lines) * (size + 8)
    y = top if top is not None else (WIDE[1] - h - 84) / 2
    if eyebrow:
        text(img, (x, y), eyebrow.upper(), 20, color, "Black", alpha=200)
        y += 34
    for line in lines:
        text(img, (x, y), line, size, color, "Black")
        y += size + 8
    return y


def save(img, name, size):
    img = img.resize(size, Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    print("wrote", name)


# ------------------------------- Wide banners ------------------------------- #


def whatsapp():
    img = canvas(WIDE, [(0, "#0b8f5a"), (0.55, "#1fb866"), (1, "#5fe08f")])
    glow(img, (980, 90), 220, "#c9ffd9", 70)
    blob(img, (1040, 250, 1290, 500), "#0a7a4c", 120)
    # Chat bubbles, stacked like a busy group.
    bubbles = [(760, 64, 1010, 138, "#ffffff", ["Anyone else get cramps", "on day 2?"]), (880, 158, 1140, 226, "#dcf8c6", ["Same! Heat pad +", "ginger tea helps"]), (770, 246, 1030, 312, "#ffffff", ["Welcome to the", "circle, Priya!"])]
    for x0, y0, x1, y1, c, lines in bubbles:
        shadow(img, (x0, y0, x1, y1), 22, alpha=55)
        rrect(img, (x0, y0, x1, y1), 22, c)
        for i, ln in enumerate(lines):
            text(img, (x0 + 22, y0 + 14 + i * 26), ln, 20, "#1f2d27", "Bold")
    # Avatars
    for i, col in enumerate(["#ffb4c8", "#c7b6ff", "#ffd88a"]):
        blob(img, (1050 + i * 34, 254, 1096 + i * 34, 300), col)
        rrect(img, (1050 + i * 34, 254, 1096 + i * 34, 300), 23, None, outline=(255, 255, 255, 255), width=3)
    text(img, (1080, 312), "+2k women", 18, "#ffffff", "Black")
    sparkle(img, 720, 90, 16)
    sparkle(img, 1170, 60, 11)
    y = headline(img, ["Join the Nura circle", "on WhatsApp"], "Community")
    text(img, (64, y + 8), "Real talk, tips & support from women like you", 22, "#eafff2", "SemiBold")
    pill(img, (64, y + 50), "Join the community", "#ffffff", "#0b8f5a")
    save(img, "whatsapp-community", WIDE)


def instagram():
    img = canvas(WIDE, [(0, "#feda75"), (0.3, "#fa7e1e"), (0.6, "#d62976"), (0.85, "#962fbf"), (1, "#4f5bd5")], 25)
    glow(img, (200, 60), 260, "#ffffff", 40)
    # Three tilted "posts".
    posts = [(750, 70, -8, ["#ffd1dc", "#ff8fab"], "heart"), (880, 50, 5, ["#e0d4ff", "#a78bfa"], "moon"), (1010, 90, 10, ["#c8f7dc", "#4ade80"], "leaf")]
    for x, y, rot, (c0, c1), motif in posts:
        card = Image.new("RGBA", (190 * S, 240 * S), (0, 0, 0, 0))
        rrect(card, (0, 0, 190, 240), 18, "#ffffff")
        inner = gradient((170 // 2, 170 // 2), [(0, c0), (1, c1)], 60).resize((170 * S, 170 * S)).convert("RGBA")
        m = Image.new("L", inner.size, 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, inner.size[0], inner.size[1]], 12 * S, fill=255)
        card.paste(inner, (10 * S, 10 * S), m)
        if motif == "heart":
            poly(card, heart(95, 95, 48), "#ffffff", 235)
        elif motif == "moon":
            blob(card, (50, 50, 140, 140), "#ffffff", 235)
            blob(card, (76, 38, 162, 124), c1)
            sparkle(card, 60, 140, 10)
        else:
            poly(card, [(95, 40), (140, 95), (95, 150), (50, 95)], "#ffffff", 235)
            rrect(card, (92, 60, 98, 150), 3, c1)
        poly(card, heart(30, 207, 12), "#ed4956")
        rrect(card, (54, 200, 150, 214), 7, "#eeeeee")
        card = card.rotate(-rot, resample=Image.BICUBIC, expand=True)
        img.alpha_composite(card, (x * S, y * S))
    # Camera glyph
    x0, y0 = 64, 48
    rrect(img, (x0, y0, x0 + 44, y0 + 44), 13, None, outline=(255, 255, 255, 255), width=4)
    ImageDraw.Draw(img).ellipse([(x0 + 12) * S, (y0 + 12) * S, (x0 + 32) * S, (y0 + 32) * S], outline=(255, 255, 255, 255), width=4 * S)
    blob(img, (x0 + 31, y0 + 7, x0 + 37, y0 + 13), "#ffffff")
    text(img, (x0 + 58, y0 + 8), "@thenura", 26, "#ffffff", "Black")
    y = headline(img, ["Daily tips, reels &", "real stories"], None, top=118)
    pill(img, (64, y + 18), "Follow us", "#ffffff", "#c1206a")
    save(img, "instagram-follow", WIDE)


def website():
    img = canvas(WIDE, [(0, "#fff1f4"), (0.6, "#ffe0ea"), (1, "#eadcff")], 15)
    glow(img, (950, 200), 260, "#ff9bb8", 80)
    blob(img, (-80, 280, 220, 520), "#ffd0de", 160)
    # Browser window
    bx0, by0, bx1, by1 = 700, 60, 1130, 360
    shadow(img, (bx0, by0, bx1, by1), 22, alpha=70, blur=18, off=12)
    rrect(img, (bx0, by0, bx1, by1), 22, "#ffffff")
    rrect(img, (bx0, by0, bx1, by0 + 44), 22, "#fbe7ee")
    rrect(img, (bx0, by0 + 22, bx1, by0 + 44), 0, "#fbe7ee")
    for i, c in enumerate(["#ff6b8b", "#ffc15e", "#5fd08a"]):
        blob(img, (bx0 + 20 + i * 22, by0 + 15, bx0 + 34 + i * 22, by0 + 29), c)
    rrect(img, (bx0 + 100, by0 + 11, bx1 - 30, by0 + 33), 11, "#ffffff")
    text(img, (bx0 + 116, by0 + 13), "thenura.care", 16, "#b04a6d", "Bold")
    # Page content
    hero = gradient((170, 90), [(0, "#ff7aa2"), (1, "#b58cff")], 30).resize((340 * S, 180 * S)).convert("RGBA")
    m = Image.new("L", hero.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, hero.size[0], hero.size[1]], 14 * S, fill=255)
    img.paste(hero, ((bx0 + 24) * S, (by0 + 64) * S), m)
    blob(img, (bx0 + 250, by0 + 90, bx0 + 340, by0 + 180), "#ffffff", 90)
    poly(img, heart(bx0 + 120, by0 + 150, 36), "#ffffff", 240)
    rrect(img, (bx0 + 190, by0 + 120, bx0 + 330, by0 + 134), 7, "#ffffff", 220)
    rrect(img, (bx0 + 190, by0 + 146, bx0 + 290, by0 + 160), 7, "#ffffff", 160)
    for i in range(3):
        rrect(img, (bx0 + 24 + i * 116, by0 + 258, bx0 + 124 + i * 116, by0 + 284), 8, ["#ffe3ec", "#efe6ff", "#e2f7ec"][i])
    # Cursor
    cx, cy = 1070, 290
    poly(img, [(cx, cy), (cx, cy + 46), (cx + 12, cy + 34), (cx + 22, cy + 56), (cx + 30, cy + 52), (cx + 20, cy + 31), (cx + 36, cy + 31)], "#2b1030")
    sparkle(img, 660, 80, 14, "#ff7aa2")
    sparkle(img, 1160, 70, 10, "#b58cff")
    y = headline(img, ["Everything Nura,", "one click away"], "thenura.care", "#4a1030")
    text(img, (64, y + 8), "Guides, doctors, plans & our story", 22, "#7a3d57", "SemiBold")
    pill(img, (64, y + 50), "Visit our website", "#e0457b", "#ffffff")
    save(img, "website-visit", WIDE)


def youtube():
    img = canvas(WIDE, [(0, "#1a0b12"), (0.6, "#3a0f1d"), (1, "#7a1426")], 10)
    glow(img, (930, 200), 240, "#ff2e4d", 110, 50)
    # Video player
    px0, py0, px1, py1 = 700, 70, 1140, 330
    shadow(img, (px0, py0, px1, py1), 20, alpha=120, blur=20)
    thumb = gradient((110, 65), [(0, "#ffb3c6"), (0.5, "#ff6f91"), (1, "#8b5cf6")], 35).resize((440 * S, 260 * S)).convert("RGBA")
    m = Image.new("L", thumb.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, thumb.size[0], thumb.size[1]], 20 * S, fill=255)
    img.paste(thumb, (px0 * S, py0 * S), m)
    blob(img, (px0 + 40, py0 + 60, px0 + 170, py0 + 190), "#ffffff", 60)
    blob(img, (px1 - 150, py0 + 20, px1 - 30, py0 + 140), "#ffffff", 45)
    # Play button
    rrect(img, (870, 160, 970, 230), 22, "#ff0033")
    poly(img, [(907, 176), (907, 214), (940, 195)], "#ffffff")
    # Progress bar
    rrect(img, (px0 + 20, py1 - 26, px1 - 20, py1 - 20), 3, "#ffffff", 120)
    rrect(img, (px0 + 20, py1 - 26, px0 + 180, py1 - 20), 3, "#ff0033")
    blob(img, (px0 + 172, py1 - 31, px0 + 188, py1 - 15), "#ff0033")
    sparkle(img, 660, 300, 12, "#ff8fa3")
    y = headline(img, ["Doctor-led videos", "on YouTube"], "Watch & learn")
    text(img, (64, y + 8), "Periods, PCOS, pregnancy — explained simply", 22, "#ffd6de", "SemiBold")
    pill(img, (64, y + 50), "Subscribe", "#ff0033", "#ffffff")
    save(img, "youtube-subscribe", WIDE)


def rate():
    img = canvas(WIDE, [(0, "#2e1065"), (0.55, "#5b21b6"), (1, "#a855f7")], 20)
    glow(img, (930, 190), 230, "#ffd36e", 90, 50)
    for i in range(5):
        cx = 740 + i * 90
        cy = 170 + (-18 if i == 2 else (-8 if i in (1, 3) else 0))
        r = 50 if i == 2 else 40
        l = layer(img)
        ImageDraw.Draw(l).polygon([(x * S, (y + 8) * S) for x, y in star(cx, cy, r)], fill=(20, 0, 40, 90))
        img.alpha_composite(l.filter(ImageFilter.GaussianBlur(6 * S)))
        poly(img, star(cx, cy, r), "#ffc83d")
        poly(img, star(cx - r * 0.12, cy - r * 0.15, r * 0.42), "#ffe38a")
    # Review card
    rrect(img, (760, 250, 1100, 330), 20, "#ffffff", 235)
    blob(img, (778, 266, 826, 314), "#ffb4c8")
    text(img, (842, 268), "“Finally an app that gets me”", 19, "#3b0764", "Bold")
    text(img, (842, 296), "— Ananya, Pune", 16, "#7c5a9e", "SemiBold")
    for p in [(700, 80, 12), (1150, 110, 14), (1140, 300, 9)]:
        sparkle(img, *p)
    y = headline(img, ["Loving Nura?", "Rate us 5 stars"], "Takes 10 seconds")
    text(img, (64, y + 8), "Your review helps more women find us", 22, "#eadcff", "SemiBold")
    pill(img, (64, y + 50), "Rate on Play Store", "#ffc83d", "#3b0764")
    save(img, "rate-us", WIDE)


def premium():
    img = canvas(WIDE, [(0, "#4a0d2e"), (0.5, "#9d174d"), (1, "#f472b6")], 20)
    glow(img, (940, 200), 250, "#ffd6a5", 90, 50)
    # Crown
    cx, cy = 930, 190
    crown = [(cx - 130, cy + 70), (cx - 150, cy - 60), (cx - 65, cy + 5), (cx, cy - 95), (cx + 65, cy + 5), (cx + 150, cy - 60), (cx + 130, cy + 70)]
    l = layer(img)
    ImageDraw.Draw(l).polygon([(x * S, (y + 12) * S) for x, y in crown], fill=(40, 0, 20, 110))
    img.alpha_composite(l.filter(ImageFilter.GaussianBlur(10 * S)))
    poly(img, crown, "#ffc94d")
    poly(img, [(cx - 130, cy + 40), (cx + 130, cy + 40), (cx + 130, cy + 70), (cx - 130, cy + 70)], "#f5a524")
    for x, y, c in [(cx - 150, cy - 60, "#ff7aa2"), (cx, cy - 95, "#b58cff"), (cx + 150, cy - 60, "#5fe0c0")]:
        blob(img, (x - 16, y - 16, x + 16, y + 16), c)
        blob(img, (x - 8, y - 10, x, y - 2), "#ffffff", 200)
    for i, c in enumerate(["#ff7aa2", "#ffffff", "#5fe0c0", "#ffffff", "#b58cff"]):
        blob(img, (cx - 92 + i * 42, cy + 48, cx - 76 + i * 42, cy + 64), c)
    for p in [(760, 90, 16), (1110, 90, 12), (1120, 300, 18), (760, 300, 10)]:
        sparkle(img, *p, color="#ffe8b0")
    y = headline(img, ["Unlock Nura", "Premium"], "Limited offer")
    text(img, (64, y + 8), "Deeper insights, doctor chats & no ads", 22, "#ffe0ec", "SemiBold")
    pill(img, (64, y + 50), "See plans", "#ffc94d", "#4a0d2e")
    save(img, "premium-unlock", WIDE)


# ------------------------------ Card thumbnails ----------------------------- #


def thumb(name, stops, draw):
    img = canvas(THUMB, stops, 35)
    draw(img)
    save(img, name, THUMB)


def t_consult(img):
    glow(img, (172, 144), 120, "#ffffff", 80)
    rrect(img, (92, 60, 252, 230), 26, "#ffffff")
    rrect(img, (152, 100, 192, 190), 8, "#ff5c8a")
    rrect(img, (127, 125, 217, 165), 8, "#ff5c8a")
    blob(img, (220, 40, 290, 110), "#ffd36e")
    poly(img, heart(255, 76, 20), "#ffffff")
    sparkle(img, 70, 70, 12)


def t_ai(img):
    glow(img, (172, 144), 130, "#ffffff", 70)
    rrect(img, (54, 64, 250, 164), 28, "#ffffff")
    poly(img, [(90, 160), (80, 196), (122, 162)], "#ffffff")
    for i in range(3):
        blob(img, (104 + i * 36, 104, 124 + i * 36, 124), "#8b5cf6")
    rrect(img, (140, 180, 300, 250), 24, "#c4b5fd")
    poly(img, [(270, 246), (292, 272), (258, 248)], "#c4b5fd")
    sparkle(img, 280, 70, 24, "#ffe38a")
    sparkle(img, 250, 44, 12, "#ffffff")


def t_community(img):
    glow(img, (172, 150), 130, "#ffffff", 70)
    for x, y, r, c in [(92, 120, 44, "#ffb4c8"), (252, 120, 44, "#c7b6ff"), (172, 104, 54, "#ffd88a")]:
        blob(img, (x - r, y - r, x + r, y + r), c)
        rrect(img, (x - r - 14, y + r - 6, x + r + 14, y + r + 70), 34, c)
    poly(img, heart(172, 222, 30), "#ff4d7d")
    sparkle(img, 300, 50, 12)


def t_invite(img):
    glow(img, (172, 150), 130, "#ffffff", 70)
    rrect(img, (82, 120, 262, 250), 18, "#ff6b8b")
    rrect(img, (70, 94, 274, 136), 14, "#ff8fab")
    rrect(img, (160, 94, 184, 250), 0, "#ffd36e")
    ImageDraw.Draw(img).ellipse([118 * S, 44 * S, 172 * S, 100 * S], outline=rgb("#ffd36e") + (255,), width=12 * S)
    ImageDraw.Draw(img).ellipse([172 * S, 44 * S, 226 * S, 100 * S], outline=rgb("#ffd36e") + (255,), width=12 * S)
    sparkle(img, 50, 60, 14)
    sparkle(img, 300, 90, 10)


def t_blog(img):
    glow(img, (172, 150), 130, "#ffffff", 70)
    shadow(img, (70, 56, 240, 250), 16, alpha=40)
    rrect(img, (96, 44, 266, 238), 16, "#fff4e6")
    rrect(img, (70, 56, 240, 250), 16, "#ffffff")
    rrect(img, (90, 76, 220, 140), 10, "#ffc9a8")
    blob(img, (170, 84, 200, 114), "#fff4e6")
    for i, w in enumerate([130, 110, 124, 80]):
        rrect(img, (90, 156 + i * 20, 90 + w, 166 + i * 20), 5, "#f0d9cc")
    sparkle(img, 290, 70, 16, "#ffffff")


def t_forest(img):
    glow(img, (172, 150), 130, "#ffffff", 80)
    blob(img, (20, 210, 324, 330), "#6fcf97")
    for x, h, c in [(90, 120, "#2f9e67"), (172, 160, "#1f8a57"), (254, 110, "#3fb67a")]:
        rrect(img, (x - 7, 250 - h * 0.35, x + 7, 250), 4, "#8b5a3c")
        poly(img, [(x, 250 - h), (x - h * 0.38, 250 - h * 0.3), (x + h * 0.38, 250 - h * 0.3)], c)
    blob(img, (250, 30, 300, 80), "#ffe38a")
    sparkle(img, 60, 60, 12)


def t_cycle(img):
    glow(img, (172, 144), 130, "#ffffff", 80)
    ImageDraw.Draw(img).ellipse([72 * S, 44 * S, 272 * S, 244 * S], outline=(255, 255, 255, 255), width=22 * S)
    ImageDraw.Draw(img).arc([72 * S, 44 * S, 272 * S, 244 * S], -90, 40, fill=rgb("#ff4d7d") + (255,), width=22 * S)
    blob(img, (140, 112, 204, 176), "#ffffff")
    poly(img, heart(172, 146, 18), "#ff4d7d")
    sparkle(img, 300, 60, 14)


if __name__ == "__main__":
    whatsapp()
    instagram()
    website()
    youtube()
    rate()
    premium()
    thumb("thumb-consultation", [(0, "#ffd9e4"), (1, "#ff9cb8")], t_consult)
    thumb("thumb-ask-ai", [(0, "#ede7ff"), (1, "#a78bfa")], t_ai)
    thumb("thumb-community", [(0, "#fff0d6"), (1, "#ffc38a")], t_community)
    thumb("thumb-invite", [(0, "#ffe3ec"), (1, "#ffb3c8")], t_invite)
    thumb("thumb-blog", [(0, "#ffe9dc"), (1, "#ffb88f")], t_blog)
    thumb("thumb-forest", [(0, "#e3fbe9"), (1, "#9be3b5")], t_forest)
    thumb("thumb-cycle", [(0, "#ffe0ea"), (1, "#ff8fb0")], t_cycle)
