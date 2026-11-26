// Листы анимаций питомцев (art/pets/*.png, собираются scripts/pets-build.py).
// Строки листа: покой, сон, еда, у взрослых ещё болезнь, голод и усталость (9 кадров),
// а также плавные: покой, поимка лакомства, ходьба, еда боком, лёжа, перекат, сон (17 кадров).
import type { Species } from '../core/types';
import { ROW_FRAMES, type AnimRow } from './scene';
import type { BodyStage } from './species';
import { PET_META } from './petMeta';
import cat_adultGood_png from '../../art/pets/cat_adultGood.png';
import blob_adultGood_png from '../../art/pets/blob_adultGood.png';
import dog_adultGood_png from '../../art/pets/dog_adultGood.png';
import cat_baby_png from '../../art/pets/cat_baby.png';
import cat_child_png from '../../art/pets/cat_child.png';
import cat_teen_png from '../../art/pets/cat_teen.png';
import cat_adultNaughty_png from '../../art/pets/cat_adultNaughty.png';
import cat_elder_png from '../../art/pets/cat_elder.png';
import cat_adultNormal_png from '../../art/pets/cat_adultNormal.png';
import blob_baby_png from '../../art/pets/blob_baby.png';
import blob_child_png from '../../art/pets/blob_child.png';
import blob_teen_png from '../../art/pets/blob_teen.png';
import blob_adultNaughty_png from '../../art/pets/blob_adultNaughty.png';
import blob_elder_png from '../../art/pets/blob_elder.png';
import blob_adultNormal_png from '../../art/pets/blob_adultNormal.png';
import dog_baby_png from '../../art/pets/dog_baby.png';
import dog_child_png from '../../art/pets/dog_child.png';
import dog_teen_png from '../../art/pets/dog_teen.png';
import dog_adultNaughty_png from '../../art/pets/dog_adultNaughty.png';
import dog_elder_png from '../../art/pets/dog_elder.png';
import dog_adultNormal_png from '../../art/pets/dog_adultNormal.png';
import props_egg_png from '../../art/pets/props_egg.png';
import butterfly_png from '../../art/pets/butterfly.png';

const SHEET_URLS: Readonly<Record<string, string>> = {
  cat_adultGood: cat_adultGood_png,
  blob_adultGood: blob_adultGood_png,
  dog_adultGood: dog_adultGood_png,
  cat_baby: cat_baby_png,
  cat_child: cat_child_png,
  cat_teen: cat_teen_png,
  cat_adultNaughty: cat_adultNaughty_png,
  cat_elder: cat_elder_png,
  cat_adultNormal: cat_adultNormal_png,
  blob_baby: blob_baby_png,
  blob_child: blob_child_png,
  blob_teen: blob_teen_png,
  blob_adultNaughty: blob_adultNaughty_png,
  blob_elder: blob_elder_png,
  blob_adultNormal: blob_adultNormal_png,
  dog_baby: dog_baby_png,
  dog_child: dog_child_png,
  dog_teen: dog_teen_png,
  dog_adultNaughty: dog_adultNaughty_png,
  dog_elder: dog_elder_png,
  dog_adultNormal: dog_adultNormal_png,
  props_egg: props_egg_png,
  butterfly: butterfly_png,
};

const images = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();
/** Растёт, когда загружается ещё одна картинка: по нему холст понимает, что пора перерисоваться. */
let loaded = 0;

export function petArtVersion(): number {
  return loaded;
}

