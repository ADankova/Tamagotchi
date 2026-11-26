#!/usr/bin/env python3
"""Вырезает из листов питомцев строки, которые игра не выбирает ни для одной анимации (правила — как в petArt.ts).
Запуск: python3 scripts/pets-prune.py  (меняет art/pets/*.png, art/pets/meta.json и src/render/petMeta.ts)."""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'art', 'pets')
meta = json.load(open(os.path.join(DIR, 'meta.json')))

PREFERRED = {
    'idle_smooth': ['idle_v3', 'idle_calm'], 'walk': ['walk_v3', 'walk_calm'], 'lie_wag': ['lie_v3', 'lie_calm'],
    'roll': ['roll_v3'], 'eat_side': ['eat_v3'], 'catch': ['catch_v3'], 'sleep_twitch': ['sleep_v3'],
    'sick': ['sad_v3', 'lie_sad'], 'hungry': ['sad_v3', 'lie_sad'], 'tired': ['sad_v3', 'lie_sad'],
}
FALLBACK = {
    'idle': [], 'sleep': [], 'eat': [], 'sick': [], 'hungry': [], 'tired': [],
    'idle_smooth': ['idle'], 'walk': ['idle_smooth', 'idle'], 'lie_wag': ['idle_smooth', 'idle'],
    'roll': ['lie_wag', 'idle_smooth', 'idle'], 'eat_side': ['eat'], 'catch': ['eat'], 'sleep_twitch': ['sleep'],
}

for name, m in meta.items():
    if name in ('props_egg', 'butterfly'):
        continue
    rows = m['rows']
    used = {rows[0]}
    for anim in FALLBACK:
        for cand in [*PREFERRED.get(anim, []), anim, *FALLBACK[anim]]:
            if cand in rows:
                used.add(cand)
                break
    keep = [i for i, r in enumerate(rows) if r in used]
    if len(keep) == len(rows):
        continue
    path = os.path.join(DIR, name + '.png')
    im = Image.open(path).convert('RGBA')
    cell = m['cell']
    out = Image.new('RGBA', (im.width, cell * len(keep)), (0, 0, 0, 0))
    for n, i in enumerate(keep):
        out.paste(im.crop((0, i * cell, im.width, (i + 1) * cell)), (0, n * cell))
    out.save(path, optimize=True)
    m['rows'] = [rows[i] for i in keep]
    m['rowInfo'] = {k: v for k, v in m['rowInfo'].items() if k in used}
    print(name, len(rows), '->', len(keep))
json.dump(meta, open(os.path.join(DIR, 'meta.json'), 'w'), ensure_ascii=False, indent=1)

ts = open(os.path.join(ROOT, 'src', 'render', 'petMeta.ts')).read().split('export const PET_META')[0]
ts += 'export const PET_META: Readonly<Record<string, SheetMeta>> = {\n'
for k, v in meta.items():
    info = ''
    if v['rowInfo']:
        info = ', rowInfo: { ' + ', '.join('%s: { feet: %d, left: %d, right: %d, frames: %d }' % (n, i['feet'], i['left'], i['right'], i['frames']) for n, i in v['rowInfo'].items()) + ' }'
    ts += "  %s: { cell: %d, cols: %d, rows: %s, feet: %d, left: %d, right: %d%s },\n" % (k, v['cell'], v['cols'], json.dumps(v['rows']).replace('"', "'"), v['feet'], v['left'], v['right'], info)
ts += '};\n'
open(os.path.join(ROOT, 'src', 'render', 'petMeta.ts'), 'w').write(ts)
