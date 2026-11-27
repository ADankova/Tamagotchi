import { describe, expect, it } from 'vitest';
import {
  FR_DAY_MS,
  FR_FIRE_START_MS,
  FR_H,
  FR_NIGHT_AT,
  FR_NIGHT_REWARD,
  FR_SLOTS,
  FR_STACK,
  FR_W,
  frActions,
  frCanSleep,
  frDo,
  frCraft,
  frChestPut,
  frChestTake,
  frChestBuilt,
  frPotAdd,
  frPotCook,
  frPotReturn,
  frRecipe,
  frTargetAt,
  frThrow,
  frCenter,
  frEat,
  frIndex,
  frInFireLight,
  frPath,
  frSleep,
  frSlotsUsed,
  frTap,
  frTick,
  frWalkable,
  newForest,
  restoreForest,
  type FrState,
} from '../src/core/forest';

/** Прогоняет время мелкими шагами, собирая события. */
function run(s: FrState, ms: number, step = 100) {
  const events = [];
  for (let t = 0; t < ms; t += step) events.push(...frTick(s, step));
  return events;
}

describe('«Дикий лес»: карта', () => {
  it('одна и та же карта из одного зерна, костровище в центре', () => {
    const a = newForest(42);
    const b = newForest(42);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.drops).toEqual(b.drops);
    const c = frCenter();
    expect(a.tiles[frIndex(c.x, c.y)]).toBe('pit');
  });

  it('край карты — стена леса, а вещи, вода и кусты достижимы', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const s = newForest(seed);
      for (let x = 0; x < FR_W; x++) {
        expect(frWalkable(s, x, 0)).toBe(false);
        expect(frWalkable(s, x, FR_H - 1)).toBe(false);
      }
      const start = frIndex(Math.floor(s.x), Math.floor(s.y));
      for (const d of s.drops) expect(frPath(s, start, new Set([frIndex(d.x, d.y)]))).not.toBeNull();
      const waterSides = new Set<number>();
      s.tiles.forEach((t, i) => {
        if (t !== 'water') return;
        const x = i % FR_W;
        const y = Math.floor(i / FR_W);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (frWalkable(s, x + dx, y + dy)) waterSides.add(frIndex(x + dx, y + dy));
        }
      });
      expect(frPath(s, start, waterSides)).not.toBeNull();
      expect(s.drops.filter((d) => d.kind === 'branch').length).toBeGreaterThanOrEqual(3);
      expect(s.drops.some((d) => d.kind === 'flint')).toBe(true);
    }
  });
});

/** Ведёт питомца к клетке и ждёт, пока дойдёт и закончит дело. */
function goTo(s: FrState, x: number, y: number) {
  const now = frTap(s, x, y);
  return [...now, ...run(s, 20_000)];
}

describe('«Дикий лес»: сбор и костёр', () => {
  it('питомец доходит до ветки и кладёт её в рюкзак', () => {
    const s = newForest(7);
    const branch = s.drops.find((d) => d.kind === 'branch')!;
    const events = goTo(s, branch.x, branch.y);
    expect(events).toContainEqual({ type: 'picked', item: 'branch' });
    expect(s.inv.branch).toBe(1);
    expect(s.drops.find((d) => d.id === branch.id)).toBe(undefined);
  });

  it('без трёх веток и кремня костёр не разжечь, с ними — горит', () => {
    const s = newForest(7);
    const c = frCenter();
    expect(goTo(s, c.x, c.y)).toContainEqual({ type: 'needForFire' });
    s.inv = { branch: 4, flint: 1 };
    expect(goTo(s, c.x, c.y)).toContainEqual({ type: 'fireLit' });
    expect(s.fire).toBeGreaterThan(0);
    expect(s.inv).toEqual({ branch: 1 });
    expect(frInFireLight(s)).toBe(true);
    const before = s.fire;
    expect(frTap(s, c.x, c.y)).toContainEqual({ type: 'fireFed' });
    expect(s.fire).toBeGreaterThan(before);
    expect(s.inv.branch).toBe(undefined);
  });

  it('рюкзак: 12 ячеек по 10 штук', () => {
    const s = newForest(7);
    s.inv = { stone: FR_STACK * FR_SLOTS };
    expect(frSlotsUsed(s.inv)).toBe(FR_SLOTS);
    const branch = s.drops.find((d) => d.kind === 'branch')!;
    expect(goTo(s, branch.x, branch.y)).toContainEqual({ type: 'full' });
    expect(s.inv.branch).toBe(undefined);
  });

  it('ягоды и грибы едятся из рюкзака', () => {
    const s = newForest(7);
    s.stats.food = 50;
    s.inv = { berries: 2 };
    expect(frEat(s, 'berries')).toEqual([{ type: 'ate', item: 'berries' }]);
    expect(s.stats.food).toBe(60);
    expect(s.inv.berries).toBe(1);
    expect(frEat(s, 'mushroom')).toEqual([]);
  });

  it('у воды питомец пьёт', () => {
    const s = newForest(7);
    s.stats.water = 10;
    const water = s.tiles.findIndex((t, i) => t === 'water' && frPath(s, frIndex(15, 16), new Set([i - 1, i + 1])) !== null);
    const events = goTo(s, water % FR_W, Math.floor(water / FR_W));
    expect(events).toContainEqual({ type: 'drank' });
    expect(s.stats.water).toBeGreaterThan(30);
  });
});

