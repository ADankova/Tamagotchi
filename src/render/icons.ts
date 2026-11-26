import type { ActionType, Need, StatKey } from '../core/types';
import { ART, type ArtIcon } from './artData';

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
