#!/usr/bin/env python3
"""sprite_prep — chroma-key + trim + resize for CHONK'EM generated assets.
Usage: ~/ComfyUI/venv/bin/python tools/sprite_prep.py <in.png> <out.png> [--height N]
Removes magenta chroma background -> true alpha, despills magenta edge cast,
trims to content bbox (+pad), resizes to --height (preserving aspect)."""
import sys
import numpy as np
from PIL import Image

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    height = None
    for a in sys.argv[1:]:
        if a.startswith('--height'):
            height = int(a.split('=')[1]) if '=' in a else None
    if height is None:
        for i, a in enumerate(sys.argv):
            if a == '--height':
                height = int(sys.argv[i+1])
    src, dst = args[0], args[1]
    im = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
    r, g, b, a = im[:,:,0], im[:,:,1], im[:,:,2], im[:,:,3]

    # Magenta-ness: high R, low G, high B (chroma is #FF00FF-ish)
    mag = np.minimum(r, b) - g
    alpha = np.clip((60.0 - mag) / 45.0, 0, 1)          # 0 inside chroma, 1 on subject
    # keep any real alpha channel the model gave us
    alpha = np.minimum(alpha, a / 255.0)

    # Despill: pull magenta cast out of edge pixels
    edge = (alpha > 0.02) & (alpha < 0.98)
    spill = np.clip(np.minimum(r, b) - g, 0, 255)
    k = edge * np.clip(spill / 120.0, 0, 1) * 0.85
    r2 = r - k * (r - np.minimum(g, r))
    b2 = b - k * (b - np.minimum(g, b))

    out = np.stack([r2, g, b2, alpha * 255], axis=-1).astype(np.uint8)
    img = Image.fromarray(out)

    # Trim to content bbox with 12px pad
    ys, xs = np.where(alpha > 0.05)
    if len(xs) == 0:
        sys.exit('empty sprite after chroma removal')
    pad = 12
    x0, x1 = max(xs.min()-pad, 0), min(xs.max()+pad, im.shape[1])
    y0, y1 = max(ys.min()-pad, 0), min(ys.max()+pad, im.shape[0])
    img = img.crop((x0, y0, x1, y1))

    if height:
        w = round(img.width * height / img.height)
        img = img.resize((w, height), Image.LANCZOS)
    img.save(dst)
    print(f'{dst}: {img.width}x{img.height} RGBA')

main()
