import { CRITICAL_THRESHOLD, DAY, MINUTE } from './config';
import { tick } from './simulation';
import type { Pet } from './types';

export type AttentionReason = 'hatch' | 'hungry' | 'dirty' | 'bored' | 'sick' | 'dying';

export interface Attention {
  /** Через сколько миллисекунд от текущего состояния. */
  inMs: number;
  reason: AttentionReason;
}

const STEP_MS = 10 * MINUTE;
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
    p = tick(p, STEP_MS).pet;
    const reason = reasonNow(p, wasEgg);
    if (reason) return { inMs: t, reason };
  }
  return null;
}
