import { DAY } from '../src/core/config';
import { createPet } from '../src/core/pet';
import type { Pet } from '../src/core/types';
import type { KeyValueStorage } from '../src/storage/save';

export const T0 = Date.UTC(2026, 0, 1);

/** Вылупившийся питомец-ребёнок (2 дня), без случайностей в начальных значениях. */
export function makePet(overrides: Partial<Pet> = {}): Pet {
  const base = createPet('Пушок', T0, 42);
  return {
    ...base,
    stage: 'child',
    ageMs: 2 * DAY,
    lifespanMs: 31 * DAY,
    ...overrides,
    stats: { ...base.stats, ...overrides.stats },
  };
}

export function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

export function fakeClock(start = T0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    set: (ms: number) => {
      now = ms;
    },
  };
}
