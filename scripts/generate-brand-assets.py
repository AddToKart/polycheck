"""
Generates the neutral Polycheck brand mark and every raster derived from it.

    python scripts/generate-brand-assets.py

The mark is a gold check inside a ring on the app's maroon, so it carries no
institution's identity. An institution's own logo is uploaded at runtime from
Institution Settings (see the branding module) and replaces this default in the UI.
Requires Pillow. Re-run after changing the palette.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAROON = (123, 17, 19, 255)
GOLD = (255, 223, 0, 255)
WHITE = (255, 255, 255, 255)
SUPERSAMPLE = 4


def draw_mark(size: int, *, background: str, scale: float = 1.0, ink=GOLD, check=WHITE, radius: float = 0.0) -> Image.Image:
    """background: 'none' (transparent) or 'maroon'. scale shrinks the glyph inside the canvas (adaptive-icon safe zone)."""
    big = size * SUPERSAMPLE
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if background == "maroon":
        if radius > 0:
            draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * radius), fill=MAROON)
        else:
            draw.rectangle([0, 0, big, big], fill=MAROON)

    centre = big / 2
    outer = big * 0.34 * scale
    ring_width = max(2, int(big * 0.055 * scale))
    draw.ellipse([centre - outer, centre - outer, centre + outer, centre + outer], outline=ink, width=ring_width)

    # Check mark, sized relative to the ring.
    unit = outer
    points = [
        (centre - unit * 0.48, centre + unit * 0.02),
        (centre - unit * 0.12, centre + unit * 0.38),
        (centre + unit * 0.52, centre - unit * 0.34),
    ]
    draw.line(points, fill=check, width=max(3, int(big * 0.075 * scale)), joint="curve")
    for x, y in (points[0], points[-1]):
        r = max(2, int(big * 0.0375 * scale))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=check)
    return image.resize((size, size), Image.LANCZOS)


def save(image: Image.Image, relative: str) -> None:
    path = os.path.join(ROOT, relative)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path)
    print("wrote", relative, image.size)


def main() -> None:
    # Web.
    save(draw_mark(512, background="maroon", radius=0.22), "frontend/public/brand-mark.png")
    save(draw_mark(512, background="maroon", radius=0.22), "frontend/public/icons/icon-512.png")
    save(draw_mark(192, background="maroon", radius=0.22), "frontend/public/icons/icon-192.png")
    save(draw_mark(180, background="maroon"), "frontend/public/icons/apple-touch-icon.png")
    favicon = draw_mark(256, background="maroon", radius=0.22)
    favicon_path = os.path.join(ROOT, "frontend/src/app/favicon.ico")
    favicon.save(favicon_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote frontend/src/app/favicon.ico")

    # Flutter (the files keep their roles; only the artwork and neutral names change).
    base = "polycheck_mobile/assets/branding"
    save(draw_mark(1024, background="maroon", radius=0.22), f"{base}/brand-mark.png")
    save(draw_mark(1024, background="maroon"), f"{base}/brand-mark-square.png")
    save(draw_mark(1024, background="maroon"), f"{base}/brand-mark-maroon.png")
    # Adaptive foreground/monochrome: glyph inside the 66% safe zone on a transparent canvas.
    save(draw_mark(512, background="none", scale=0.82), f"{base}/android-icon-foreground.png")
    save(draw_mark(432, background="none", scale=0.82, ink=WHITE, check=WHITE), f"{base}/android-icon-monochrome.png")


if __name__ == "__main__":
    main()
