import { describe, expect, it } from 'vitest';
import { DAY } from '../src/core/config';
import { careGrade, summarizeGraveyard } from '../src/memorial';
import type { GraveRecord } from '../src/storage/save';

const record = (name: string, days: number): GraveRecord => ({
  name,
  stage: 'adult',
  bornAt: 0,
  diedAt: days * DAY,
  ageMs: days * DAY,
  causeOfDeath: 'hunger',
});

describe('Зал памяти', () => {
  it('пустой зал', () => {
    expect(summarizeGraveyard([])).toEqual({ count: 0, longest: null });
  });

  it('считает питомцев и находит рекордсмена', () => {
    const list = [record('Бублик', 3), record('Пушок', 17), record('Кекс', 9)];
    const summary = summarizeGraveyard(list);
    expect(summary.count).toBe(3);
    expect(summary.longest?.name).toBe('Пушок');
  });

  it('оценка ухода по тем же порогам, что и форма взрослого', () => {
    expect(careGrade(95)).toBe('good');
    expect(careGrade(50)).toBe('normal');
    expect(careGrade(12)).toBe('naughty');
  });
});
