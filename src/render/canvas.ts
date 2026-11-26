import type { ActionType, Pet } from '../core/types';
import {
  composeScene,
  cutsceneFor,
  isCutscenePlaying,
  SCREEN_H,
  SCREEN_W,
  type ActiveAction,
  type Cutscene,
  type CutsceneKind,
  type Scene,
} from './scene';
import { backdropAt, drawBackdrop, hourOf } from './backdrop';
import { ART } from './artData';
import { drawButterfly, drawPet, drawProp, petArtVersion } from './petArt';
import { SPECIES_LOOKS, type BodyStage } from './species';
import { SPRITES, type Sprite, type SpriteName } from './sprites';
import type { Species } from '../core/types';

export interface Palette {
  bg: string;
  ghost: string;
  ink: string;
  shade: string;
  light: string;
}

/** Цвета «жидкокристаллического» экрана. */
export const LCD: Palette = {
  bg: '#c9d4b2',
  ghost: '#bfcaa8',
  ink: '#28321f',
  shade: '#6f7d5c',
  light: '#e8eed9',
};

/** Притушенный экран во время сна. */
export const LCD_DIM: Palette = {
  bg: '#8f9a7e',
  ghost: '#879277',
  ink: '#1f271a',
  shade: '#55614a',
  light: '#a9b496',
};

/** Цвета мелких предметов (миска, мяч, сердечки…) на цветном экране. */
const PROP_PALETTE: Palette = {
  bg: 'transparent',
  ghost: 'transparent',
  ink: '#5a3b36',
  shade: '#b98f7e',
  light: '#fffaf0',
};

const tint = (ink: string, shade: string, light = '#fffaf0'): Palette => ({ bg: 'transparent', ghost: 'transparent', ink, shade, light });

/** Свои цвета у предметов, чтобы они не выглядели тёмными пятнами на светлом фоне. */
const PROP_TINTS: Partial<Record<SpriteName, Palette>> = {
  heart: tint('#e64f7a', '#ff9fb9'),
  sparkle: tint('#f0a60e', '#ffd86b'),
  zed: tint('#8e7cd6', '#c4b8f2'),
  skull: tint('#6f9f82', '#a9d4b8', '#f1fff4'),
  tear: tint('#4c9be0', '#9fd0f5', '#eaf6ff'),
  bubble: tint('#5aaee6', '#a8dbf5', '#eafaff'),
  poopSmall: tint('#6b4328', '#a8743f', '#d2a06a'),
  bowl: tint('#c0663a', '#f4a96a', '#fff0d6'),
  ball: tint('#e45c5c', '#5aaee6', '#ffffff'),
  candy: tint('#d94f8c', '#ffa3c7', '#fff0f6'),
  pill: tint('#d94f4f', '#f3bcbc', '#ffffff'),
};

/** Какое тело какому спрайту соответствует: по имени спрайта находим вид и стадию. */
const BODY_OF = new Map<SpriteName, { species: Species; stage: BodyStage }>();
const TAIL_NAMES = new Set<SpriteName>();
for (const [species, look] of Object.entries(SPECIES_LOOKS) as [Species, (typeof SPECIES_LOOKS)[Species]][]) {
  for (const [stage, name] of Object.entries(look.bodies) as [BodyStage, SpriteName][]) {
    BODY_OF.set(name, { species, stage });
  }
  look.tail?.forEach((n) => TAIL_NAMES.add(n));
}

/** Предметы, которые нарисованы цветными картинками: ключ в ART и размер в клетках экрана. */
const PROP_ART: Partial<Record<SpriteName, { art: keyof typeof ART; size: number }>> = {
  poopSmall: { art: 'poop', size: 6 },
  bowl: { art: 'feed', size: 11 },
  candy: { art: 'snack', size: 7 },
  pill: { art: 'medicine', size: 7 },
};

const artImages = new Map<string, HTMLImageElement>();
let artLoaded = 0;

function artImage(key: keyof typeof ART): HTMLImageElement | null {
  let img = artImages.get(key);
  if (!img) {
    img = new Image();
    img.onload = () => artLoaded++;
    img.src = ART[key];
    artImages.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const propCache = new Map<SpriteName, HTMLCanvasElement>();

/** Предмет, нарисованный один раз крупными пикселями; на экран выводится со сглаживанием. */
function propImage(name: SpriteName): HTMLCanvasElement {
  let c = propCache.get(name);
  if (!c) {
    const sprite = SPRITES[name];
    const px = 4;
    c = document.createElement('canvas');
    c.width = sprite.w * px;
    c.height = sprite.h * px;
    const ctx = c.getContext('2d');
    if (ctx) drawSprite(ctx, sprite, 0, 0, px, 0, PROP_TINTS[name] ?? PROP_PALETTE);
    propCache.set(name, c);
  }
  return c;
}

export function colorFor(ch: string, palette: Palette, eyesClosed: boolean): string | null {
  switch (ch) {
    case '#':
      return palette.ink;
    case '+':
      return palette.shade;
    case 'o':
      return palette.light;
    case 'e':
      return eyesClosed ? palette.shade : palette.ink;
    default:
      return null;
  }
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  cell: number,
  gap: number,
  palette: Palette,
  eyesClosed = false,
): void {
  sprite.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = colorFor(row[dx] ?? '.', palette, eyesClosed);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((x + dx) * cell, (y + dy) * cell, cell - gap, cell - gap);
    }
  });
}

