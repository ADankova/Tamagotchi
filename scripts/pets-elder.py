#!/usr/bin/env python3
"""Старички = взрослые (форма «обычная») с седой шерстью: берёт листы *_adultNormal и обесцвечивает мех.
Запуск после pets-build.py и pets-prune.py: python3 scripts/pets-elder.py  (пишет art/pets/*_elder.png, meta.json, src/render/petMeta.ts)."""
import colorsys, json, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'art', 'pets')
SPECIES = ['cat', 'dog', 'blob']
SRC_FORM = 'adultNormal'

def grey(px):
    r, g, b, a = px
    if a == 0:
        return px
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if v < 0.28 or (0.5 < h < 0.75 and s > 0.35) or ((h < 0.04 or h > 0.95) and s > 0.6):
        return px                                    # контуры, глаза, ошейник и бубенчик не трогаем
    s *= 0.14                                        # почти без цвета
    v = v * 0.80 if v > 0.6 else v * 0.90            # светлый мех становится серым, а не белым
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    # лёгкий холодный оттенок седины
    return (int(r * 255 * 0.97), int(g * 255 * 0.99), min(255, int(b * 255 * 1.04)), a)

def main():
    meta = json.load(open(os.path.join(DIR, 'meta.json')))
    for sp in SPECIES:
        im = Image.open(os.path.join(DIR, f'{sp}_{SRC_FORM}.png')).convert('RGBA')
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                px[x, y] = grey(px[x, y])
        im.save(os.path.join(DIR, f'{sp}_elder.png'), optimize=True)
        meta[f'{sp}_elder'] = json.loads(json.dumps(meta[f'{sp}_{SRC_FORM}']))
    json.dump(meta, open(os.path.join(DIR, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    path = os.path.join(ROOT, 'src', 'render', 'petMeta.ts')
    ts = open(path).read()
    for sp in SPECIES:
        src = re.search(rf'^  {sp}_{SRC_FORM}: (.*),$', ts, re.M).group(1)
        ts = re.sub(rf'^  {sp}_elder: .*,$', lambda m: f'  {sp}_elder: {src},', ts, flags=re.M)
    open(path, 'w').write(ts)

main()
