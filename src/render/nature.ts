// Природа в «Диком лесу»: деревья, валуны, руда и трава из PixelLab (art/nature → natureData.ts),
// а также несколько вариантов земли, которые раскладываются по клеткам случайно (но всегда одинаково).
import { NATURE } from './natureData';

const cache = new Map<string, HTMLImageElement>();

function sprite(kind: string, v: number): HTMLImageElement | null {
  const list = NATURE[kind];
  if (!list || typeof Image === 'undefined') return null;
  const n = v % list.length;
  const key = `${kind}${n}`;
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = list[n]!;
    cache.set(key, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/** Число вариантов картинки каждого вида. */
export const natureCount = (kind: string): number => NATURE[kind]?.length ?? 1;

/** Стабильный «случай» для клетки: одна и та же клетка всегда выглядит одинаково. */
export function cellHash(x: number, y: number, salt = 0): number {
  let h = (x * 374_761_393 + y * 668_265_263 + salt * 144_665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Рисует картинку по центру низа (cx, bottom), высотой h (или шириной w); false — картинка ещё не загрузилась. */
export function drawSprite(ctx: CanvasRenderingContext2D, kind: string, v: number, cx: number, bottom: number, size: { w?: number; h?: number }, sway = 0): boolean {
  const img = sprite(kind, v);
  if (!img) return false;
  const k = size.h !== undefined ? size.h / img.naturalHeight : (size.w ?? img.naturalWidth) / img.naturalWidth;
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  const x = cx - w / 2;
  const y = bottom - h;
  if (!sway) {
    ctx.drawImage(img, x, y, w, h);
    return true;
  }
  // Трава качается: чем выше полоска, тем сильнее её сносит.
  const strips = 12;
  const sh = img.naturalHeight / strips;
  for (let i = 0; i < strips; i++) {
    const up = 1 - (i + 0.5) / strips;
    ctx.drawImage(img, 0, i * sh, img.naturalWidth, sh, x + sway * up * up, y + (h / strips) * i, w, h / strips + 0.5);
  }
  return true;
}

/** Иконка предмета: вписывается в квадрат size по центру (cx, cy); false — нет картинки. */
export function drawIcon(ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number, size: number, v = 0): boolean {
  const img = sprite(kind, v);
  if (!img) return false;
  const k = size / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  return true;
}

type Rng = () => number;
const mk = (seed: number): Rng => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const GROUND: Record<'meadow' | 'cave', { base: string; light: string; dark: string; pebble: string; accent: string; kinds: number[] }> = {
  meadow: { base: '#7cc56b', light: '#88cd77', dark: '#6bb15c', pebble: '#b8bcb0', accent: '#f6e27a', kinds: [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 0, 2] },
  cave: { base: '#8a847a', light: '#948e83', dark: '#797369', pebble: '#6b665d', accent: '#7f8c96', kinds: [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 0, 2] },
};

const ground = new Map<string, HTMLCanvasElement | null>();

/** Один из шести вариантов земли (16×16 «пикселей», растягивается без сглаживания). */
export function groundTile(kind: 'meadow' | 'cave', x: number, y: number): HTMLCanvasElement | null {
  const g = GROUND[kind];
  const v = g.kinds[cellHash(x, y) % g.kinds.length]!;
  const key = `${kind}${v}`;
  if (ground.has(key)) return ground.get(key)!;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const cx = c.getContext('2d');
  if (!cx) return null;
  const r = mk(v * 7919 + (kind === 'cave' ? 13 : 1));
  const dot = (col: string, n: number, w = 1, h = 1): void => {
    cx.fillStyle = col;
    for (let i = 0; i < n; i++) cx.fillRect(Math.floor(r() * (16 - w)), Math.floor(r() * (16 - h)), w, h);
  };
  cx.fillStyle = g.base;
  cx.fillRect(0, 0, 16, 16);
  if (v === 0) dot(g.dark, 3);
  else if (v === 1) {
    cx.fillStyle = g.light;
    cx.fillRect(3, 4, 9, 7);
    cx.fillRect(5, 2, 5, 11);
    dot(g.dark, 3);
  } else if (v === 2) dot(g.dark, 9);
  else if (v === 3) {
    dot(g.dark, 3);
    for (let i = 0; i < 2; i++) {
      const px = 2 + Math.floor(r() * 10);
      const py = 2 + Math.floor(r() * 10);
      cx.fillStyle = g.pebble;
      cx.fillRect(px, py, 2, 2);
      cx.fillStyle = g.dark;
      cx.fillRect(px, py + 2, 2, 1);
    }
  } else if (v === 4) {
    dot(g.dark, 4);
    if (kind === 'meadow') {
      cx.fillStyle = g.accent;
      cx.fillRect(10, 5, 1, 1);
      cx.fillStyle = '#ffffff';
      cx.fillRect(4, 11, 1, 1);
    } else {
      cx.fillStyle = g.dark;
      cx.fillRect(4, 6, 6, 1);
      cx.fillRect(9, 7, 3, 1);
      cx.fillRect(11, 8, 1, 3);
    }
  } else {
    if (kind === 'meadow') {
      dot(g.dark, 3);
      for (const [lx, ly] of [[3, 4], [10, 9], [6, 12]] as const) {
        cx.fillStyle = '#5ea34f';
        cx.fillRect(lx, ly, 2, 1);
        cx.fillRect(lx + 1, ly - 1, 1, 1);
      }
    } else {
      cx.fillStyle = '#6f7a86';
      cx.fillRect(3, 5, 8, 5);
      cx.fillRect(5, 4, 4, 7);
      cx.fillStyle = '#7d8995';
      cx.fillRect(5, 6, 4, 2);
      dot(g.dark, 3);
    }
  }
  ground.set(key, c);
  return c;
}

// Картинки создаём заранее: иконки в рюкзаке рисуются один раз и не успели бы загрузиться.
if (typeof Image !== 'undefined') for (const kind of Object.keys(NATURE)) for (let v = 0; v < NATURE[kind]!.length; v++) sprite(kind, v);
