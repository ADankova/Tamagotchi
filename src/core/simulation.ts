import {
  CRITICAL_THRESHOLD,
  DECAY_PER_HOUR,
  ELDER_ENERGY_MULTIPLIER,
  FULL_ENERGY,
  HEALTH_LOSS_PER_CRITICAL_PER_HOUR,
  HOUR,
  MINUTE,
  SICK_CHANCE_PER_HOUR,
  SICK_HEALTH_LOSS_PER_HOUR,
  MAX_POOPS,
  POOP_HEALTH_LOSS_PER_HOUR,
  POOP_HEALTH_THRESHOLD,
  POOP_SICK_THRESHOLD,
  SLEEP_POOP_MULTIPLIER,
  SIM_STEP_MS,
  SLEEP_ENERGY_GAIN_PER_HOUR,
  SLEEP_NEEDS_DECAY_MULTIPLIER,
  STAGE_DECAY_MULTIPLIER,
} from './config';
import { computeCareScore, formForCareScore, stageForAge } from './lifecycle';
import { clampStat, clonePet, criticalStatCount, shouldAutoSleep } from './pet';
import { poopInterval } from './poop';
import { nextRandom } from './rng';
import type { CauseOfDeath, GameEvent, Pet } from './types';

export interface TickResult {
  pet: Pet;
  events: GameEvent[];
}

/**
 * Продвигает питомца на dtMs симуляционного времени.
 * Чистая функция: не читает часы, не трогает DOM, не меняет входной объект.
 * Длинные промежутки режутся на шаги по SIM_STEP_MS, чтобы болезнь, автосон и смерть
 * срабатывали так же, как при открытой вкладке.
 */
export function tick(pet: Pet, dtMs: number): TickResult {
  const events: GameEvent[] = [];
  if (!(dtMs > 0) || pet.stage === 'dead') return { pet, events };

  const next = clonePet(pet);
  let remaining = dtMs;
  while (remaining > 0 && next.stage !== 'dead') {
    const step = Math.min(SIM_STEP_MS, remaining);
    advance(next, step, events);
    remaining -= step;
  }
  return { pet: next, events };
}

/** Один шаг симуляции. Мутирует переданную копию. */
function advance(p: Pet, dt: number, events: GameEvent[]): void {
  const hours = dt / HOUR;

  if (p.stage === 'egg') {
    p.ageMs += dt;
    updateStage(p, events);
    return;
  }

  const s = p.stats;
  const mult =
    (STAGE_DECAY_MULTIPLIER[p.stage] ?? 1) * (p.isSleeping ? SLEEP_NEEDS_DECAY_MULTIPLIER : 1);
  s.hunger = clampStat(s.hunger - DECAY_PER_HOUR.hunger * mult * hours);
  s.happiness = clampStat(s.happiness - DECAY_PER_HOUR.happiness * mult * hours);

  if (p.isSleeping) {
    s.energy = clampStat(s.energy + SLEEP_ENERGY_GAIN_PER_HOUR * hours);
  } else {
    const energyMult = (STAGE_DECAY_MULTIPLIER[p.stage] ?? 1) * (p.stage === 'elder' ? ELDER_ENERGY_MULTIPLIER : 1);
    s.energy = clampStat(s.energy - DECAY_PER_HOUR.energy * energyMult * hours);
  }

  // Какашки: таймер идёт вдвое медленнее во сне.
  p.poopTimerMs -= dt * (p.isSleeping ? SLEEP_POOP_MULTIPLIER : 1);
  if (p.poopTimerMs <= 0) {
    const [roll, rngState] = nextRandom(p.rngState);
    p.rngState = rngState;
    p.poopTimerMs += poopInterval(p.stage, roll);
    if (p.poops < MAX_POOPS) {
      p.poops += 1;
      events.push({ type: 'pooped', poops: p.poops });
    }
  }

  const healthLoss =
    criticalStatCount(p) * HEALTH_LOSS_PER_CRITICAL_PER_HOUR * hours +
    (p.isSick ? SICK_HEALTH_LOSS_PER_HOUR * hours : 0) +
    (p.poops > POOP_HEALTH_THRESHOLD ? POOP_HEALTH_LOSS_PER_HOUR * hours : 0);
  s.health = clampStat(s.health - healthLoss);

  if (!p.isSick && p.poops >= POOP_SICK_THRESHOLD) {
    const [roll, rngState] = nextRandom(p.rngState);
    p.rngState = rngState;
    if (roll < SICK_CHANCE_PER_HOUR * hours) {
      p.isSick = true;
      p.care.sicknessCount += 1;
      events.push({ type: 'gotSick' });
    }
  }

  if (shouldAutoSleep(p)) {
    p.isSleeping = true;
    events.push({ type: 'fellAsleep', auto: true });
  } else if (p.isSleeping && s.energy >= FULL_ENERGY) {
    p.isSleeping = false;
    events.push({ type: 'wokeUp', auto: true });
  }

  const minutes = dt / MINUTE;
  p.care.minutes += minutes;
  p.care.happinessMinutes += s.happiness * minutes;
  p.careScore = computeCareScore(p.care);

  p.ageMs += dt;
  updateStage(p, events);

  if (s.health <= 0) {
    die(p, deathCause(p), events);
  } else if (p.ageMs >= p.lifespanMs) {
    die(p, 'oldAge', events);
  }
}

function updateStage(p: Pet, events: GameEvent[]): void {
  const stage = stageForAge(p.ageMs);
  if (stage === p.stage) return;
  if (p.stage === 'egg') events.push({ type: 'hatched' });
  p.stage = stage;
  if (stage === 'adult') p.form = formForCareScore(p.careScore);
  events.push({ type: 'stageChanged', stage });
}

function deathCause(p: Pet): CauseOfDeath {
  if (p.stats.hunger < CRITICAL_THRESHOLD) return 'hunger';
  if (p.isSick) return 'sickness';
  return 'neglect';
}

function die(p: Pet, cause: CauseOfDeath, events: GameEvent[]): void {
  p.stageAtDeath = p.stage;
  p.stage = 'dead';
  p.causeOfDeath = cause;
  p.isSleeping = false;
  events.push({ type: 'died', cause });
}
