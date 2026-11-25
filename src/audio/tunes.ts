import type { ActionType, GameEvent, StatKey } from '../core/types';

// Мелодии и правила «какое событие что звучит» — без Web Audio, чтобы проверять тестами.

/** [частота в Гц (0 — пауза), длительность в мс] */
export type Note = readonly [number, number];

export type SoundName =
  | 'feed'
  | 'snack'
  | 'play'
  | 'sleep'
  | 'wake'
  | 'clean'
  | 'medicine'
  | 'hatch'
  | 'evolve'
  | 'sick'
  | 'alert'
  | 'death'
  | 'blocked'
  | 'toggle';

export const TUNES: Readonly<Record<SoundName, readonly Note[]>> = {
  feed: [[523, 70], [659, 70]],
  snack: [[784, 60], [988, 60], [1175, 80]],
  play: [[659, 60], [784, 60], [659, 60], [880, 90]],
  sleep: [[523, 120], [392, 160]],
  wake: [[392, 90], [523, 120]],
  clean: [[1047, 40], [0, 30], [1319, 40], [0, 30], [1568, 60]],
  medicine: [[440, 80], [554, 80]],
  hatch: [[523, 90], [659, 90], [784, 90], [1047, 180]],
  evolve: [[392, 80], [523, 80], [659, 80], [784, 80], [1047, 200]],
  sick: [[330, 150], [0, 60], [330, 150]],
  alert: [[1319, 70], [0, 50], [1319, 70]],
  death: [[523, 200], [466, 200], [440, 200], [349, 420]],
  blocked: [[196, 90]],
  toggle: [[880, 50]],
};

export function tuneDuration(name: SoundName): number {
  return TUNES[name].reduce((sum, [, ms]) => sum + ms, 0);
}

const ACTION_SOUNDS: Readonly<Record<Exclude<ActionType, 'sleep'>, SoundName>> = {
  feed: 'feed',
  snack: 'snack',
  play: 'play',
  clean: 'clean',
  medicine: 'medicine',
};

/** Звук действия. Для сна зависит от того, уснул питомец или проснулся. */
export function soundForAction(action: ActionType, nowSleeping: boolean): SoundName {
  if (action === 'sleep') return nowSleeping ? 'sleep' : 'wake';
  return ACTION_SOUNDS[action];
}

/** Звук игрового события; у части событий своего звука нет. */
export function soundForEvent(event: GameEvent): SoundName | null {
  switch (event.type) {
    case 'hatched':
      return 'hatch';
    case 'stageChanged':
      return event.stage === 'baby' || event.stage === 'egg' ? null : 'evolve';
    case 'gotSick':
      return 'sick';
    case 'died':
      return 'death';
    default:
      return null;
  }
}

/** Новая потребность (которой не было в прошлый раз) — повод пискнуть. */
export function hasNewNeed(before: readonly StatKey[], after: readonly StatKey[]): boolean {
  return after.some((k) => !before.includes(k));
}
