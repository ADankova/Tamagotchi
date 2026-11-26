import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE, SECOND, START_STATS } from '../src/core/config';
import { createPet } from '../src/core/pet';
import { tick } from '../src/core/simulation';
import type { GameEvent, LifeStage, Pet } from '../src/core/types';
import { makePet, T0 } from './helpers';

describe('tick: базовые правила', () => {
  it('не меняет входной объект', () => {
    const pet = makePet();
    const snapshot = structuredClone(pet);
    tick(pet, 3 * HOUR);
    expect(pet).toEqual(snapshot);
  });

  it('при dt <= 0 возвращает питомца без изменений', () => {
    const pet = makePet();
    expect(tick(pet, 0).pet).toBe(pet);
    expect(tick(pet, -5000).pet).toBe(pet);
  });

  it('характеристики падают по таблице 2.1', () => {
    const { pet } = tick(makePet(), HOUR);
    expect(pet.stats.hunger).toBeCloseTo(72);
    expect(pet.stats.happiness).toBeCloseTo(74);
    expect(pet.stats.energy).toBeCloseTo(95);
    expect(pet.stats.health).toBe(100);
  });

  it('малыш теряет сытость в 1,5 раза быстрее', () => {
    const { pet } = tick(makePet({ stage: 'baby', ageMs: HOUR }), HOUR);
    expect(pet.stats.hunger).toBeCloseTo(80 - 12);
  });

  it('в старости энергия падает вдвое быстрее', () => {
    const { pet } = tick(makePet({ stage: 'elder', ageMs: 26 * DAY }), HOUR);
    expect(pet.stats.energy).toBeCloseTo(90);
  });

  it('значения не выходят за 0..100', () => {
    const { pet } = tick(makePet({ stats: { ...START_STATS, hunger: 1 } }), 3 * HOUR);
    expect(pet.stats.hunger).toBe(0);
  });
});

describe('tick: яйцо', () => {
  it('в яйце характеристики не падают', () => {
    const egg = createPet('Пушок', T0, 1);
    const { pet, events } = tick(egg, 4 * MINUTE);
    expect(pet.stage).toBe('egg');
    expect(pet.stats).toEqual(START_STATS);
    expect(events).toEqual([]);
  });

  it('через 10 минут вылупляется малыш', () => {
    const { pet, events } = tick(createPet('Пушок', T0, 1), 10 * MINUTE);
    expect(pet.stage).toBe('baby');
    expect(events).toEqual([{ type: 'hatched' }, { type: 'stageChanged', stage: 'baby' }]);
  });
});

describe('tick: сон', () => {
  it('во сне энергия растёт на 15 в час, а потребности падают вдвое медленнее', () => {
    const { pet } = tick(makePet({ isSleeping: true, stats: { ...START_STATS, energy: 50 } }), HOUR);
    expect(pet.stats.energy).toBeCloseTo(65);
    expect(pet.stats.hunger).toBeCloseTo(76);
    expect(pet.stats.happiness).toBeCloseTo(77);
    expect(pet.isSleeping).toBe(true);
  });

  it('брошенный малыш переживает полдня без ухода', () => {
    const { pet } = tick(makePet({ stage: 'baby', ageMs: HOUR }), 12 * HOUR);
    expect(pet.stage).toBe('baby');
    expect(pet.stats.health).toBeGreaterThan(30);
  });

  it('выспавшись, просыпается сам', () => {
    const start = makePet({ isSleeping: true, stats: { ...START_STATS, energy: 90 } });
    const { pet, events } = tick(start, HOUR);
    expect(pet.isSleeping).toBe(false);
    expect(events).toContainEqual({ type: 'wokeUp', auto: true });
  });

  it('при энергии ниже 10 засыпает сам', () => {
    const { pet, events } = tick(makePet({ stats: { ...START_STATS, energy: 10.01 } }), MINUTE);
    expect(pet.isSleeping).toBe(true);
    expect(events).toContainEqual({ type: 'fellAsleep', auto: true });
  });
});

describe('tick: здоровье, болезнь, смерть', () => {
  it('каждый показатель ниже 20 отнимает 3 здоровья в час', () => {
    const stats = { ...START_STATS, hunger: 5, happiness: 5 };
    const { pet } = tick(makePet({ stats }), HOUR);
    expect(pet.stats.health).toBeCloseTo(94);
  });

  it('при 3+ какашках питомец со временем заболевает, и это детерминировано', () => {
    const dirty = makePet({ poops: 3 });
    const a = tick(dirty, 24 * HOUR);
    const b = tick(dirty, 24 * HOUR);
    expect(a.pet.isSick).toBe(true);
    expect(a.pet.care.sicknessCount).toBe(1);
    expect(a.events).toContainEqual({ type: 'gotSick' });
    expect(b.pet).toEqual(a.pet);
  });

  it('чистый питомец не болеет', () => {
    const { pet } = tick(makePet(), 6 * HOUR);
    expect(pet.isSick).toBe(false);
  });

  it('умирает от голода, когда здоровье падает до 0', () => {
    const stats = { ...START_STATS, hunger: 0, health: 3, happiness: 100 };
    const { pet, events } = tick(makePet({ stats }), 2 * HOUR);
    expect(pet.stage).toBe('dead');
    expect(pet.causeOfDeath).toBe('hunger');
    expect(pet.stageAtDeath).toBe('child');
    expect(events).toContainEqual({ type: 'died', cause: 'hunger' });
  });

  it('мёртвый питомец больше не меняется', () => {
    const dead = tick(makePet({ stats: { ...START_STATS, hunger: 0, health: 1 } }), HOUR).pet;
    expect(tick(dead, DAY).pet).toBe(dead);
  });

  it('умирает от старости по достижении lifespan', () => {
    const old = makePet({ stage: 'elder', ageMs: 30 * DAY - 30 * MINUTE, lifespanMs: 30 * DAY });
    const { pet } = tick(old, HOUR);
    expect(pet.causeOfDeath).toBe('oldAge');
    expect(pet.stageAtDeath).toBe('elder');
    expect(pet.ageMs).toBe(30 * DAY);
  });
});

