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

def despeckle(frame, limit=14):
    """Убирает мелкие отдельные пятнышки (искры, дымок) вокруг тела: связные куски не больше limit пикселей."""
    px = frame.load()
    w, h = frame.size
    seen = set()
    for y0 in range(h):
        for x0 in range(w):
            if (x0, y0) in seen or px[x0, y0][3] == 0:
                continue
            comp, stack = [], [(x0, y0)]
            seen.add((x0, y0))
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3] > 0:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            if len(comp) <= limit:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
    return frame

meta = {}
EXTRA_COLS = 17
for name, spec in MAP.items():
    cell = spec.get('cell', 64)
    rows, cols = spec['rows'], spec['cols']
    im = clean(Image.open(os.path.join(SRC, spec['file'])), cell, rows, cols)
    # Баланс: у блоба-малыша сон «рассыпался» — берём вместо него кадры покоя.
    if spec.get('copyRow'):
        dst, srcrow = spec['copyRow']
        im.paste(im.crop((0, srcrow * cell, cols * cell, (srcrow + 1) * cell)), (0, dst * cell))
    # Нижняя точка и центр по всем прежним кадрам: по ним питомец ставится на пол.
    bottom, left, right = 0, im.width, 0
    for r in range(rows):
        for c in range(cols):
            b = im.crop((c * cell, r * cell, (c + 1) * cell, (r + 1) * cell)).getbbox()
            if b:
                bottom = max(bottom, b[3]); left = min(left, b[0]); right = max(right, b[2])
    names = list(spec['names'])
    row_info = {}
    extras = list(spec.get('extras') or [])
    if spec.get('extra'):
        extras.insert(0, spec['extra'])
    for extra in extras:
        # Плавные анимации приходят подряд по 9 в строке (по 17 кадров на анимацию);
        # раскладываем их в лист: одна анимация — одна строка из 17 кадров.
        n = len(extra['names'])
        total = n * EXTRA_COLS
        ex_cols = 9
        ex = clean(Image.open(os.path.join(SRC, extra['file'])), cell, -(-total // ex_cols), ex_cols)
        base_rows = len(names)
        full = Image.new('RGBA', (EXTRA_COLS * cell, (base_rows + n) * cell), (0, 0, 0, 0))
        full.paste(im, (0, 0))
        for i, nm in enumerate(extra['names']):
            rb, rl, rr, cnt = 0, EXTRA_COLS * cell, 0, 0
            for c in range(EXTRA_COLS):
                k = i * EXTRA_COLS + c
                frame = ex.crop(((k % ex_cols) * cell, (k // ex_cols) * cell, (k % ex_cols + 1) * cell, (k // ex_cols + 1) * cell))
                if nm in (extra.get('despeckle') or []):
                    frame = despeckle(frame.copy())
                full.paste(frame, (c * cell, (base_rows + i) * cell))
                bb = frame.getbbox()
                if bb:
                    cnt += 1
                    rb = max(rb, bb[3]); rl = min(rl, bb[0]); rr = max(rr, bb[2])
            row_info[nm] = {'feet': rb, 'left': rl, 'right': rr, 'frames': cnt}
            names.append(nm)
        im, cols = full, EXTRA_COLS
    meta[name] = {'cell': cell, 'cols': cols, 'rows': names, 'feet': bottom, 'left': left, 'right': right, 'rowInfo': row_info}
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
ts = ['// Сгенерировано scripts/pets-build.py — не править руками.',
      'export interface RowInfo {',
      '  feet: number;',
      '  left: number;',
      '  right: number;',
      '  frames: number;',
      '}',
      '',
      'export interface SheetMeta {',
      '  cell: number;',
      '  cols: number;',
      '  /** Названия строк листа сверху вниз. */',
      '  rows: readonly string[];',
      '  /** Нижняя точка, левый и правый край картинки по всем прежним кадрам (пиксели ячейки). */',
      '  feet: number;',
      '  left: number;',
      '  right: number;',
      '  /** Свои размеры у плавных строк (прежние используют общие). */',
      '  rowInfo?: Readonly<Record<string, RowInfo>>;',
      '}',
      '',
      'export const PET_META: Readonly<Record<string, SheetMeta>> = {']
for k, v in meta.items():
    info = ''
    if v['rowInfo']:
        info = ', rowInfo: { ' + ', '.join("%s: { feet: %d, left: %d, right: %d, frames: %d }" % (n, i['feet'], i['left'], i['right'], i['frames']) for n, i in v['rowInfo'].items()) + ' }'
    ts.append("  %s: { cell: %d, cols: %d, rows: %s, feet: %d, left: %d, right: %d%s }," % (k, v['cell'], v['cols'], json.dumps(v['rows']).replace('"', "'"), v['feet'], v['left'], v['right'], info))
ts.append('};')
open(os.path.join(ROOT, 'src', 'render', 'petMeta.ts'), 'w').write('\n'.join(ts) + '\n')
print(len(meta), 'sheets')
