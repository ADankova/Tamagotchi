import {
  AUTO_SLEEP_ENERGY,
  CRITICAL_THRESHOLD,
  HAPPY_MOOD_MIN_HAPPINESS,
  HAPPY_MOOD_MIN_OTHER_STATS,
  LIFESPAN_MAX_MS,
  LIFESPAN_MIN_MS,
  NEED_ALERT_THRESHOLD,
  START_STATS,
  STAT_MAX,
  STAT_MIN,
} from './config';
import { nextRandom } from './rng';
import type { Mood, Pet, StatKey } from './types';

export const MAX_NAME_LENGTH = 16;

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
}

export function createPet(name: string, now: number, seed: number): Pet {
  const [r, rngState] = nextRandom(seed);
  return {
    name: normalizeName(name),
    stage: 'egg',
    stats: { ...START_STATS },
    bornAt: now,
    ageMs: 0,
    lifespanMs: LIFESPAN_MIN_MS + r * (LIFESPAN_MAX_MS - LIFESPAN_MIN_MS),
    isSleeping: false,
    isSick: false,
    careScore: STAT_MAX,
    care: { happinessMinutes: 0, minutes: 0, sicknessCount: 0 },
    snackTimes: [],
    rngState,
  };
}

export function clonePet(pet: Pet): Pet {
  return {
    ...pet,
    stats: { ...pet.stats },
    care: { ...pet.care },
    snackTimes: [...pet.snackTimes],
  };
}

export function clampStat(value: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, value));
}

export function isAlive(pet: Pet): boolean {
  return pet.stage !== 'dead';
}

export function getMood(pet: Pet): Mood {
  if (pet.stage === 'dead') return 'dead';
  if (pet.isSleeping) return 'sleeping';
  if (pet.isSick) return 'sick';
  const { hunger, happiness, hygiene, energy } = pet.stats;
  const lowest = Math.min(hunger, happiness, hygiene, energy);
  if (lowest < NEED_ALERT_THRESHOLD) return 'sad';
  if (happiness >= HAPPY_MOOD_MIN_HAPPINESS && lowest >= HAPPY_MOOD_MIN_OTHER_STATS) return 'happy';
  return 'normal';
}

/** Потребности, для которых над питомцем показывается иконка (значение ниже 30). */
export function getNeeds(pet: Pet): StatKey[] {
  if (!isAlive(pet) || pet.stage === 'egg') return [];
  const needs: StatKey[] = [];
  const s = pet.stats;
  if (s.hunger < NEED_ALERT_THRESHOLD) needs.push('hunger');
  if (s.hygiene < NEED_ALERT_THRESHOLD) needs.push('hygiene');
  if (s.happiness < NEED_ALERT_THRESHOLD) needs.push('happiness');
  if (!pet.isSleeping && s.energy < NEED_ALERT_THRESHOLD) needs.push('energy');
  if (pet.isSick || s.health < NEED_ALERT_THRESHOLD) needs.push('health');
  return needs;
}

/** Сколько из «бытовых» показателей ниже критического уровня — каждый отнимает здоровье. */
export function criticalStatCount(pet: Pet): number {
  const s = pet.stats;
  return [s.hunger, s.hygiene, s.happiness].filter((v) => v < CRITICAL_THRESHOLD).length;
}

export function shouldAutoSleep(pet: Pet): boolean {
  return !pet.isSleeping && pet.stats.energy < AUTO_SLEEP_ENERGY;
}
