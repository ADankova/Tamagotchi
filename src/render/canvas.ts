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
import { SPRITES, type Sprite } from './sprites';

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
    const key = scene ? JSON.stringify(scene) : 'empty';
    if (key === this.lastKey) return;
    this.lastKey = key;

    const { ctx, cell } = this;
    const palette = scene?.dim ? LCD_DIM : LCD;
    const gap = cell >= 4 ? 1 : 0;

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (gap) {
      ctx.fillStyle = palette.ghost;
      for (let y = 0; y < SCREEN_H; y++) {
        for (let x = 0; x < SCREEN_W; x++) ctx.fillRect(x * cell, y * cell, cell - gap, cell - gap);
      }
    }
    for (const item of scene?.items ?? []) {
      drawSprite(ctx, SPRITES[item.sprite], item.x, item.y, cell, gap, palette, item.eyesClosed);
    }
  }
}
