import { describe, expect, it } from 'vitest';
import { START_STATS } from '../src/core/config';
import { createPet } from '../src/core/pet';
import {
  ACTION_ANIM_MS,
  animState,
  chaseFrame,
  chaseTime,
  composeScene,
  GROUND_Y,
  petSprite,
  petTail,
  SCREEN_H,
  SCREEN_W,
  SHEET_FRAMES,
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

  it('болезнь показывает череп, какашки лежат на полу (не больше 6)', () => {
    expect(sprites(composeScene(makePet({ isSick: true }), null, 0))).toContain('skull');
    const dirty = composeScene(makePet({ poops: 2 }), null, 0);
    expect(sprites(dirty).filter((s) => s === 'poopSmall')).toHaveLength(2);
    const many = composeScene(makePet({ poops: 9 }), null, 0);
    expect(sprites(many).filter((s) => s === 'poopSmall')).toHaveLength(6);
  });

  it('после уборки какашек нет', () => {
    const scene = composeScene(makePet({ poops: 4 }), { action: 'clean', startedAt: 0 }, 50);
    expect(sprites(scene)).not.toContain('poopSmall');
  });

  it('смерть — только надгробие', () => {
    expect(sprites(composeScene(makePet({ stage: 'dead' }), null, 0))).toEqual(['grave']);
  });

  it('какашки не налезают друг на друга', () => {
    const xs = composeScene(makePet({ poops: 6 }), null, 0, true).items.filter((i) => i.sprite === 'poopSmall').map((i) => i.x).sort((a, b) => a - b);
    for (let k = 1; k < xs.length; k++) expect((xs.at(k) ?? 0) - (xs.at(k - 1) ?? 0)).toBeGreaterThanOrEqual(SPRITES.poopSmall.w + 1);
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
      makePet({ stage: 'elder', poops: 9 }),
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

const CHASE_AT = (() => {
  for (let t = 0; t < 200000; t += 100) if (chaseTime(t) !== null) return t + 2000;
  return 0;
})();

describe('цветной питомец: анимации и бабочка', () => {
  const body = (scene: Scene, species: 'cat' | 'dog' | 'blob') => scene.items.find((i) => i.sprite === petSprite(makePet({ species })));

  it('строка анимации зависит от состояния', () => {
    const row = (overrides: Parameters<typeof makePet>[0], t = 100) => {
      const pet = makePet(overrides);
      return composeScene(pet, null, t).items.find((i) => i.sprite === petSprite(pet))?.anim;
    };
    expect(row({})).toBe('idle_smooth');
    expect(row({ isSleeping: true })).toBe('sleep_twitch');
    expect(row({ isSick: true })).toBe('sick');
    expect(row({ stats: { ...START_STATS, hunger: 10 } })).toBe('hungry');
    expect(row({ stats: { ...START_STATS, energy: 10 } })).toBe('tired');
    const feed = composeScene(makePet(), { action: 'feed', startedAt: 0 }, 3000);
    expect(feed.items.find((i) => i.sprite === petSprite(makePet()))?.anim).toBe('eat_side');
  });

  it('кадры анимации меняются со временем и замирают при reduced motion', () => {
    const frames = new Set<number>();
    for (let t = 0; t < 4000; t += 110) frames.add(body(composeScene(makePet(), null, t), 'blob')?.frame ?? -1);
    expect(frames.size).toBeGreaterThan(5);
    for (const f of frames) expect(f).toBeLessThan(SHEET_FRAMES + 8);
    for (let t = 0; t < 2000; t += 110) expect(body(composeScene(makePet(), null, t, true), 'blob')?.frame).toBe(0);
  });

  it('бабочка прилетает только во время охоты и только при обычной анимации', () => {
    for (const species of SPECIES) {
      const pet = makePet({ species });
      expect(composeScene(pet, null, 1000).butterfly).toBe(undefined);
      expect(chaseTime(1000)).toBeNull();
      expect(composeScene(pet, null, CHASE_AT).butterfly !== undefined).toBe(true);
      expect(composeScene(pet, null, CHASE_AT, true).butterfly).toBe(undefined);
      expect(composeScene(makePet({ species, isSleeping: true }), null, CHASE_AT).butterfly).toBe(undefined);
    }
  });

  it('кошка прыгает за бабочкой, собака хватает, пушистик бегает кругами по полу', () => {
    const peak = (species: 'cat' | 'dog' | 'blob') => {
      let max = 0;
      for (let e = 0; e < 8000; e += 50) max = Math.max(max, chaseFrame(species, e, e).lift);
      return max;
    };
    expect(peak('cat')).toBeGreaterThanOrEqual(6);
    expect(peak('dog')).toBeGreaterThanOrEqual(4);
    expect(peak('dog')).toBeLessThan(peak('cat'));
    expect(peak('blob')).toBe(0);
    const xs = new Set<number>();
    for (let e = 0; e < 8000; e += 100) xs.add(Math.round(chaseFrame('blob', e, e).cx));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(18);
  });

  it('во время охоты питомец остаётся на экране', () => {
    for (const species of SPECIES) {
      const pet = makePet({ species });
      for (let t = CHASE_AT - 2000; t < CHASE_AT + 6000; t += 100) {
        const item = body(composeScene(pet, null, t), species);
        const s = item && SPRITES[item.sprite];
        expect(item && s && item.x >= 0 && item.x + s.w <= SCREEN_W && item.y >= 0).toBe(true);
      }
    }
  });
});
