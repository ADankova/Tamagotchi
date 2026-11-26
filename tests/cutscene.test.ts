import { describe, expect, it } from 'vitest';
import { createPet } from '../src/core/pet';
import {
  composeScene,
  CUTSCENE_MS,
  cutsceneFor,
  isCutscenePlaying,
  SCREEN_H,
  SCREEN_W,
  type Cutscene,
  type Scene,
} from '../src/render/scene';
import { SPRITES } from '../src/render/sprites';
import { makePet, T0 } from './helpers';

const sprites = (scene: Scene) => scene.items.map((i) => i.sprite);

describe('выбор сценки', () => {
  const egg = createPet('Пушок', T0, 1);
  const baby = { ...egg, stage: 'baby' as const };
  const child = { ...egg, stage: 'child' as const };
  const adult = { ...egg, stage: 'adult' as const, form: 'naughty' as const };
  const dead = { ...adult, stage: 'dead' as const, stageAtDeath: 'adult' as const };

  it('яйцо → малыш: вылупление', () => {
    expect(cutsceneFor(egg, baby, 5)).toEqual({ kind: 'hatch', startedAt: 5, from: 'egg', to: 'baby' });
  });

  it('рост: взросление с учётом формы', () => {
    expect(cutsceneFor(child, adult, 0)).toEqual({ kind: 'evolve', startedAt: 0, from: 'child', to: 'teen' });
  });

  it('смерть: от последнего облика', () => {
    expect(cutsceneFor(adult, dead, 0)?.kind).toBe('death');
    expect(cutsceneFor(adult, dead, 0)?.from).toBe('teen');
  });

  it('нет сценки без смены стадии, для другого питомца и после смерти', () => {
    expect(cutsceneFor(child, { ...child }, 0)).toBeNull();
    expect(cutsceneFor(child, { ...adult, bornAt: T0 + 1 }, 0)).toBeNull();
    expect(cutsceneFor(dead, egg, 0)).toBeNull();
  });

  it('сценка заканчивается вовремя', () => {
    const c: Cutscene = { kind: 'evolve', startedAt: 100, from: 'child', to: 'teen' };
    expect(isCutscenePlaying(c, 100)).toBe(true);
    expect(isCutscenePlaying(c, 100 + CUTSCENE_MS.evolve - 1)).toBe(true);
    expect(isCutscenePlaying(c, 100 + CUTSCENE_MS.evolve)).toBe(false);
    expect(isCutscenePlaying(null, 0)).toBe(false);
  });
});

describe('отрисовка сценок', () => {
  const pet = makePet({ stage: 'baby' });

  it('вылупление: яйцо трясётся, трескается, появляется малыш', () => {
    const c: Cutscene = { kind: 'hatch', startedAt: 0, from: 'egg', to: 'baby' };
    expect(sprites(composeScene(pet, null, 300, false, c))).toEqual(['egg']);
    expect(sprites(composeScene(pet, null, 1500, false, c))).toEqual(['eggCracked']);
    const end = sprites(composeScene(pet, null, 2000, false, c));
    expect(end[0]).toBe('baby');
    expect(end).toContain('sparkle');
    expect(composeScene(pet, null, 300, false, c).state).toBe('hatching');
  });

  it('взросление: старый и новый облик чередуются, при reduced motion — сразу новый', () => {
    const c: Cutscene = { kind: 'evolve', startedAt: 0, from: 'child', to: 'teen' };
    const seen = new Set<string>();
    for (let t = 0; t < 1800; t += 100) seen.add(sprites(composeScene(pet, null, t, false, c))[0] ?? '');
    expect([...seen].sort()).toEqual(['child', 'teen']);
    for (let t = 0; t < 1800; t += 100) {
      expect(sprites(composeScene(pet, null, t, true, c))[0]).toBe('teen');
    }
  });

  it('смерть: глаза закрываются, потом поднимается призрак', () => {
    const c: Cutscene = { kind: 'death', startedAt: 0, from: 'teen', to: 'grave' };
    const first = composeScene(makePet({ stage: 'dead' }), null, 200, false, c);
    expect(first.items[0]?.sprite).toBe('teen');
    expect(first.items[0]?.eyesClosed).toBe(true);
    expect(first.state).toBe('dying');
    const a = composeScene(makePet({ stage: 'dead' }), null, 1000, false, c).items[0];
    const b = composeScene(makePet({ stage: 'dead' }), null, 2400, false, c).items[0];
    expect(a?.sprite).toBe('ghost');
    expect((b?.y ?? 99) < (a?.y ?? 0)).toBe(true);
  });

  it('после сценки — обычная сцена', () => {
    const c: Cutscene = { kind: 'hatch', startedAt: 0, from: 'egg', to: 'baby' };
    expect(composeScene(pet, null, CUTSCENE_MS.hatch + 1, false, c).state).toBe('idle');
  });

  it('сценки не выходят за экран', () => {
    const cases: Cutscene[] = [
      { kind: 'hatch', startedAt: 0, from: 'egg', to: 'baby' },
      { kind: 'evolve', startedAt: 0, from: 'teen', to: 'adultGood' },
      { kind: 'evolve', startedAt: 0, from: 'adultNaughty', to: 'elder' },
      { kind: 'death', startedAt: 0, from: 'elder', to: 'grave' },
    ];
    for (const c of cases) {
      for (let t = 0; t < CUTSCENE_MS[c.kind]; t += 23) {
        for (const i of composeScene(pet, null, t, false, c).items) {
          const s = SPRITES[i.sprite];
          const ok = i.x >= 0 && i.y >= 0 && i.x + s.w <= SCREEN_W && i.y + s.h <= SCREEN_H;
          if (!ok) throw new Error(`${c.kind} t=${t}: ${i.sprite} at ${i.x},${i.y}`);
        }
      }
    }
  });
});
