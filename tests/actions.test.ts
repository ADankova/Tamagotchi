import { describe, expect, it } from 'vitest';
import { blockReason, cooldownLeft, finishPlay, performAction } from '../src/core/actions';
import { HOUR, MINUTE, SECOND, START_STATS } from '../src/core/config';
import { createPet } from '../src/core/pet';
import type { ActionType, Pet } from '../src/core/types';
import { makePet, T0 } from './helpers';

function act(pet: Pet, action: ActionType, now = T0): Pet {
  const result = performAction(pet, action, {}, now);
  if (!result.ok) throw new Error(`blocked: ${result.reason}`);
  return result.pet;
}

describe('доступность действий', () => {
  it('без питомца, в яйце и после смерти действия недоступны', () => {
    expect(blockReason(null, 'feed', {}, T0)).toBe('noPet');
    expect(blockReason(createPet('Яйцо', T0, 1), 'feed', {}, T0)).toBe('egg');
    expect(blockReason(makePet({ stage: 'dead' }), 'feed', {}, T0)).toBe('dead');
  });

  it('во сне нельзя кормить, давать лакомство, лечить и играть; можно разбудить и убрать', () => {
    const sleeping = makePet({ isSleeping: true, isSick: true, poops: 2 });
    for (const action of ['feed', 'snack', 'play', 'medicine'] as const) {
      expect(blockReason(sleeping, action, {}, T0)).toBe('sleeping');
    }
    expect(blockReason(sleeping, 'sleep', {}, T0)).toBeNull();
    expect(blockReason(sleeping, 'clean', {}, T0)).toBeNull();
  });

  it('играть нельзя во сне и при болезни', () => {
    expect(blockReason(makePet({ isSleeping: true }), 'play', {}, T0)).toBe('sleeping');
    expect(blockReason(makePet({ isSick: true }), 'play', {}, T0)).toBe('sick');
    expect(blockReason(makePet({ isSick: true }), 'feed', {}, T0)).toBeNull();
  });

  it('после действия включается кулдаун, потом снимается', () => {
    const result = performAction(makePet(), 'play', {}, T0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(cooldownLeft(result.cooldowns, 'play', T0)).toBe(5 * SECOND);
    expect(performAction(result.pet, 'play', result.cooldowns, T0 + SECOND)).toEqual({
      ok: false,
      reason: 'cooldown',
    });
    expect(performAction(result.pet, 'play', result.cooldowns, T0 + 5 * SECOND).ok).toBe(true);
    expect(blockReason(result.pet, 'feed', result.cooldowns, T0)).toBeNull();
  });

  it('не меняет входные объекты', () => {
    const pet = makePet();
    const cooldowns = {};
    const snapshot = structuredClone(pet);
    performAction(pet, 'feed', cooldowns, T0);
    expect(pet).toEqual(snapshot);
    expect(cooldowns).toEqual({});
  });
});

describe('эффекты действий (таблица 2.2)', () => {
  it('кормление: сытость +25, не выше 100', () => {
    expect(act(makePet({ stats: { ...START_STATS, hunger: 40 } }), 'feed').stats.hunger).toBe(65);
    expect(act(makePet({ stats: { ...START_STATS, hunger: 90 } }), 'feed').stats.hunger).toBe(100);
  });

  it('кормление сытого — переедание, здоровье −10', () => {
    const pet = act(makePet({ stats: { ...START_STATS, hunger: 100 } }), 'feed');
    expect(pet.stats.health).toBe(90);
  });

  it('лакомство: счастье +15, сытость +5', () => {
    const pet = act(makePet({ treats: 2, stats: { ...START_STATS, happiness: 50, hunger: 50 } }), 'snack');
    expect(pet.treats).toBe(1);
    expect(pet.stats.happiness).toBe(65);
    expect(pet.stats.hunger).toBe(55);
    expect(pet.stats.health).toBe(100);
  });

  it('четвёртое лакомство за час отнимает 5 здоровья, через час лимит сбрасывается', () => {
    let pet = makePet({ treats: 10 });
    for (let i = 0; i < 3; i++) pet = act(pet, 'snack', T0 + i * MINUTE);
    expect(pet.stats.health).toBe(100);
    pet = act(pet, 'snack', T0 + 3 * MINUTE);
    expect(pet.stats.health).toBe(95);
    pet = act(pet, 'snack', T0 + 3 * MINUTE + 2 * HOUR);
    expect(pet.stats.health).toBe(95);
    expect(pet.snackTimes).toHaveLength(1);
  });

  it('игра: счастье +20, энергия −10, сытость −5', () => {
    const pet = act(makePet({ stats: { ...START_STATS, happiness: 50 } }), 'play');
    expect(pet.stats.happiness).toBe(70);
    expect(pet.stats.energy).toBe(90);
    expect(pet.stats.hunger).toBe(75);
  });

  it('сон: уложить и разбудить; разбудить раньше времени — счастье −10', () => {
    const asleep = act(makePet({ stats: { ...START_STATS, energy: 40 } }), 'sleep');
    expect(asleep.isSleeping).toBe(true);
    const woken = act(asleep, 'sleep');
    expect(woken.isSleeping).toBe(false);
    expect(woken.stats.happiness).toBe(70);
  });

  it('разбудить выспавшегося — без штрафа', () => {
    const pet = act(makePet({ isSleeping: true }), 'sleep');
    expect(pet.stats.happiness).toBe(80);
  });

  it('когда убирать нечего, кнопка «Убрать» неактивна', () => {
    expect(blockReason(makePet({ poops: 0 }), 'clean', {}, T0)).toBe('clean');
    expect(blockReason(makePet({ poops: 1 }), 'clean', {}, T0)).toBeNull();
  });

  it('уборка убирает все какашки', () => {
    expect(act(makePet({ poops: 4 }), 'clean').poops).toBe(0);
  });

  it('лекарство лечит и даёт +30 здоровья', () => {
    const result = performAction(
      makePet({ isSick: true, stats: { ...START_STATS, health: 40 } }),
      'medicine',
      {},
      T0,
    );
    expect(result.ok && result.pet.isSick).toBe(false);
    expect(result.ok && result.pet.stats.health).toBe(70);
    expect(result.ok && result.events).toEqual([{ type: 'recovered' }]);
  });

  it('лекарство при полном здоровье недоступно, пока питомец не болеет', () => {
    const full = makePet({ stats: { ...START_STATS, health: 100 } });
    expect(blockReason(full, 'medicine', {}, T0)).toBe('healthy');
    expect(performAction(full, 'medicine', {}, T0)).toEqual({ ok: false, reason: 'healthy' });
    expect(blockReason({ ...full, isSick: true }, 'medicine', {}, T0)).toBeNull();
  });

  it('лекарство при неполном здоровье лечит, но больному не нужному — счастье −10', () => {
    const r = performAction(makePet({ stats: { ...START_STATS, health: 80 } }), 'medicine', {}, T0);
    expect(r.ok && r.pet.stats.happiness).toBe(70);
  });
});

describe('лакомства как валюта', () => {
  it('новый питомец начинает без лакомств, и дать лакомство нельзя', () => {
    const pet = makePet();
    expect(pet.treats).toBe(0);
    expect(blockReason(pet, 'snack', {}, T0)).toBe('noTreats');
    expect(performAction(pet, 'snack', {}, T0)).toEqual({ ok: false, reason: 'noTreats' });
  });

  it('победа в мини-игре: эффект «Поиграть», радость сильнее и лакомства в награду', () => {
    const pet = makePet({ stats: { ...START_STATS, happiness: 50 } });
    const won = finishPlay(pet, true, 2, {}, T0);
    expect(won.ok).toBe(true);
    if (!won.ok) return;
    expect(won.pet.treats).toBe(2);
    expect(won.pet.stats.happiness).toBe(80);
    expect(won.pet.stats.energy).toBe(90);
    expect(won.cooldowns.play).toBeGreaterThan(T0);
  });

  it('поражение: только эффект «Поиграть», без награды', () => {
    const lost = finishPlay(makePet({ stats: { ...START_STATS, happiness: 50 } }), false, 3, {}, T0);
    expect(lost.ok && lost.pet.treats).toBe(0);
    expect(lost.ok && lost.pet.stats.happiness).toBe(70);
  });

  it('во сне и при болезни поиграть нельзя — и награду не получить', () => {
    expect(finishPlay(makePet({ isSleeping: true }), true, 2, {}, T0)).toEqual({ ok: false, reason: 'sleeping' });
    expect(finishPlay(makePet({ isSick: true }), true, 2, {}, T0)).toEqual({ ok: false, reason: 'sick' });
  });
});
