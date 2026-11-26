#!/usr/bin/env python3
"""Делает картинки для «Питомцев-воришек» из спрайтов питомцев: кадр покоя → сетка из кубиков заданных цветов.
Запуск: python3 scripts/mosaic-from-pets.py  (пишет src/core/mosaicPictures.ts)."""
import os, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Буква → цвет кубика (порядок и буквы те же, что MOSAIC_COLORS в src/core/mosaic.ts).
PALETTE = {
    'B': (0x5a, 0xae, 0xf0), 'R': (0xe8, 0x50, 0x5b), 'P': (0xff, 0xa6, 0xc9), 'W': (0xff, 0xf6, 0xe6),
    'O': (0xf5, 0xa3, 0x5c), 'T': (0xa8, 0x72, 0x4a), 'K': (0x4a, 0x3a, 0x33), 'Y': (0xff, 0xd7, 0x5e),
}
MAX_SIDE = 14   # картинка до 14 клеток по большей стороне (было 10 × 9)
MAX_COLORS = 4
# Для питомцев берём тёплые «шерстяные» цвета: розовые щёки и блики дают лишь крапинки.
PET_KEYS = ['W', 'O', 'T', 'K']
SPECIES = ['cat', 'dog', 'blob']
BODIES = [('baby', 'малыш'), ('child', 'ребёнок'), ('teen', 'подросток'), ('adultGood', 'добрый'), ('adultNormal', 'взрослый'), ('adultNaughty', 'шалун'), ('elder', 'старичок')]

def near(rgb, keys):
    return min(keys, key=lambda k: sum((a - b) ** 2 * w for a, b, w in zip(rgb, PALETTE[k], (2, 4, 3))))

def picture(path):
    sheet = Image.open(path).convert('RGBA')
    frame = sheet.crop((0, 0, 64, 64))
    box = frame.getbbox()
    frame = frame.crop(box)
    w, h = frame.size
    k = MAX_SIDE / max(w, h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    small = frame.resize((nw, nh), Image.BOX)
    px = small.load()
    cells = [[None] * nw for _ in range(nh)]
    for y in range(nh):
        for x in range(nw):
            r, g, b, a = px[x, y]
            if a >= 110:
                cells[y][x] = near((r, g, b), PET_KEYS)
    # Убираем одиночные крапинки: клетка, у которой нет ни одного соседа её цвета, берёт цвет большинства соседей.
    for _ in range(2):
        nxt = [row[:] for row in cells]
        for y in range(nh):
            for x in range(nw):
                c = cells[y][x]
                if not c: continue
                ns = [cells[y + dy][x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < nh and 0 <= x + dx < nw and cells[y + dy][x + dx]]
                if ns and c not in ns:
                    nxt[y][x] = max(set(ns), key=ns.count)
        cells = nxt
    used = {}
    for row in cells:
        for c in row:
            if c: used[c] = used.get(c, 0) + 1
    keep = sorted(used, key=lambda c: -used[c])[:MAX_COLORS]
    for y in range(nh):
        for x in range(nw):
            c = cells[y][x]
            if c and c not in keep:
                cells[y][x] = near(PALETTE[c], keep)
    return [''.join(c or '.' for c in row) for row in cells]

pics = {}
names = {}
for sp, sp_ru, sp_en in [('cat', 'Кот', 'Cat'), ('dog', 'Пёс', 'Dog'), ('blob', 'Блоб', 'Blob')]:
    for body, ru in BODIES:
        key = f'{sp}_{body}'
        pics[key] = picture(os.path.join(ROOT, 'art', 'pets', f'{key}.png'))
        names[key] = (f'{sp_ru}: {ru}', f'{sp_en}: {body}')

out = ['// Создано scripts/mosaic-from-pets.py из спрайтов питомцев — вручную не править.', '', 'export const PET_PICTURES = {']
for k, rows in pics.items():
    out.append(f'  {k}: [')
    out += [f"    '{r}'," for r in rows]
    out.append('  ],')
out.append('} as const;')
out.append('')
out.append('export const PET_PICTURE_NAMES: Record<string, { ru: string; en: string }> = {')
for k, (ru, en) in names.items():
    out.append(f"  {k}: {{ ru: '{ru}', en: '{en}' }},")
out.append('};')
open(os.path.join(ROOT, 'src', 'core', 'mosaicPictures.ts'), 'w').write('\n'.join(out) + '\n')
for k, rows in list(pics.items())[:3] + list(pics.items())[10:11]:
    print(k); print('\n'.join(rows))
print({k: (len(r[0]), len(r), sum(c != '.' for row in r for c in row), len({c for row in r for c in row if c != '.'})) for k, r in pics.items()})