describe('tick: офлайн-прогресс', () => {
  it('N часов одним вызовом = N часов поминутно', () => {
    const start = makePet();
    const once = tick(start, 6 * HOUR).pet;
    let stepwise = start;
    for (let i = 0; i < 6 * 60; i++) stepwise = tick(stepwise, MINUTE).pet;
    expect(once).toEqual(stepwise);
  });

  it('N часов одним вызовом ≈ N часов посекундно (как при открытой вкладке)', () => {
    const start = makePet();
    const once = tick(start, 6 * HOUR).pet;
    let live = start;
    for (let i = 0; i < 6 * 3600; i++) live = tick(live, SECOND).pet;
    for (const key of Object.keys(once.stats) as Array<keyof Pet['stats']>) {
      expect(live.stats[key]).toBeCloseTo(once.stats[key], 6);
    }
    expect(live.ageMs).toBe(once.ageMs);
  });
});

describe('жизненный цикл целиком', () => {
  it('при хорошем уходе проходит все стадии и умирает от старости', () => {
    let pet = createPet('Пушок', T0, 7);
    const stages: LifeStage[] = [];
    const deaths: GameEvent[] = [];
    for (let h = 0; h < 32 * 24 && pet.stage !== 'dead'; h++) {
      const result = tick(pet, HOUR);
      pet = result.pet;
      for (const e of result.events) {
        if (e.type === 'stageChanged') stages.push(e.stage);
        if (e.type === 'died') deaths.push(e);
      }
      // «Идеальный игрок»: каждый час всё восстанавливает.
      if (pet.stage !== 'dead') pet = { ...pet, stats: { ...START_STATS, happiness: 100 }, poops: 0 };
    }
    expect(stages).toEqual(['baby', 'child', 'adult', 'elder']);
    expect(deaths).toEqual([{ type: 'died', cause: 'oldAge' }]);
    expect(pet.form).toBe('good');
    expect(pet.ageMs).toBeGreaterThanOrEqual(30 * DAY);
    expect(pet.ageMs).toBeLessThanOrEqual(31 * DAY);
  });

  it('при плохом уходе взрослый вырастает «вредным»', () => {
    const neglected = makePet({
      stage: 'child',
      ageMs: 5 * DAY + 10 * MINUTE - MINUTE,
      care: { happinessMinutes: 20 * 1000, minutes: 1000, sicknessCount: 1 },
    });
    const { pet } = tick(neglected, MINUTE);
    expect(pet.stage).toBe('adult');
    expect(pet.form).toBe('naughty');
  });
});

describe('какашки', () => {
  it('у малыша первая появляется через 2 часа ± 30 минут', () => {
    const egg = createPet('Пушок', T0, 3);
    expect(egg.poops).toBe(0);
    expect(egg.poopTimerMs).toBeGreaterThanOrEqual(90 * MINUTE);
    expect(egg.poopTimerMs).toBeLessThanOrEqual(150 * MINUTE);
  });

  it('пока питомец в яйце, какашек нет', () => {
    const { pet } = tick(createPet('Пушок', T0, 3), 4 * MINUTE);
    expect(pet.poops).toBe(0);
  });

  it('ребёнок насорил примерно раз в 3 часа', () => {
    const { pet, events } = tick(makePet({ poopTimerMs: 3 * HOUR }), 12 * HOUR + MINUTE);
    const pooped = events.filter((e) => e.type === 'pooped').length;
    expect(pooped).toBeGreaterThanOrEqual(3);
    expect(pooped).toBeLessThanOrEqual(5);
    expect(pet.poops).toBe(pooped);
    expect(events).toContainEqual({ type: 'pooped', poops: 1 });
  });

  it('во сне — вдвое реже', () => {
    const awake = tick(makePet({ poopTimerMs: HOUR }), HOUR).pet;
    const asleep = tick(makePet({ poopTimerMs: HOUR, isSleeping: true, stats: { ...START_STATS, energy: 20 } }), HOUR).pet;
    expect(awake.poops).toBe(1);
    expect(asleep.poops).toBe(0);
    expect(asleep.poopTimerMs).toBeCloseTo(30 * MINUTE, -2);
  });

  it('больше 5 какашек отнимают 3 здоровья в час, 5 — ещё нет', () => {
    // Оба уже больны (−5/ч), чтобы случайная болезнь не вмешалась в сравнение.
    const five = tick(makePet({ poops: 5, poopTimerMs: 10 * HOUR, isSick: true }), HOUR).pet;
    const six = tick(makePet({ poops: 6, poopTimerMs: 10 * HOUR, isSick: true }), HOUR).pet;
    expect(five.stats.health).toBeCloseTo(95);
    expect(six.stats.health).toBeCloseTo(92);
  });

  it('копится не больше 9', () => {
    const { pet } = tick(makePet({ poops: 9, poopTimerMs: MINUTE }), HOUR);
    expect(pet.poops).toBe(9);
  });
});
