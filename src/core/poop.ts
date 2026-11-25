import { BABY_POOP_INTERVAL_MS, POOP_INTERVAL_MS, POOP_JITTER_MS } from './config';
import type { LifeStage } from './types';

/** Интервал до следующей какашки: 3 часа (малыш — 2) плюс случайные ±30 минут. roll — число 0..1. */
export function poopInterval(stage: LifeStage, roll: number): number {
  const base = stage === 'baby' || stage === 'egg' ? BABY_POOP_INTERVAL_MS : POOP_INTERVAL_MS;
  return Math.round(base + (roll * 2 - 1) * POOP_JITTER_MS);
}
