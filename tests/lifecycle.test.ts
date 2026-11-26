import { describe, expect, it } from 'vitest';
import { DAY, MINUTE } from '../src/core/config';
import { computeCareScore, formForCareScore, stageForAge } from '../src/core/lifecycle';
import { createPet, getMood, getNeeds, normalizeName } from '../src/core/pet';
import { START_STATS } from '../src/core/config';
import { makePet, T0 } from './helpers';

describe('стадии', () => {
  it.each([
    [0, 'egg'],
    [10 * MINUTE - 1, 'egg'],
    [10 * MINUTE, 'baby'],
    [1 * DAY + 10 * MINUTE, 'child'],
    [5 * DAY + 10 * MINUTE - 1, 'child'],
    [5 * DAY + 10 * MINUTE, 'adult'],
    [25 * DAY + 10 * MINUTE - 1, 'adult'],
    [25 * DAY + 10 * MINUTE, 'elder'],
  ] as const)('возраст %d мс → %s', (age, stage) => {
    expect(stageForAge(age)).toBe(stage);
  });
});

describe('качество ухода', () => {
  it('без истории — 100', () => {
    expect(computeCareScore({ happinessMinutes: 0, minutes: 0, sicknessCount: 0 })).toBe(100);
  });

  it('среднее счастье минус 10 за болезнь', () => {
    expect(computeCareScore({ happinessMinutes: 8000, minutes: 100, sicknessCount: 2 })).toBe(60);
    expect(computeCareScore({ happinessMinutes: 500, minutes: 100, sicknessCount: 3 })).toBe(0);
  });

  it('форма взрослого по careScore', () => {
    expect(formForCareScore(85)).toBe('good');
    expect(formForCareScore(70)).toBe('good');
    expect(formForCareScore(55)).toBe('normal');
    expect(formForCareScore(10)).toBe('naughty');
  });
});

describe('питомец', () => {
  it('новый питомец — яйцо со стартовыми значениями и сроком жизни 30 дней и 10 минут', () => {
    const pet = createPet('  Пушок  ', T0, 123);
    expect(pet.name).toBe('Пушок');
    expect(pet.stage).toBe('egg');
    expect(pet.stats).toEqual(START_STATS);
    expect(pet.lifespanMs).toBe(30 * DAY + 10 * MINUTE);
  });

  it('имя обрезается до 16 символов', () => {
    expect(normalizeName('Очень-очень-длинное имя')).toHaveLength(16);
    expect(normalizeName('   ')).toBe('');
  });

  it('настроение и потребности', () => {
    expect(getMood(makePet())).toBe('happy');
    expect(getMood(makePet({ isSleeping: true }))).toBe('sleeping');
    expect(getMood(makePet({ isSick: true }))).toBe('sick');
    const hungry = makePet({ stats: { ...START_STATS, hunger: 10 } });
    expect(getMood(hungry)).toBe('sad');
    expect(getNeeds(hungry)).toEqual(['hunger']);
    expect(getNeeds(createPet('Яйцо', T0, 1))).toEqual([]);
  });
});
