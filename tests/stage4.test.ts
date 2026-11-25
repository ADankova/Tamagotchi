import { describe, expect, it } from 'vitest';
import { hasNewNeed, soundForAction, soundForEvent, TUNES, tuneDuration, type SoundName } from '../src/audio/tunes';
import { HOUR, MINUTE, START_STATS } from '../src/core/config';
import { nextAttention } from '../src/core/forecast';
import { createPet } from '../src/core/pet';
import { tick } from '../src/core/simulation';
import { attentionMessage } from '../src/notify/notifier';
import { createInitialState } from '../src/storage/save';
import { makePet, T0 } from './helpers';

describe('звуки', () => {
  it('у каждого звука есть мелодия разумной длины', () => {
    for (const name of Object.keys(TUNES) as SoundName[]) {
      expect(TUNES[name].length).toBeGreaterThan(0);
      expect(tuneDuration(name)).toBeLessThanOrEqual(1500);
      for (const [freq, ms] of TUNES[name]) {
        expect(freq === 0 || (freq >= 100 && freq <= 4000)).toBe(true);
        expect(ms).toBeGreaterThan(0);
      }
    }
  });

  it('звук действия; для сна — уснул или проснулся', () => {
    expect(soundForAction('feed', false)).toBe('feed');
    expect(soundForAction('sleep', true)).toBe('sleep');
    expect(soundForAction('sleep', false)).toBe('wake');
  });

  it('звуки событий', () => {
    expect(soundForEvent({ type: 'hatched' })).toBe('hatch');
    expect(soundForEvent({ type: 'stageChanged', stage: 'teen' })).toBe('evolve');
    expect(soundForEvent({ type: 'stageChanged', stage: 'baby' })).toBeNull();
    expect(soundForEvent({ type: 'gotSick' })).toBe('sick');
    expect(soundForEvent({ type: 'died', cause: 'hunger' })).toBe('death');
    expect(soundForEvent({ type: 'fellAsleep', auto: true })).toBeNull();
  });

  it('пищим только о новой потребности', () => {
    expect(hasNewNeed([], ['hunger'])).toBe(true);
    expect(hasNewNeed(['hunger'], ['hunger'])).toBe(false);
    expect(hasNewNeed(['hunger', 'hygiene'], ['hunger'])).toBe(false);
  });

  it('новая игра: звук включён по умолчанию', () => {
    expect(createInitialState(T0).settings.sound).toBe(true);
  });
});

describe('прогноз заботы для напоминаний', () => {
  it('яйцо — напомнит о вылуплении', () => {
    const attention = nextAttention(createPet('Пушок', T0, 1));
    expect(attention?.reason).toBe('hatch');
    expect(attention?.inMs).toBe(10 * MINUTE);
  });

  it('сытый питомец проголодается, и прогноз совпадает с симуляцией', () => {
    const pet = makePet();
    const attention = nextAttention(pet);
    expect(attention?.reason).toBe('hungry');
    const before = tick(pet, (attention?.inMs ?? 0) - 10 * MINUTE).pet;
    const after = tick(pet, attention?.inMs ?? 0).pet;
    expect(before.stats.hunger).toBeGreaterThanOrEqual(20);
    expect(after.stats.hunger).toBeLessThan(20);
    expect(attention?.inMs).toBeGreaterThan(5 * HOUR);
  });

  it('если забота нужна уже сейчас — не напоминаем повторно', () => {
    expect(nextAttention(makePet({ stats: { ...START_STATS, hunger: 5 } }))).toBeNull();
    expect(nextAttention(makePet({ isSick: true }))).toBeNull();
    expect(nextAttention(makePet({ stage: 'dead' }))).toBeNull();
  });

  it('текст уведомления с именем питомца', () => {
    const pet = makePet();
    expect(attentionMessage(pet, { inMs: 1, reason: 'hungry' }).body).toBe('Пушок проголодался.');
    expect(attentionMessage(pet, { inMs: 1, reason: 'sick' }).body.startsWith('Пушок')).toBe(true);
  });
});
