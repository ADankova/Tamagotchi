import type { ActionType, Need, StatKey } from '../core/types';
import { drawSprite, LCD, type Palette } from './canvas';
import { ART, type ArtIcon } from './artData';
import { SPRITES, type SpriteName } from './sprites';

// Цветные иконки интерфейса нарисованы в PixelLab (art/ui/*.png → artData.ts).
export const STAT_ICONS: Readonly<Record<StatKey, ArtIcon>> = {
  hunger: 'hunger',
  happiness: 'happiness',
  energy: 'energy',
  health: 'health',
};

/** Иконки потребностей над экраном питомца. */
export const NEED_ICONS: Readonly<Record<Need, ArtIcon>> = {
  hunger: 'hunger',
  happiness: 'happiness',
  energy: 'energy',
  health: 'health',
  poop: 'poop',
};

export const ACTION_ICONS: Readonly<Record<ActionType, ArtIcon>> = {
  feed: 'feed',
  snack: 'snack',
  play: 'play',
  sleep: 'sleep',
  clean: 'clean',
  medicine: 'medicine',
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

/** Цветная иконка интерфейса (32×32, размер на экране задаёт CSS). */
export function iconImg(name: ArtIcon, className = 'icon'): HTMLImageElement {
  const img = document.createElement('img');
  img.src = ART[name];
  img.alt = '';
  img.className = className;
  img.width = 32;
  img.height = 32;
  img.draggable = false;
  return img;
}
