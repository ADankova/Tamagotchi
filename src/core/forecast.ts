import { CRITICAL_THRESHOLD, DAY, MINUTE } from './config';
import { tick } from './simulation';
import type { Pet } from './types';

export type AttentionReason = 'hatch' | 'hungry' | 'dirty' | 'bored' | 'sick' | 'dying';

export interface Attention {
  /** Через сколько миллисекунд от текущего состояния. */
  inMs: number;
  reason: AttentionReason;
}

/** Грубый шаг поиска; найденный интервал уточняется поминутно. */
const STEP_MS = 10 * MINUTE;
const FINE_STEP_MS = MINUTE;
const DEFAULT_HORIZON_MS = 2 * DAY;
/** Здоровье, при котором надо звать игрока, даже если остальное в порядке. */
const DYING_HEALTH = 25;

function reasonNow(p: Pet, wasEgg: boolean): AttentionReason | null {
  if (wasEgg && p.stage !== 'egg') return 'hatch';
  if (p.stage === 'dead' || p.stats.health < DYING_HEALTH) return 'dying';
  if (p.isSick) return 'sick';
  if (p.stats.hunger < CRITICAL_THRESHOLD) return 'hungry';
  if (p.stats.hygiene < CRITICAL_THRESHOLD) return 'dirty';
  if (p.stats.happiness < CRITICAL_THRESHOLD) return 'bored';
  return null;
}

/**
 * Когда питомцу без игрока впервые понадобится забота: прогоняет ту же симуляцию вперёд.
 * По этому прогнозу ставится уведомление, когда игра уходит в фон.
 * null — в пределах горизонта ничего не случится (или питомец уже нуждается в заботе / умер).
 */
export function nextAttention(pet: Pet, horizonMs = DEFAULT_HORIZON_MS): Attention | null {
  if (pet.stage === 'dead' || reasonNow(pet, false)) return null;
  const wasEgg = pet.stage === 'egg';
  let p = pet;
  for (let t = STEP_MS; t <= horizonMs; t += STEP_MS) {
    const before = p;
    p = tick(p, STEP_MS).pet;
    if (!reasonNow(p, wasEgg)) continue;
    // Уточняем момент внутри найденного интервала с точностью до минуты.
    let q = before;
    for (let f = t - STEP_MS + FINE_STEP_MS; f <= t; f += FINE_STEP_MS) {
      q = tick(q, FINE_STEP_MS).pet;
      const reason = reasonNow(q, wasEgg);
      if (reason) return { inMs: f, reason };
    }
    return { inMs: t, reason: reasonNow(p, wasEgg) ?? 'dying' };
  }
  return null;
}
