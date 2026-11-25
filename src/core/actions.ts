import {
  ACTION_COOLDOWN_MS,
  EARLY_WAKE_HAPPINESS_PENALTY,
  FEED_HUNGER,
  FULL_ENERGY,
  HOUR,
  MEDICINE_HEALTH,
  NEEDLESS_MEDICINE_HAPPINESS_PENALTY,
  OVERFEED_HEALTH_PENALTY,
  OVERFEED_THRESHOLD,
  PLAY_ENERGY_COST,
  PLAY_HAPPINESS,
  PLAY_HUNGER_COST,
  SNACK_HAPPINESS,
  SNACK_HUNGER,
  SNACK_LIMIT_PER_HOUR,
  SNACK_OVERLIMIT_HEALTH_PENALTY,
  STAT_MAX,
} from './config';
import { clampStat, clonePet } from './pet';
import type { ActionType, Cooldowns, GameEvent, Pet, StatKey } from './types';

export const ACTIONS: readonly ActionType[] = ['feed', 'snack', 'play', 'sleep', 'clean', 'medicine'];

/** Во сне питомца нельзя кормить, баловать, лечить и играть с ним — только разбудить или прибраться. */
export const SLEEP_BLOCKED: readonly ActionType[] = ['feed', 'snack', 'play', 'medicine'];

export type ActionBlockReason = 'noPet' | 'egg' | 'dead' | 'sleeping' | 'sick' | 'cooldown';

export type ActionResult =
  | { ok: true; pet: Pet; cooldowns: Cooldowns; events: GameEvent[] }
  | { ok: false; reason: ActionBlockReason };

/** Сколько миллисекунд осталось до конца кулдауна (0 — можно). */
export function cooldownLeft(cooldowns: Cooldowns, action: ActionType, now: number): number {
  return Math.max(0, (cooldowns[action] ?? 0) - now);
}

/** Почему действие сейчас недоступно, или null. */
export function blockReason(
  pet: Pet | null,
  action: ActionType,
  cooldowns: Cooldowns,
  now: number,
): ActionBlockReason | null {
  if (!pet) return 'noPet';
  if (pet.stage === 'dead') return 'dead';
  if (pet.stage === 'egg') return 'egg';
  if (pet.isSleeping && SLEEP_BLOCKED.includes(action)) return 'sleeping';
  if (action === 'play' && pet.isSick) return 'sick';
  if (cooldownLeft(cooldowns, action, now) > 0) return 'cooldown';
  return null;
}

/** Выполняет действие игрока. Чистая функция: возвращает новые объекты. */
export function performAction(
  pet: Pet | null,
  action: ActionType,
  cooldowns: Cooldowns,
  now: number,
): ActionResult {
  const reason = blockReason(pet, action, cooldowns, now);
  if (reason || !pet) return { ok: false, reason: reason ?? 'noPet' };

  const p = clonePet(pet);
  const events: GameEvent[] = [];
  const add = (key: StatKey, delta: number) => {
    p.stats[key] = clampStat(p.stats[key] + delta);
  };

  switch (action) {
    case 'feed':
      if (p.stats.hunger >= OVERFEED_THRESHOLD) add('health', -OVERFEED_HEALTH_PENALTY);
      add('hunger', FEED_HUNGER);
      break;

    case 'snack': {
      const recent = p.snackTimes.filter((t) => now - t < HOUR && t <= now);
      if (recent.length >= SNACK_LIMIT_PER_HOUR) add('health', -SNACK_OVERLIMIT_HEALTH_PENALTY);
      add('happiness', SNACK_HAPPINESS);
      add('hunger', SNACK_HUNGER);
      p.snackTimes = [...recent, now];
      break;
    }

    case 'play':
      add('happiness', PLAY_HAPPINESS);
      add('energy', -PLAY_ENERGY_COST);
      add('hunger', -PLAY_HUNGER_COST);
      break;

    case 'sleep':
      if (p.isSleeping) {
        if (p.stats.energy < FULL_ENERGY) add('happiness', -EARLY_WAKE_HAPPINESS_PENALTY);
        p.isSleeping = false;
        events.push({ type: 'wokeUp', auto: false });
      } else {
        p.isSleeping = true;
        events.push({ type: 'fellAsleep', auto: false });
      }
      break;

    case 'clean':
      p.stats.hygiene = STAT_MAX;
      break;

    case 'medicine':
      if (p.isSick) {
        p.isSick = false;
        events.push({ type: 'recovered' });
      } else {
        add('happiness', -NEEDLESS_MEDICINE_HAPPINESS_PENALTY);
      }
      add('health', MEDICINE_HEALTH);
      break;
  }

  return {
    ok: true,
    pet: p,
    cooldowns: { ...cooldowns, [action]: now + ACTION_COOLDOWN_MS[action] },
    events,
  };
}