describe('«Дикий лес»: ходьба', () => {
  it('идёт по прямой к точке, сквозь деревья и кусты, но не по воде', () => {
    const s = newForest(7);
    s.tiles = s.tiles.map((t, i) => {
      const x = i % FR_W;
      const y = Math.floor(i / FR_W);
      if (x === 0 || y === 0 || x === FR_W - 1 || y === FR_H - 1) return 'tree';
      if (x === 20) return y === 25 ? 'grass' : 'water';
      if (t === 'pit') return t;
      return y === 18 ? 'tree' : 'grass';
    });
    s.x = 15.5;
    s.y = 17.5;
    frDo(s, 15, 22, null, [15.3, 22.7]);
    expect(s.path).toEqual([[15.3, 22.7]]);
    run(s, 5000);
    expect([s.x, s.y]).toEqual([15.3, 22.7]);
    // За ручей — только через брод внизу, с поворотами, но не по воде.
    frDo(s, 24, 10, null, [24.5, 10.5]);
    expect(s.path.length).toBeGreaterThan(1);
    for (let k = 0; k < 200; k++) {
      frTick(s, 100);
      expect(s.tiles[frIndex(Math.floor(s.x), Math.floor(s.y))]).not.toBe('water');
    }
    expect([s.x, s.y]).toEqual([24.5, 10.5]);
  });
});

describe('«Дикий лес»: кнопки у предметов', () => {
  it('у костровища — «зажечь», у горящего костра — «подкинуть», «приготовить», «спать»', () => {
    const s = newForest(7);
    const c = frCenter();
    const pit = frTargetAt(s, c.x, c.y)!;
    expect(frActions(s, pit)).toEqual(['light']);
    s.fire = 1000;
    expect(frActions(s, pit)).toEqual(['feed', 'cook', 'sleep']);
    expect(frActions(s, frTargetAt(s, 0, 0)!)).toEqual(['chop']);
  });

  it('приготовить гриб у костра, а спать — только вечером', () => {
    const s = newForest(7);
    const c = frCenter();
    s.fire = 100_000;
    s.inv = { mushroom: 1 };
    expect([...frDo(s, c.x, c.y, 'cook'), ...run(s, 10_000)]).toContainEqual({ type: 'openCook' });
    expect(frPotAdd(s, 'mushroom')).toBe(true);
    expect(s.inv).toEqual({});
    expect(frPotCook(s)).toContainEqual({ type: 'cooked', item: 'cooked' });
    expect(s.inv).toEqual({ cooked: 1 });
    expect(s.pot).toEqual([]);
    expect(frPotCook(s)).toContainEqual({ type: 'nothingToCook' });
    expect([...frDo(s, c.x, c.y, 'sleep'), ...run(s, 500)]).toContainEqual({ type: 'sleepNo' });
    s.clock = FR_NIGHT_AT;
    expect(frDo(s, c.x, c.y, 'sleep')).toContainEqual({ type: 'fellAsleep' });
    expect(s.sleeping).toBe(true);
  });

  it('выброшенная вещь ложится на землю рядом', () => {
    const s = newForest(7);
    s.inv = { stone: 2 };
    const before = s.drops.length;
    expect(frThrow(s, 'stone')).toEqual([{ type: 'thrown', item: 'stone' }]);
    expect(s.inv.stone).toBe(1);
    expect(s.drops.length).toBe(before + 1);
  });
});

describe('«Дикий лес»: сутки', () => {
  it('ночью без костра холодно, у костра тепло; утром награда', () => {
    const s = newForest(7);
    s.clock = FR_NIGHT_AT;
    run(s, 10_000);
    expect(s.stats.warmth).toBeLessThan(90);
    s.fire = FR_FIRE_START_MS;
    const cold = s.stats.warmth;
    run(s, 5_000);
    expect(s.stats.warmth).toBeGreaterThan(cold);
    s.clock = FR_DAY_MS - 1000;
    const events = run(s, 2000);
    expect(events).toContainEqual({ type: 'morning', day: 2, reward: FR_NIGHT_REWARD });
    expect(s.treats).toBe(FR_NIGHT_REWARD);
  });

  it('сон у костра ускоряет ночь и лечит; погасший костёр будит', () => {
    const s = newForest(7);
    s.clock = FR_NIGHT_AT;
    expect(frCanSleep(s)).toBe(false);
    s.fire = 30_000;
    s.stats.health = 50;
    frSleep(s, true);
    expect(s.sleeping).toBe(true);
    const events = run(s, 10_000);
    expect(events).toContainEqual({ type: 'fireOut' });
    expect(events).toContainEqual({ type: 'woke' });
    expect(s.sleeping).toBe(false);
    expect(s.stats.health).toBeGreaterThan(50);
    expect(s.clock).toBeGreaterThanOrEqual(FR_NIGHT_AT + 30_000);
  });

  it('если долго мёрзнуть, здоровье кончается и поход заканчивается', () => {
    const s = newForest(7);
    s.clock = FR_NIGHT_AT;
    s.stats.warmth = 0;
    s.stats.health = 2;
    const events = run(s, 10_000);
    expect(events).toContainEqual({ type: 'over' });
    expect(s.over).toBe(true);
    expect(frTick(s, 1000)).toEqual([]);
  });
});

