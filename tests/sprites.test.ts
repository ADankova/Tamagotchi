import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../src/render/scene';
import { SPRITES, type SpriteName } from '../src/render/sprites';

const NAMES = Object.keys(SPRITES) as SpriteName[];
const CREATURES: SpriteName[] = [
  'egg',
  'baby',
  'child',
  'teen',
  'adultGood',
  'adultNormal',
  'adultNaughty',
  'elder',
  'grave',
];

describe('спрайты', () => {
  it.each(NAMES)('%s: прямоугольная карта из допустимых символов', (name: SpriteName) => {
    const s = SPRITES[name];
    expect(s.h).toBe(s.rows.length);
    for (const row of s.rows) {
      expect(row).toHaveLength(s.w);
      expect(/^[.#+oe]+$/.test(row)).toBe(true);
    }
  });

  it.each(CREATURES)('%s: симметричен по горизонтали', (name: SpriteName) => {
    for (const row of SPRITES[name].rows) {
      expect(row).toBe([...row].reverse().join(''));
    }
  });

  it.each(CREATURES)('%s: помещается на экран при ходьбе', (name: SpriteName) => {
    expect(SPRITES[name].w + 24).toBeLessThanOrEqual(SCREEN_W);
    expect(SPRITES[name].h).toBeLessThanOrEqual(20);
  });

  it('у живых персонажей есть глаза (их можно закрыть)', () => {
    for (const name of ['baby', 'child', 'teen', 'adultGood', 'adultNormal', 'adultNaughty', 'elder'] as const) {
      expect(SPRITES[name].rows.join('').includes('e')).toBe(true);
    }
  });
});
