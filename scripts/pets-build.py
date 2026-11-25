#!/usr/bin/env python3
"""Собирает листы питомцев из выдачи PixelLab: убирает подложку и подпись, режет по строкам.
Запуск: python3 scripts/pets-build.py <папка_с_листами>  (листы лежат в art/pets-src.json как «имя → файл»)."""
import json, sys, os
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = json.load(open(os.path.join(ROOT, 'art', 'pets-src.json')))
BG = (31, 37, 44)
OUT = os.path.join(ROOT, 'art', 'pets')
os.makedirs(OUT, exist_ok=True)

def clean(im, cell, rows, cols):
    im = im.convert('RGBA')
    top = im.height - cell * rows
    im = im.crop((0, top, cell * cols, im.height))
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if (r, g, b) == BG or a == 0:
                px[x, y] = (0, 0, 0, 0)
    return im

meta = {}
for name, spec in MAP.items():
    cell = spec.get('cell', 64)
    rows, cols = spec['rows'], spec['cols']
    im = clean(Image.open(os.path.join(SRC, spec['file'])), cell, rows, cols)
    # Баланс: у блоба-малыша сон «рассыпался» — берём вместо него кадры покоя.
    if spec.get('copyRow'):
        dst, srcrow = spec['copyRow']
        im.paste(im.crop((0, srcrow * cell, cols * cell, (srcrow + 1) * cell)), (0, dst * cell))
    bbox = im.getbbox()
    # Нижняя точка и центр по всем кадрам: по ним питомец ставится на пол.
    bottom, left, right = 0, im.width, 0
    for r in range(rows):
        for c in range(cols):
            b = im.crop((c * cell, r * cell, (c + 1) * cell, (r + 1) * cell)).getbbox()
            if b:
                bottom = max(bottom, b[3]); left = min(left, b[0]); right = max(right, b[2])
    meta[name] = {'cell': cell, 'cols': cols, 'rows': spec['names'], 'feet': bottom, 'left': left, 'right': right}
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
ts = ['// Сгенерировано scripts/pets-build.py — не править руками.',
      'export interface SheetMeta {',
      '  cell: number;',
      '  cols: number;',
      '  /** Названия строк листа сверху вниз. */',
      '  rows: readonly string[];',
      '  /** Нижняя точка, левый и правый край картинки по всем кадрам (пиксели ячейки). */',
      '  feet: number;',
      '  left: number;',
      '  right: number;',
      '}',
      '',
      'export const PET_META: Readonly<Record<string, SheetMeta>> = {']
for k, v in meta.items():
    ts.append("  %s: { cell: %d, cols: %d, rows: %s, feet: %d, left: %d, right: %d }," % (k, v['cell'], v['cols'], json.dumps(v['rows']).replace('"', "'"), v['feet'], v['left'], v['right']))
ts.append('};')
open(os.path.join(ROOT, 'src', 'render', 'petMeta.ts'), 'w').write('\n'.join(ts) + '\n')
print(len(meta), 'sheets')
