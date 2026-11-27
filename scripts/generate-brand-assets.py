"""
Generates every PolyCheck logo raster from the one source picture.

    python scripts/generate-brand-assets.py
    cd polycheck_mobile && dart run flutter_launcher_icons

Source: scripts/brand/polycheck-logo-source.png (the rounded icon on a light
backdrop). Replace that file with a larger export to sharpen every size, then
re-run both commands; adjust SOURCE_BOX if the new picture is framed
differently. An institution's own logo is uploaded at runtime from Institution
Settings (see the branding module) and replaces this mark in the web UI.
Requires Pillow.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SOURCE = os.path.join(ROOT, "scripts", "brand", "polycheck-logo-source.png")
# The rounded icon inside the source picture, trimmed 2px to drop the soft light edge.
SOURCE_BOX = (20, 27, 349, 360)
CORNER = 0.195
# The icon's own deep red; also the Android adaptive icon background (colors.xml / pubspec.yaml).
BACKGROUND = (104, 9, 24, 255)
MASTER = 1024


def rounded_mask(size: int, radius: float) -> Image.Image:
    big = size * 4
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * radius), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def master() -> Image.Image:
    art = Image.open(SOURCE).convert("RGB").crop(SOURCE_BOX).resize((MASTER, MASTER), Image.LANCZOS)
    art = art.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2)).convert("RGBA")
    art.putalpha(rounded_mask(MASTER, CORNER))
    return art


def rounded(art: Image.Image, size: int) -> Image.Image:
    return art.resize((size, size), Image.LANCZOS)


def full_bleed(art: Image.Image, size: int) -> Image.Image:
    """Square with no transparency, for icons the platform masks itself."""
    canvas = Image.new("RGBA", (MASTER, MASTER), BACKGROUND)
    canvas.alpha_composite(art)
    return canvas.resize((size, size), Image.LANCZOS)


def padded(art: Image.Image, size: int, scale: float, background=(0, 0, 0, 0)) -> Image.Image:
    """The icon centred and shrunk inside a larger canvas (safe zone for round masks)."""
    inner = int(MASTER * scale)
    canvas = Image.new("RGBA", (MASTER, MASTER), background)
    offset = (MASTER - inner) // 2
    canvas.alpha_composite(art.resize((inner, inner), Image.LANCZOS), (offset, offset))
    return canvas.resize((size, size), Image.LANCZOS)


def silhouette(art: Image.Image) -> Image.Image:
    """The white and gold shapes as one white stencil, for Android themed icons."""
    stencil = Image.new("RGBA", art.size, (255, 255, 255, 0))
    alpha = []
    for r, g, b, a in art.getdata():
        light = max(0, min(255, int((g - 60) * 255 / 70)))
        alpha.append(min(a, light) if r > 140 else 0)
    mask = Image.new("L", art.size)
    mask.putdata(alpha)
    stencil.putalpha(mask)
    return stencil


def save(image: Image.Image, relative: str) -> None:
    path = os.path.join(ROOT, relative)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, optimize=True)
    print("wrote", relative, image.size)


def main() -> None:
    art = master()

    # Web.
    save(rounded(art, 512), "frontend/public/brand-mark.png")
    save(rounded(art, 512), "frontend/public/icons/icon-512.png")
    save(rounded(art, 192), "frontend/public/icons/icon-192.png")
    save(full_bleed(art, 180), "frontend/public/icons/apple-touch-icon.png")
    save(padded(art, 512, 0.78, BACKGROUND), "frontend/public/icons/icon-maskable-512.png")
    favicon_path = os.path.join(ROOT, "frontend/src/app/favicon.ico")
    rounded(art, 256).save(favicon_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote frontend/src/app/favicon.ico")

    # Flutter (assets plus the inputs flutter_launcher_icons reads).
    base = "polycheck_mobile/assets/branding"
    save(rounded(art, 512), f"{base}/brand-mark.png")
    save(full_bleed(art, 1024), f"{base}/brand-mark-square.png")
    save(full_bleed(art, 1024), f"{base}/brand-mark-maroon.png")
    # The launcher insets these by 16%, so 0.88 here keeps the whole word inside a round mask.
    save(padded(art, 512, 0.88), f"{base}/android-icon-foreground.png")
    save(padded(silhouette(art), 432, 0.88), f"{base}/android-icon-monochrome.png")


if __name__ == "__main__":
    main()
