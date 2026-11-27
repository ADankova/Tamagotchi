#!/usr/bin/env python3
"""Обрезает картинки природы из PixelLab (деревья, валуны, руда, трава) по рамке и кладёт в art/nature/.
Запуск: python3 scripts/nature-build.py <json_со_списком>  ({"tree_0": "путь.png", ...})."""
import json, sys, os
from PIL import Image

src = json.load(open(sys.argv[1]))
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'art', 'nature')
os.makedirs(out, exist_ok=True)
for name, path in src.items():
    im = Image.open(path).convert('RGBA')
    box = im.getbbox()
    if box:
        im = im.crop(box)
    im.save(os.path.join(out, name + '.png'))
    print(name, im.size)
