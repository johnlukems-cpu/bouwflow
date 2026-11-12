"""Genereert logo-varianten uit het officiële BouwFlow-logo (public/brand/bouwflow-logo.png).
Gebruik: python3 scripts/brand/make-logos.py
Het origineel wordt nooit gewijzigd; varianten worden alleen afgeleid (geen hertekening).
"""
from collections import deque
from PIL import Image

SRC = "public/brand/bouwflow-logo.png"
OUT = "public/brand"

src = Image.open(SRC).convert("RGBA")
W, H = src.size
px = src.load()

def is_bg(p, tol=18):
    r, g, b, a = p
    return r >= 255 - tol and g >= 255 - tol and b >= 255 - tol

WORD_BOX_Y0 = 800

# 1. Buitenachtergrond transparant via flood fill vanaf de randen (binnenwit blijft wit)
mask = [[False] * H for _ in range(W)]
q = deque()
for x in range(W):
    q.extend([(x, 0), (x, H - 1)])
for y in range(H):
    q.extend([(0, y), (W - 1, y)])
while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= W or y >= H or mask[x][y] or not is_bg(px[x, y]):
        continue
    mask[x][y] = True
    q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

transparent = src.copy()
tp = transparent.load()
for x in range(W):
    for y in range(H):
        if mask[x][y]:
            tp[x, y] = (255, 255, 255, 0)
        else:
            # zachte rand: pixels naast de achtergrond die bijna wit zijn half transparant
            r, g, b, a = tp[x, y]
            m = min(r, g, b)
            if m > 225 and any(
                0 <= x + dx < W and 0 <= y + dy < H and mask[x + dx][y + dy]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                tp[x, y] = (r, g, b, int(255 * (255 - m) / 30))

# Ingesloten binnenruimtes van letters (bijv. de "O") ook transparant maken
for x in range(W):
    for y in range(WORD_BOX_Y0, H):
        r, g, b, a = tp[x, y]
        if a and min(r, g, b) > 232:
            tp[x, y] = (255, 255, 255, 0)

def trim(img, pad=8):
    bbox = img.getbbox()
    x0, y0, x1, y1 = bbox
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))

ICON_BOX = (270, 100, 1050, 790)       # beeldmerk (huis + pijl)
WORD_BOX = (0, 800, W, 1030)           # woordmerk "BouwFlow"
SLOGAN_BOX = (0, 1030, W, 1120)        # slogan

light = trim(transparent)
light.save(f"{OUT}/bouwflow-logo-light.png", optimize=True)

# 2. Donkere variant: donkerblauwe tekst en grijze slogan omkleuren naar wit/lichtgrijs
dark = transparent.copy()
dp = dark.load()
for x in range(W):
    for y in range(WORD_BOX[1], SLOGAN_BOX[3]):
        r, g, b, a = dp[x, y]
        if a == 0:
            continue
        if b > r + 15 and r < 120 and g < 120:          # donkerblauw → wit
            k = 1 - (max(r, g, b) / 255)
            v = int(255 - 0 * k)
            dp[x, y] = (v, v, v, a)
        elif abs(r - g) < 14 and abs(g - b) < 14 and r < 200:  # grijs → lichtgrijs
            dp[x, y] = (205, 213, 222, a)
trim(dark).save(f"{OUT}/bouwflow-logo-dark.png", optimize=True)

# 3. Beeldmerk (transparant) en beeldmerk op witte tegel
mark = trim(transparent.crop(ICON_BOX), pad=4)
side = max(mark.size)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark)
sq.resize((512, 512), Image.LANCZOS).save(f"{OUT}/bouwflow-mark.png", optimize=True)

tile = Image.new("RGBA", (side + side // 6, side + side // 6), (255, 255, 255, 255))
tile.paste(sq, (side // 12, side // 12), sq)

# 4. Compact logo (beeldmerk + woordmerk naast elkaar) voor licht en donker
def compact(base):
    m = trim(base.crop(ICON_BOX), pad=2)
    w = trim(base.crop(WORD_BOX), pad=2)
    h = 160
    m = m.resize((int(m.width * h / m.height), h), Image.LANCZOS)
    wh = int(h * 0.62)
    w = w.resize((int(w.width * wh / w.height), wh), Image.LANCZOS)
    out = Image.new("RGBA", (m.width + 28 + w.width, h), (0, 0, 0, 0))
    out.paste(m, (0, 0), m)
    out.paste(w, (m.width + 28, (h - wh) // 2 + 6), w)
    return out

compact(transparent).save(f"{OUT}/bouwflow-compact-light.png", optimize=True)
# Donkere achtergrond: beeldmerk op een witte tegel zodat het donkerblauw zichtbaar blijft
def compact_dark():
    h = 160
    t = tile.resize((h, h), Image.LANCZOS)
    mask_r = Image.new("L", (h, h), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask_r).rounded_rectangle((0, 0, h - 1, h - 1), radius=32, fill=255)
    t.putalpha(mask_r)
    w = trim(dark.crop(WORD_BOX), pad=2)
    wh = int(h * 0.62)
    w = w.resize((int(w.width * wh / w.height), wh), Image.LANCZOS)
    out = Image.new("RGBA", (h + 28 + w.width, h), (0, 0, 0, 0))
    out.paste(t, (0, 0), t)
    out.paste(w, (h + 28, (h - wh) // 2 + 6), w)
    return out

compact_dark().save(f"{OUT}/bouwflow-compact-dark.png", optimize=True)

# 5. Favicon / app-iconen
icon_src = tile.resize((512, 512), Image.LANCZOS)
icon_src.save("src/app/icon.png", optimize=True)
icon_src.convert("RGB").resize((180, 180), Image.LANCZOS).save("src/app/apple-icon.png", optimize=True)
icon_src.resize((192, 192), Image.LANCZOS).save(f"{OUT}/icon-192.png", optimize=True)
icon_src.save(f"{OUT}/icon-512.png", optimize=True)
icon_src.save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
# Open Graph-afbeelding: logo gecentreerd op wit
og = Image.new("RGB", (1200, 630), (255, 255, 255))
lg = light.copy()
lg.thumbnail((560, 560), Image.LANCZOS)
og.paste(lg, ((1200 - lg.width) // 2, (630 - lg.height) // 2), lg)
og.save("src/app/opengraph-image.png", optimize=True)
print("klaar")
