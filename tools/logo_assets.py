#!/usr/bin/env python3
"""Cut the website's logo images from the company logo.

Source: brand/prime-acre-capital-logo.webp (1254x1254, gold on black).
Writes to site/assets/img:
  pac-monogram.png              gold PAC monogram on a transparent background (header, footer, chat)
  favicon-48.png                browser tab icon
  apple-touch-icon.png          home-screen icon
  prime-acre-capital-logo.jpg   full logo (about section, structured data)
  prime-acre-capital-logo-1254.webp  the same at full size, for high-density screens
  landscape.webp                the gold-etched hills, used along the bottom of the hero
  og-image.jpg                  1200x630 card shown when a link to the site is shared

Needs Pillow and numpy:  pip install pillow numpy  &&  python3 tools/logo_assets.py
The crop boxes match the current logo file; re-check them if the logo artwork changes.
"""
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "brand", "prime-acre-capital-logo.webp")
OUT = os.path.join(ROOT, "site", "assets", "img")
BLACK = (12, 11, 9)

MONOGRAM_BOX = (450, 204, 822, 628)   # P, A and C, down to the A's feet
LOCKUP_BOX = (130, 200, 1125, 910)    # monogram, PRIME ACRE, CAPITAL and the tagline
LANDSCAPE_BOX = (0, 935, 1254, 1254)  # hills below the tagline


def keyed(img, box, floor=14):
    """Turn gold-on-black into gold on transparent (black becomes see-through), trimmed to the artwork."""
    c = np.asarray(img.crop(box)).astype(float)
    mx = c.max(axis=2)
    alpha = np.clip((mx - floor) / (255 - floor), 0, 1)
    col = np.where(alpha[..., None] > 0.003, (c - floor * (1 - alpha[..., None])) / np.maximum(alpha[..., None], 1e-3), 0)
    out = Image.fromarray(np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8), "RGBA")
    return out.crop(out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def fit_h(img, h):
    return img.resize((round(img.width * h / img.height), h), Image.LANCZOS)


def square_icon(mono, size, radius_frac, pad):
    s = size * 4
    base = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(base).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius_frac), fill=BLACK + (255,))
    inner = fit_h(mono, int(s * (1 - 2 * pad)))
    base.alpha_composite(inner, ((s - inner.width) // 2, (s - inner.height) // 2))
    return base.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    logo = Image.open(SRC).convert("RGB")
    px = np.asarray(logo).copy()
    px[619:628, 772:900] = 6  # the gold rule that runs into the A's right foot
    clean = Image.fromarray(px)

    mono = keyed(clean, MONOGRAM_BOX)
    # 256-color palette: looks the same in the header and is about a third of the size
    fit_h(mono, 168).quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(OUT, "pac-monogram.png"), optimize=True)
    square_icon(mono, 48, 0.2, 0.1).save(os.path.join(OUT, "favicon-48.png"), optimize=True)
    touch = Image.new("RGBA", (180, 180), BLACK + (255,))
    inner = fit_h(mono, 128)
    touch.alpha_composite(inner, ((180 - inner.width) // 2, (180 - inner.height) // 2))
    touch.convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)

    logo.resize((720, 720), Image.LANCZOS).save(os.path.join(OUT, "prime-acre-capital-logo.jpg"), quality=86, optimize=True, progressive=True)
    logo.save(os.path.join(OUT, "prime-acre-capital-logo-1254.webp"), quality=82, method=6)
    logo.crop(LANDSCAPE_BOX).save(os.path.join(OUT, "landscape.webp"), quality=60, method=6)

    w, h = 1200, 630
    card = Image.new("RGBA", (w, h), (6, 6, 6, 255))
    land = logo.crop(LANDSCAPE_BOX)
    land = land.resize((w, round(land.height * w / land.width)), Image.LANCZOS).convert("RGBA")
    ramp = np.clip((np.arange(land.height) - land.height * 0.10) / (land.height * 0.45), 0, 1)
    land.putalpha(Image.fromarray((np.tile(ramp[:, None], (1, w)) * 255).astype(np.uint8)))
    card.alpha_composite(land, (0, h - land.height + 40))
    lockup = fit_h(keyed(clean, LOCKUP_BOX), 392)
    card.alpha_composite(lockup, ((w - lockup.width) // 2, 30))
    card.convert("RGB").save(os.path.join(OUT, "og-image.jpg"), quality=86, optimize=True, progressive=True)

    for name in sorted(os.listdir(OUT)):
        print("%-30s %7d bytes" % (name, os.path.getsize(os.path.join(OUT, name))))


if __name__ == "__main__":
    main()
