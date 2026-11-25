import { describe, expect, it } from 'vitest';
import { START_STATS } from '../src/core/config';
import { createPet } from '../src/core/pet';
import {
  ACTION_ANIM_MS,
  animState,
  composeScene,
  GROUND_Y,
  petSprite,
  petTail,
  SCREEN_H,
  SCREEN_W,
  type Scene,
} from '../src/render/scene';
import { SPECIES } from '../src/core/types';
import { SPRITES } from '../src/render/sprites';
import { makePet, T0 } from './helpers';

const sprites = (scene: Scene) => scene.items.map((i) => i.sprite);

function inBounds(scene: Scene): boolean {
  return scene.items.every((i) => {
    const s = SPRITES[i.sprite];
    return i.x >= 0 && i.y >= 0 && i.x + s.w <= SCREEN_W && i.y + s.h <= SCREEN_H;
  });
}

describe('выбор спрайта', () => {
  it('по стадии и форме', () => {
    expect(petSprite(createPet('Я', T0, 1))).toBe('egg');
    expect(petSprite(makePet({ stage: 'baby' }))).toBe('baby');
    expect(petSprite(makePet({ stage: 'adult', form: 'good' }))).toBe('adultGood');
    expect(petSprite(makePet({ stage: 'adult', form: 'naughty' }))).toBe('adultNaughty');
    expect(petSprite(makePet({ stage: 'adult' }))).toBe('adultNormal');
    expect(petSprite(makePet({ stage: 'dead' }))).toBe('grave');
  });
});

describe('состояние анимации', () => {
  it('приоритеты: смерть > яйцо > действие > сон > болезнь > грусть > обычное', () => {
    expect(animState(makePet({ stage: 'dead', isSick: true }), null, 0)).toBe('dead');
    expect(animState(createPet('Я', T0, 1), { action: 'feed', startedAt: 0 }, 10)).toBe('egg');
    expect(animState(makePet({ isSick: true }), { action: 'medicine', startedAt: 0 }, 10)).toBe('medicine');
    expect(animState(makePet({ isSleeping: true, isSick: true }), null, 0)).toBe('sleeping');
    expect(animState(makePet({ isSick: true }), null, 0)).toBe('sick');
    expect(animState(makePet({ stats: { ...START_STATS, hunger: 10 } }), null, 0)).toBe('sad');
    expect(animState(makePet(), null, 0)).toBe('idle');
  });

  it('анимация действия заканчивается вовремя', () => {
    const active = { action: 'feed' as const, startedAt: 1000 };
    expect(animState(makePet(), active, 1000)).toBe('eating');
    expect(animState(makePet(), active, 1000 + ACTION_ANIM_MS.feed - 1)).toBe('eating');
    expect(animState(makePet(), active, 1000 + ACTION_ANIM_MS.feed)).toBe('idle');
  });

  it('у сна нет отдельной анимации действия', () => {
    expect(animState(makePet(), { action: 'sleep', startedAt: 0 }, 10)).toBe('idle');
  });
});