describe('«Дикий лес»: сохранение', () => {
  it('сохранённый поход восстанавливается, испорченный — нет', () => {
    const s = newForest(5);
    run(s, 3000);
    expect(restoreForest(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(restoreForest({ v: 1, tiles: [] })).toBeNull();
    expect(restoreForest(null)).toBeNull();
  });
});

describe('«Дикий лес»: окошко готовки', () => {
  it('еда переезжает в окошко по одной штуке и возвращается обратно', () => {
    const s = newForest(7);
    s.inv = { berries: 2, mushroom: 2 };
    expect(frPotAdd(s, 'mushroom')).toBe(true);
    expect(s.inv.mushroom).toBe(1);
    expect(frPotAdd(s, 'berries')).toBe(false);
    expect(frPotAdd(s, 'stone')).toBe(false);
    expect(frRecipe(s.pot)).toBe('cooked');
    frPotAdd(s, 'mushroom');
    expect(frPotAdd(s, 'mushroom')).toBe(false);
    expect(s.pot.length).toBe(2);
    expect(frRecipe(s.pot)).toBe(null);
    frPotReturn(s);
    expect(s.pot).toEqual([]);
    expect(s.inv).toEqual({ berries: 2, mushroom: 2 });
  });

  it('без огня и без рецепта ничего не готовится', () => {
    const s = newForest(7);
    s.inv = { mushroom: 1 };
    frPotAdd(s, 'mushroom');
    expect(frPotCook(s)).toContainEqual({ type: 'needForFire' });
    s.fire = 1000;
    s.pot = ['mushroom', 'mushroom'];
    expect(frPotCook(s)).toContainEqual({ type: 'nothingToCook' });
    expect(s.pot).toEqual(['mushroom', 'mushroom']);
  });
});

describe('«Дикий лес»: этап 2', () => {
  it('траву без ножа не собрать, нож и топор крафтятся', () => {
    const s = newForest(7);
    const c = frCenter();
    s.drops = [{ id: 99, kind: 'grass', x: c.x + 3, y: c.y + 3 }];
    const ev = [...frDo(s, c.x + 3, c.y + 3, 'pick'), ...run(s, 20_000)];
    expect(ev).toContainEqual({ type: 'needKnife' });
    expect(frCraft(s, 'knife')).toContainEqual({ type: 'needMaterials' });
    s.inv = { branch: 3, stone: 3 };
    expect(frCraft(s, 'knife')).toContainEqual({ type: 'crafted', item: 'knife' });
    expect(frCraft(s, 'knife')).toContainEqual({ type: 'haveIt' });
    const ev2 = [...frDo(s, c.x + 3, c.y + 3, 'pick'), ...run(s, 20_000)];
    expect(ev2).toContainEqual({ type: 'picked', item: 'grass' });
  });

  it('деревья рубятся топором и дают ветки', () => {
    const s = newForest(7);
    const i = s.tiles.findIndex((k, n) => k === 'tree' && n % 30 > 3 && n % 30 < 26 && Math.floor(n / 30) > 3 && Math.floor(n / 30) < 26);
    const x = i % 30;
    const y = Math.floor(i / 30);
    s.x = x + 0.5;
    s.y = y + 0.5;
    expect([...frDo(s, x, y, 'chop'), ...run(s, 5000)]).toContainEqual({ type: 'needAxe' });
    s.inv = { axe: 1 };
    expect([...frDo(s, x, y, 'chop'), ...run(s, 5000)]).toContainEqual({ type: 'chopped' });
    expect(s.tiles[i]).toBe('grass');
    expect(s.inv.branch).toBe(2);
  });

  it('сундук строится у костра и хранит вещи', () => {
    const s = newForest(7);
    s.inv = { branch: 6, stone: 4, grass: 2 };
    expect(frCraft(s, 'chest')).toContainEqual({ type: 'crafted', item: 'chest' });
    expect(frChestBuilt(s)).toBe(true);
    s.inv = { berries: 2 };
    expect(frChestPut(s, 'berries')).toBe(true);
    expect(s.chest).toEqual({ berries: 1 });
    expect(frChestTake(s, 'berries')).toBe(true);
    expect(s.inv).toEqual({ berries: 2 });
  });

  it('задания идут по цепочке и награждают лакомствами', () => {
    const s = newForest(7);
    s.inv = { branch: 3, flint: 1 };
    const ev = run(s, 100);
    expect(ev).toContainEqual({ type: 'questDone', step: 0, reward: 1 });
    expect(s.quest).toBe(1);
    expect(s.treats).toBe(1);
  });
});