/** Вызвать, когда картинки догрузились (для превью и воспоминаний). */
export function onPetArtLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function sheet(key: string): HTMLImageElement | null {
  let img = images.get(key);
  if (!img) {
    const url = SHEET_URLS[key];
    if (!url) return null;
    img = new Image();
    img.onload = () => {
      loaded++;
      listeners.forEach((fn) => fn());
    };
    img.src = url;
    images.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Рисует кадр листа так, чтобы центр картинки был в cx, а нижняя точка — в feetY. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  key: string,
  row: number,
  col: number,
  cx: number,
  feetY: number,
  scale: number,
  flip = false,
  anchor?: { feet: number; left: number; right: number },
): void {
  const meta = PET_META[key];
  const img = sheet(key);
  if (!meta || !img) return;
  const { cell } = meta;
  const a = anchor ?? meta;
  const centre = ((a.left + a.right) / 2) * scale;
  const dy = Math.round(feetY - a.feet * scale);
  if (!flip) {
    ctx.drawImage(img, col * cell, row * cell, cell, cell, Math.round(cx - centre), dy, cell * scale, cell * scale);
    return;
  }
  ctx.save();
  ctx.translate(Math.round(cx), 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, col * cell, row * cell, cell, cell, Math.round(-centre), dy, cell * scale, cell * scale);
  ctx.restore();
}

/** Если у стадии нет нужной строки, играется ближайшая из имеющихся. */
const ROW_FALLBACK: Readonly<Record<AnimRow, readonly AnimRow[]>> = {
  idle: [],
  sleep: [],
  eat: [],
  sick: [],
  hungry: [],
  tired: [],
  idle_smooth: ['idle'],
  walk: ['idle_smooth', 'idle'],
  lie_wag: ['idle_smooth', 'idle'],
  roll: ['lie_wag', 'idle_smooth', 'idle'],
  eat_side: ['eat'],
  catch: ['eat'],
  sleep_twitch: ['sleep'],
};

/**
 * Спокойные строки (без движения рта) и грустное лежание. Если у стадии они есть — играются вместо
 * одноимённых прежних; больной, голодный и уставший питомец лежит грустным.
 */
const PREFERRED: Readonly<Partial<Record<AnimRow, readonly string[]>>> = {
  idle_smooth: ['idle_v3', 'idle_calm'],
  walk: ['walk_v3', 'walk_calm'],
  lie_wag: ['lie_v3', 'lie_calm'],
  roll: ['roll_v3'],
  eat_side: ['eat_v3'],
  catch: ['catch_v3'],
  sleep_twitch: ['sleep_v3'],
  sick: ['sad_v3', 'lie_sad'],
  hungry: ['sad_v3', 'lie_sad'],
  tired: ['sad_v3', 'lie_sad'],
};

/** Тело питомца: строка анимации и кадр. Если такой строки у стадии нет — играется ближайшая прежняя. */
export function drawPet(
  ctx: CanvasRenderingContext2D,
  species: Species,
  body: BodyStage,
  anim: AnimRow,
  frame: number,
  cx: number,
  feetY: number,
  scale: number,
  flip = false,
): void {
  const key = `${species}_${body}`;
  const meta = PET_META[key];
  if (!meta) return;
  const preferred = PREFERRED[anim] ?? [];
  let used: string = anim;
  for (const candidate of [...preferred, anim, ...ROW_FALLBACK[anim]]) {
    if (meta.rows.includes(candidate)) {
      used = candidate;
      break;
    }
  }
  const row = Math.max(0, meta.rows.indexOf(used));
  const info = meta.rowInfo?.[used];
  // Прежние строки опираются на общие размеры листа, новые — на свои.
  drawCell(ctx, key, row, frame % (info?.frames ?? ROW_FRAMES[used as AnimRow]), cx, feetY, scale, flip, info);
}

const EGG_FRAMES = 9;

/** Яйцо (кадры покачивания 0–8), треснувшее яйцо (9) и надгробие (10) лежат в одном листе. */
export function drawProp(
  ctx: CanvasRenderingContext2D,
  prop: 'egg' | 'eggCracked' | 'grave',
  frame: number,
  cx: number,
  feetY: number,
  scale: number,
): void {
  const col = prop === 'egg' ? frame % EGG_FRAMES : prop === 'eggCracked' ? 9 : 10;
  drawCell(ctx, 'props_egg', 0, col, cx, feetY, scale);
}

export function drawButterfly(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, scale: number): void {
  const meta = PET_META.butterfly;
  const img = sheet('butterfly');
  if (!meta || !img) return;
  ctx.drawImage(img, (frame % meta.cols) * meta.cell, 0, meta.cell, meta.cell, Math.round(x), Math.round(y), meta.cell * scale, meta.cell * scale);
}

/** Маленький портрет питомца для карточек: первый кадр покоя, 64×64 с прозрачным фоном. */
export function portrait(species: Species, body: BodyStage | 'egg' | 'grave', className: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  canvas.className = className;
  const paint = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    if (body === 'egg' || body === 'grave') drawProp(ctx, body, 0, 32, 60, 1);
    else drawPet(ctx, species, body, 'idle', 0, 32, 60, 1);
  };
  paint();
  const off = onPetArtLoaded(() => {
    paint();
    if (canvas.isConnected === false && loaded > 30) off();
  });
  return canvas;
}