/**
 * Экран питомца. Анимация идёт через requestAnimationFrame независимо от игровой логики;
 * кадр перерисовывается, только когда сцена действительно изменилась.
 */
export class PetCanvas {
  private pet: Pet | null = null;
  private active: ActiveAction | null = null;
  private cutscene: Cutscene | null = null;
  private raf = 0;
  private lastKey = '';
  private cell = 1;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly motionQuery: MediaQueryList | null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.motionQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    this.resize();
  }

  /** Замечает смену стадии сам и запускает сценку: вылупление, взросление или смерть. */
  setPet(pet: Pet | null): void {
    if (this.pet && pet) {
      const cutscene = cutsceneFor(this.pet, pet, performance.now());
      if (cutscene) {
        this.cutscene = cutscene;
        this.active = null;
      }
    }
    this.pet = pet;
  }

  isPlaying(kind: CutsceneKind, t = performance.now()): boolean {
    return this.cutscene?.kind === kind && isCutscenePlaying(this.cutscene, t);
  }

  play(action: ActionType): void {
    this.active = { action, startedAt: performance.now() };
  }

  start(): void {
    if (this.raf) return;
    const loop = (t: number) => {
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
  }

  /** Текущая сцена — для подписи экрана и тестов в браузере. */
  scene(t = performance.now()): Scene | null {
    return this.pet
      ? composeScene(this.pet, this.active, t, this.motionQuery?.matches ?? false, this.cutscene)
      : null;
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = this.canvas.clientWidth || SCREEN_W * 4;
    // Целый размер «пикселя», чтобы картинка оставалась чёткой.
    this.cell = Math.max(1, Math.floor((cssWidth * dpr) / SCREEN_W));
    this.canvas.width = SCREEN_W * this.cell;
    this.canvas.height = SCREEN_H * this.cell;
    this.lastKey = '';
  }

  private draw(t: number): void {
    const scene = this.scene(t);
    const now = new Date();
    const key = `${scene ? JSON.stringify(scene) : 'empty'}|${Math.floor(now.getTime() / 60000)}|${petArtVersion()}|${artLoaded}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const { ctx, cell } = this;
    const { width, height } = this.canvas;
    const reduced = this.motionQuery?.matches ?? false;
    // Один пиксель рисунка питомца (64×64) занимает целое число пикселей экрана; взрослый занимает около трети ширины.
    const scale = Math.max(1, Math.floor(cell / 4.5));

    ctx.imageSmoothingEnabled = false;
    drawBackdrop(ctx, width, height, backdropAt(hourOf(now)));

    for (const item of scene?.items ?? []) {
      const sprite = SPRITES[item.sprite];
      const cx = (item.x + sprite.w / 2) * cell;
      const feet = (item.y + sprite.h) * cell;
      const body = BODY_OF.get(item.sprite);
      if (body) {
        drawPet(ctx, body.species, body.stage, item.anim ?? 'idle', item.frame ?? 0, cx, feet, scale, item.flip ?? false);
      } else if (TAIL_NAMES.has(item.sprite)) {
        continue; // хвост нарисован вместе с телом
      } else if (item.sprite === 'egg' || item.sprite === 'eggCracked') {
        const frame = reduced ? 0 : Math.floor(t / 150);
        drawProp(ctx, item.sprite, frame, cx, feet, scale);
      } else if (item.sprite === 'grave') {
        drawProp(ctx, 'grave', 0, cx, feet, scale);
      } else if (PROP_ART[item.sprite]) {
        const spec = PROP_ART[item.sprite]!;
        const img = artImage(spec.art);
        if (img) {
          // Цветная картинка стоит на том же месте, что и старый спрайт: по центру и на той же нижней линии.
          const size = spec.size * cell;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, Math.round(cx - size / 2), Math.round(feet - size), size, size);
          ctx.imageSmoothingEnabled = false;
        }
      } else {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(propImage(item.sprite), item.x * cell, item.y * cell, sprite.w * cell, sprite.h * cell);
        ctx.imageSmoothingEnabled = false;
      }
    }

    // Дымок над какашками: мягкие зеленоватые облачка.
    for (const puff of scene?.puffs ?? []) {
      ctx.fillStyle = `rgba(132, 204, 92, ${puff.a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(puff.x * cell, puff.y * cell, puff.r * cell, 0, Math.PI * 2);
      ctx.fill();
    }

    if (scene?.butterfly) {
      const b = scene.butterfly;
      drawButterfly(ctx, b.frame, b.x * cell, b.y * cell, scale);
    }

    // Ночью во сне экран притемняется.
    if (scene?.dim) {
      ctx.fillStyle = 'rgba(24, 28, 70, 0.4)';
      ctx.fillRect(0, 0, width, height);
    }
  }
}
