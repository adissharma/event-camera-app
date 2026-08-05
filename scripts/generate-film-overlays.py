#!/usr/bin/env python3
"""Regenerates the disposable-filter overlay textures.

Run from the repo root: python3 scripts/generate-film-overlays.py

Writes transparent PNGs to assets/images/textures/:
  dust-1.png, dust-2.png            sparse specks
  scratches-1.png, scratches-2.png  fine near-vertical emulsion scratches

Two variants of each so the per-photo randomiser has something to choose
between (see src/features/media/disposable-recipe.ts). They are drawn with a
`screen`-style blend at low opacity, so marks are near-white on transparent
and the alpha channel carries the shape.

Portrait 9:16 at 1080x1920 — big enough that a full-screen photo viewer never
upscales them into visible blobs. `screen` blending makes the fully
transparent background a no-op, so the aspect mismatch on a landscape photo
costs nothing but a little stretch on marks that are meant to look random
anyway.
"""

import random

from PIL import Image, ImageDraw

WIDTH, HEIGHT = 1080, 1920


def make_dust(path: str, seed: int, speck_count: int) -> None:
    """Sparse specks — mostly sub-pixel dots, a few larger motes."""
    random.seed(seed)
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for _ in range(speck_count):
        x = random.randrange(WIDTH)
        y = random.randrange(HEIGHT)
        # Heavily weighted to the small end: real dust is mostly tiny, with
        # the occasional bigger mote that sells the effect.
        radius = random.choice([0, 0, 0, 1, 1, 2])
        alpha = random.randint(40, 150)
        draw.ellipse([x - radius, y - radius, x + radius, y + radius],
                     fill=(255, 255, 255, alpha))

    img.save(path)
    print(f"saved {path}")


def make_scratches(path: str, seed: int, line_count: int) -> None:
    """Fine near-vertical scratches, drawn as jittered 1px segment runs."""
    random.seed(seed)
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for _ in range(line_count):
        x = random.randrange(WIDTH)
        # Scratches rarely run the whole frame; a partial run reads as film
        # damage rather than a drawn line.
        y_start = random.randrange(0, HEIGHT // 2)
        y_end = random.randrange(y_start + HEIGHT // 6, HEIGHT)
        base_alpha = random.randint(30, 90)

        y = y_start
        while y < y_end:
            segment = random.randint(8, 40)
            # Drift sideways a little so the scratch isn't a ruler-straight line.
            x += random.choice([-1, 0, 0, 0, 1])
            x = max(0, min(WIDTH - 1, x))
            # Fade in and out along the run so ends taper instead of stopping dead.
            progress = (y - y_start) / max(1, y_end - y_start)
            taper = min(1.0, 2.5 * min(progress, 1.0 - progress) + 0.15)
            alpha = int(base_alpha * taper)
            if alpha > 0:
                draw.line([x, y, x, min(y + segment, y_end)],
                          fill=(255, 255, 255, alpha), width=1)
            y += segment

    img.save(path)
    print(f"saved {path}")


if __name__ == "__main__":
    base = "assets/images/textures"
    make_dust(f"{base}/dust-1.png", seed=11, speck_count=420)
    make_dust(f"{base}/dust-2.png", seed=27, speck_count=260)
    make_scratches(f"{base}/scratches-1.png", seed=5, line_count=7)
    make_scratches(f"{base}/scratches-2.png", seed=19, line_count=4)