describe('сцена', () => {
  it('каждое действие показывает свой предмет', () => {
    const at = (action: 'feed' | 'snack' | 'play' | 'clean' | 'medicine', dt = 100) =>
      sprites(composeScene(makePet(), { action, startedAt: 0 }, dt));
    expect(at('feed')).toContain('bowl');
    expect(at('snack')).toContain('candy');
    expect(at('snack', ACTION_ANIM_MS.snack - 100)).toContain('heart');
    expect(at('play')).toContain('ball');
    expect(at('clean')).toContain('bubble');
    expect(at('medicine')).toContain('pill');
  });

  it('сон: глаза закрыты, экран притушен, летят «Z»', () => {
    const scene = composeScene(makePet({ isSleeping: true }), null, 500);
    expect(scene.dim).toBe(true);
    expect(scene.items.find((i) => i.sprite === 'child')?.eyesClosed).toBe(true);
    expect(sprites(scene).filter((s) => s === 'zed')).toHaveLength(2);
  });

  it('болезнь показывает череп, грязь — какашку на полу', () => {
    expect(sprites(composeScene(makePet({ isSick: true }), null, 0))).toContain('skull');
    const dirty = composeScene(makePet({ stats: { ...START_STATS, hygiene: 10 } }), null, 0);
    expect(sprites(dirty).filter((s) => s === 'poop')).toHaveLength(2);
  });

  it('после уборки какашек нет', () => {
    const scene = composeScene(makePet({ stats: { ...START_STATS, hygiene: 10 } }), { action: 'clean', startedAt: 0 }, 50);
    expect(sprites(scene)).not.toContain('poop');
  });

  it('смерть — только надгробие', () => {
    expect(sprites(composeScene(makePet({ stage: 'dead' }), null, 0))).toEqual(['grave']);
  });

  it('питомец стоит на земле', () => {
    const item = composeScene(makePet(), null, 0, true).items[0];
    expect(item && item.y + SPRITES[item.sprite].h).toBe(GROUND_Y);
  });

  it('в обычном состоянии ходит, при reduced motion стоит по центру', () => {
    const xs = new Set<number>();
    for (let t = 0; t < 9600; t += 400) xs.add(composeScene(makePet(), null, t).items[0]?.x ?? -1);
    expect(xs.size).toBeGreaterThan(5);

    const still = new Set<number>();
    for (let t = 0; t < 9600; t += 400) still.add(composeScene(makePet(), null, t, true).items[0]?.x ?? -1);
    expect(still.size).toBe(1);
    expect([...still][0]).toBe(Math.round(SCREEN_W / 2 - SPRITES.child.w / 2));
  });

  it('при reduced motion глаза не моргают', () => {
    const scene = composeScene(makePet(), null, 0, true);
    expect(scene.items[0]?.eyesClosed).toBe(false);
  });

  it('все предметы всегда в пределах экрана — у всех животных', () => {
    const base = [
      createPet('Я', T0, 1),
      makePet({ stage: 'baby' }),
      makePet(),
      makePet({ stage: 'teen' }),
      makePet({ stage: 'adult', form: 'good' }),
      makePet({ stage: 'elder', stats: { ...START_STATS, hygiene: 5 } }),
      makePet({ isSleeping: true, stage: 'adult' }),
      makePet({ isSick: true, stage: 'elder' }),
      makePet({ stage: 'teen', stats: { ...START_STATS, happiness: 5 } }),
      makePet({ stage: 'dead' }),
    ];
    const pets = SPECIES.flatMap((species) => base.map((p) => ({ ...p, species })));
    const actions = [null, ...(['feed', 'snack', 'play', 'clean', 'medicine'] as const).map((a) => ({ action: a, startedAt: 0 }))];
    for (const pet of pets) {
      for (const active of actions) {
        for (let t = 0; t < 12000; t += 37) {
          const scene = composeScene(pet, active, t);
          if (!inBounds(scene)) throw new Error(`out of bounds: ${pet.stage} ${active?.action} t=${t} ${JSON.stringify(scene.items)}`);
        }
      }
    }
  });
});

describe('кошка и собака', () => {
  const cat = makePet({ species: 'cat' });
  const dog = makePet({ species: 'dog', stage: 'adult', form: 'naughty' });

  it('свой облик по стадии и форме', () => {
    expect(petSprite(cat)).toBe('catChild');
    expect(petSprite(dog)).toBe('dogAdultNaughty');
    expect(petSprite({ ...cat, stage: 'egg' })).toBe('egg');
    expect(petSprite({ ...dog, stage: 'dead' })).toBe('grave');
  });

  it('хвост есть у подросших кошки и собаки; у малыша и Пушистика — нет', () => {
    expect(petTail(cat)).toEqual(['catTailA', 'catTailB']);
    expect(petTail(dog)).toEqual(['dogTailA', 'dogTailB']);
    expect(petTail({ ...cat, stage: 'baby' })).toBeNull();
    expect(petTail(makePet())).toBeNull();
  });

  it('хвост рисуется за телом и справа от него', () => {
    const items = composeScene(cat, null, 0, true).items;
    const tailIndex = items.findIndex((i) => i.sprite.startsWith('catTail'));
    const bodyIndex = items.findIndex((i) => i.sprite === 'catChild');
    expect(tailIndex).toBe(bodyIndex - 1);
    const tail = items[tailIndex];
    const body = items[bodyIndex];
    expect((tail?.x ?? 0) > (body?.x ?? 0)).toBe(true);
  });

  it('хвост виляет, когда питомец гуляет, и быстрее — когда играет', () => {
    const frames = (active: Parameters<typeof composeScene>[1], from: number, to: number, stepMs: number) => {
      const seen: string[] = [];
      for (let t = from; t < to; t += stepMs) {
        const tail = composeScene(dog, active, t).items.find((i) => i.sprite.startsWith('dogTail'));
        seen.push(tail?.sprite ?? '');
      }
      return seen;
    };
    expect(new Set(frames(null, 0, 1600, 400)).size).toBe(2);
    const play = frames({ action: 'play', startedAt: 0 }, 0, 320, 160);
    expect(play[0]).not.toBe(play[1]);
  });

  it('во сне и в грусти хвост не двигается', () => {
    const still = (pet: typeof cat) =>
      new Set(
        Array.from({ length: 10 }, (_, k) =>
          composeScene(pet, null, k * 137).items.find((i) => i.sprite.startsWith('catTail'))?.sprite,
        ),
      ).size;
    expect(still({ ...cat, isSleeping: true })).toBe(1);
    expect(still({ ...cat, stats: { ...START_STATS, happiness: 5 } })).toBe(1);
  });
});
