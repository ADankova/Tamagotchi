import type { ActionType, StatKey } from '../core/types';
import { drawSprite, LCD, type Palette } from './canvas';
import { SPRITES, type SpriteName } from './sprites';

export const STAT_ICONS: Readonly<Record<StatKey, SpriteName>> = {
  hunger: 'iconHunger',
  happiness: 'heart',
  energy: 'iconBolt',
  hygiene: 'iconDrop',
  health: 'iconCross',
};

export const ACTION_ICONS: Readonly<Record<ActionType, SpriteName>> = {
  feed: 'bowl',
  snack: 'candy',
  play: 'ball',
  sleep: 'iconMoon',
  clean: 'sparkle',
  medicine: 'pill',
};

/** Иконки рисуются тёмным по прозрачному, без сетки пикселей. */
const ICON_PALETTE: Palette = { ...LCD, bg: 'transparent', ghost: 'transparent', light: '#ffffff' };

const cache = new Map<string, string>();

/** Картинка спрайта для <img>: рисуется один раз и кешируется. */
export function spriteDataUrl(name: SpriteName, scale = 4, palette: Palette = ICON_PALETTE): string {
  const key = `${name}:${scale}:${palette.ink}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const sprite = SPRITES[name];
  const canvas = document.createElement('canvas');
  canvas.width = sprite.w * scale;
  canvas.height = sprite.h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawSprite(ctx, sprite, 0, 0, scale, 0, palette);
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function iconImg(name: SpriteName, className = 'icon'): HTMLImageElement {
  const img = document.createElement('img');
  img.src = spriteDataUrl(name);
  img.alt = '';
  img.className = className;
  img.width = SPRITES[name].w * 2;
  img.height = SPRITES[name].h * 2;
  return img;
}
