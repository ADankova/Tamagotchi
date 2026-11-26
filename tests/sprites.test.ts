import { describe, expect, it } from 'vitest';
import { SCREEN_W } from '../src/render/scene';
import { PET_SCALE } from '../src/render/sprites';
import { SPECIES, type Species } from '../src/core/types';
import { SPECIES_LOOKS } from '../src/render/species';
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
  'catBaby',
  'catChild',
  'catTeen',
  'catAdultGood',
  'catAdultNormal',
  'catAdultNaughty',
  'catElder',
  'dogBaby',
  'dogChild',
  'dogTeen',
  'dogAdultGood',
  'dogAdultNormal',
  'dogAdultNaughty',
  'dogElder',
];

describe('спрайты', () => {
  it.each(NAMES)('%s: прямоугольная карта из допустимых символов', (name: SpriteName) => {
    const s = SPRITES[name];
    // У питомцев коробка крупнее карты (PET_SCALE), у остальных совпадает.
    const rawW = s.rows[0]!.length;
    expect(Math.abs(s.h - s.rows.length * (s.h > s.rows.length ? PET_SCALE : 1))).toBeLessThanOrEqual(1);
    for (const row of s.rows) {
      expect(row).toHaveLength(rawW);
      expect(s.w === rawW || Math.abs(s.w - rawW * PET_SCALE) <= 1).toBe(true);
      expect(/^[.#+oe]+$/.test(row)).toBe(true);
    }
  });

  it.each(CREATURES)('%s: симметричен по горизонтали', (name: SpriteName) => {
    for (const row of SPRITES[name].rows) {
      expect(row).toBe([...row].reverse().join(''));
    }
  });

  it.each(CREATURES)('%s: помещается на экран при ходьбе', (name: SpriteName) => {
    // Питомец крупнее прежнего: ходит, сколько позволяет экран, но целиком в нём помещается.
    expect(SPRITES[name].w + 2).toBeLessThanOrEqual(SCREEN_W);
    expect(SPRITES[name].h).toBeLessThanOrEqual(28);
  });

  it('у живых персонажей есть глаза (их можно закрыть)', () => {
    for (const name of CREATURES.filter((n) => n !== 'egg' && n !== 'grave')) {
      expect(SPRITES[name].rows.join('').includes('e')).toBe(true);
    }
  });
});

describe('животные', () => {
  it.each(SPECIES)('%s: облик есть у каждой стадии, хвост — два кадра одного размера', (species: Species) => {
    const look = SPECIES_LOOKS[species];
    for (const sprite of Object.values(look.bodies)) expect(SPRITES[sprite].h).toBeGreaterThan(0);
    if (look.tail) {
      const [a, b] = look.tail;
      expect(SPRITES[a].w).toBe(SPRITES[b].w);
      expect(SPRITES[a].h).toBe(SPRITES[b].h);
    }
  });
});
