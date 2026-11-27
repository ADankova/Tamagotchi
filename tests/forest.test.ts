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
  frClaim,
  frCraft,
  frTorch,
  frChestPut,
  frChestSpots,
  frCapacity,
  frWear,
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
    expect(frPotAdd(s, 'stone')).toBe(false);
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
    expect(s.inv.branch! >= 2 && s.inv.branch! <= 4).toBe(true);
  });

  it('сундук строится у костра и хранит вещи', () => {
    const s = newForest(7);
    s.inv = { branch: 6, grass: 4 };
    expect(frCraft(s, 'chest')).toContainEqual({ type: 'noPlace' });
    const spots = frChestSpots(s);
    expect(spots.length).toBeGreaterThan(5);
    expect(frCraft(s, 'chest', 0)).toContainEqual({ type: 'noPlace' });
    expect(frCraft(s, 'chest', spots[3]!)).toContainEqual({ type: 'crafted', item: 'chest' });
    expect(s.tiles[spots[3]!]).toBe('chest');
    expect(frChestBuilt(s)).toBe(true);
    expect(s.inv).toEqual({});
    s.inv = { berries: 5 };
    expect(frChestPut(s, 'berries', 3)).toBe(3);
    expect(s.chest).toEqual({ berries: 3 });
    expect(s.inv).toEqual({ berries: 2 });
    expect(frChestTake(s, 'berries', 9)).toBe(3);
    expect(s.inv).toEqual({ berries: 5 });
  });

  it('задания: выполнил, получил награду кнопкой, повторно нельзя', () => {
    const s = newForest(7);
    s.inv = { branch: 3, flint: 1 };
    s.drops = [
      { id: 1, kind: 'branch', x: 14, y: 17 },
      { id: 2, kind: 'branch', x: 15, y: 17 },
      { id: 3, kind: 'branch', x: 16, y: 17 },
      { id: 4, kind: 'flint', x: 14, y: 18 },
    ];
    s.x = 15.5;
    s.y = 17.5;
    for (const d of [...s.drops]) frDo(s, d.x, d.y, 'pick'), run(s, 2000);
    run(s, 100);
    expect(s.count['pick:branch']).toBeGreaterThanOrEqual(3);
    expect(s.notified).toContain('start');
    expect(s.treats).toBe(0);
    const before = s.inv.berries ?? 0;
    expect(frClaim(s, 'start')).toContainEqual({ type: 'questDone', id: 'start', reward: 0 });
    expect(s.inv.berries).toBe(before + 3);
    expect(frClaim(s, 'start')).toEqual([]);
    expect(frClaim(s, 'fire')).toEqual([]);
  });
});

describe('«Дикий лес»: трава и большие камни', () => {
  it('высокая трава покрывает около 65% свободных клеток, камней и веток мало', () => {
    for (const seed of [1, 7, 42]) {
      const s = newForest(seed);
      const n = (k: string): number => s.tiles.filter((x) => x === k).length;
      const free = n('grass') + n('tall') + n('rock');
      expect(n('tall') / free).toBeGreaterThan(0.55);
      expect(n('tall') / free).toBeLessThan(0.78);
      expect(n('rock')).toBeGreaterThan(5);
      expect(s.drops.filter((d) => d.kind === 'branch').length).toBeLessThanOrEqual(8);
      expect(s.drops.some((d) => d.kind === 'grass')).toBe(false);
    }
  });

  it('траву срезают ножом, а камень разбивают киркой', () => {
    const s = newForest(7);
    const ti = s.tiles.findIndex((k, n) => k === 'tall' && n % 30 > 3 && n % 30 < 26 && Math.floor(n / 30) > 3 && Math.floor(n / 30) < 26);
    const tx = ti % 30;
    const ty = Math.floor(ti / 30);
    s.x = tx + 0.5;
    s.y = ty + 0.5;
    expect(frActions(s, frTargetAt(s, tx, ty)!)).toEqual(['cut']);
    expect([...frDo(s, tx, ty, 'cut'), ...run(s, 3000)]).toContainEqual({ type: 'needKnife' });
    s.inv = { knife: 1 };
    expect([...frDo(s, tx, ty, 'cut'), ...run(s, 3000)]).toContainEqual({ type: 'cut' });
    expect(s.tiles[ti]).toBe('grass');
    expect(s.inv.grass! >= 1 && s.inv.grass! <= 3).toBe(true);

    const ri = s.tiles.findIndex((k) => k === 'rock');
    const rx = ri % 30;
    const ry = Math.floor(ri / 30);
    s.x = rx + 0.5;
    s.y = ry + 0.5;
    expect([...frDo(s, rx, ry, 'mine'), ...run(s, 3000)]).toContainEqual({ type: 'needPickaxe' });
    s.inv = { pickaxe: 1 };
    expect([...frDo(s, rx, ry, 'mine'), ...run(s, 3000)]).toContainEqual({ type: 'mined' });
    expect(s.inv.stone! >= 2 && s.inv.stone! <= 4).toBe(true);
    expect(s.tiles[ri]).toBe('grass');
  });

  it('далёкую траву издалека не режут: нажатие ведёт к ней', () => {
    const s = newForest(7);
    const ti = s.tiles.findIndex((k) => k === 'tall');
    s.x = 15.5;
    s.y = 15.5;
    const x = ti % 30;
    const y = Math.floor(ti / 30);
    s.x = x > 15 ? 3.5 : 25.5;
    expect(frActions(s, frTargetAt(s, x, y)!)).toEqual([]);
  });
});

describe('«Дикий лес»: еда, вода, факел', () => {
  it('фляга набирает воду у ручья, без неё нельзя', () => {
    const s = newForest(7);
    const near = (n: number): boolean => ['grass', 'tall'].includes(s.tiles[n - 1]!) || ['grass', 'tall'].includes(s.tiles[n + 1]!);
    const wi = s.tiles.findIndex((k, n) => k === 'water' && n > 90 && n < 800 && n % 30 > 2 && n % 30 < 27 && near(n));
    const wx = wi % 30;
    const wy = Math.floor(wi / 30);
    s.x = ['grass', 'tall'].includes(s.tiles[wi - 1]!) ? wx - 0.5 : wx + 1.5;
    s.y = wy + 0.5;
    expect([...frDo(s, wx, wy, 'fill'), ...run(s, 20_000)]).toContainEqual({ type: 'needFlask' });
    s.inv = { flask: 1 };
    expect([...frDo(s, wx, wy, 'fill'), ...run(s, 20_000)]).toContainEqual({ type: 'filled' });
    expect(s.inv).toEqual({ fullflask: 1 });
    s.stats.water = 20;
    frEat(s, 'fullflask');
    expect(s.stats.water).toBe(50);
    expect(s.inv).toEqual({ flask: 1 });
  });

  it('рецепты: яичница, компот, чай, каша и ягодная каша', () => {
    expect(frRecipe(['egg'])).toBe('friedegg');
    expect(frRecipe(['berries', 'fullflask'])).toBe('compote');
    expect(frRecipe(['grass', 'fullflask'])).toBe('tea');
    expect(frRecipe(['fullflask', 'seeds'])).toBe('porridge');
    expect(frRecipe(['berries', 'seeds', 'fullflask'])).toBe('berryporridge');
    expect(frRecipe(['berries', 'seeds'])).toBe(null);
  });

  it('напитки и блюда меняют сразу несколько шкал', () => {
    const s = newForest(7);
    s.stats = { food: 10, water: 10, warmth: 10, health: 50 };
    s.inv = { tea: 1, compote: 1 };
    frEat(s, 'tea');
    expect(s.stats).toEqual({ food: 10, water: 30, warmth: 40, health: 60 });
    frEat(s, 'compote');
    expect(s.stats.food).toBe(22);
    expect(s.stats.water).toBe(55);
  });

  it('факел горит около минуты и согревает ночью', () => {
    const s = newForest(7);
    s.inv = { torch: 1 };
    s.clock = FR_NIGHT_AT;
    s.x = 3.5;
    s.y = 3.5;
    s.stats.warmth = 50;
    expect(frTorch(s)).toContainEqual({ type: 'torchLit' });
    run(s, 10_000);
    expect(s.stats.warmth).toBeGreaterThanOrEqual(50);
    expect(run(s, 60_000)).toContainEqual({ type: 'torchOut' });
    expect(s.torch).toBe(0);
  });

  it('факел и фляга делаются в крафте, факелов можно несколько', () => {
    const s = newForest(7);
    s.inv = { branch: 4, grass: 9 };
    expect(frCraft(s, 'torch')).toContainEqual({ type: 'crafted', item: 'torch' });
    expect(frCraft(s, 'torch')).toContainEqual({ type: 'crafted', item: 'torch' });
    expect(s.inv.torch).toBe(2);
    expect(frCraft(s, 'flask')).toContainEqual({ type: 'crafted', item: 'flask' });
    expect(frCraft(s, 'flask')).toContainEqual({ type: 'haveIt' });
    s.inv = { fullflask: 1, berries: 1 };
    s.fire = 1000;
    frPotAdd(s, 'fullflask');
    frPotAdd(s, 'berries');
    expect(frPotCook(s)).toContainEqual({ type: 'cooked', item: 'compote' });
    expect(s.inv).toEqual({ flask: 1, compote: 1 });
  });

  it('ткацкий станок: ткань, кошелёк и слоты рюкзака', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { branch: 10, stone: 5, grass: 3 };
    const spot = m.frChestSpots(s)[0];
    expect(m.frCraft(s, 'loom', spot)).toContainEqual({ type: 'crafted', item: 'loom' });
    expect(s.tiles[spot]).toBe('loom');
    expect(m.frWeave(s, 'cloth')).toEqual([{ type: 'needMaterials' }]);
    s.inv = { grass: 20 };
    for (let k = 0; k < 3; k++) m.frWeave(s, 'cloth');
    expect(s.inv.cloth).toBe(3);
    expect(m.frWeave(s, 'purse')).toContainEqual({ type: 'crafted', item: 'purse' });
    expect(s.inv.purse).toBe(1);
    const base = m.frCapacity(s);
    expect(m.frWear(s, 'purse')).toEqual([{ type: 'worn', item: 'purse' }]);
    expect(m.frCapacity(s)).toBe(base + 4);
    s.inv = { stone: 99 * (base + 3) };
    expect(m.frUnwear(s, 0)).toEqual([{ type: 'noRoom' }]);
    s.inv = {};
    expect(m.frUnwear(s, 0)).toEqual([]);
    expect(s.inv.purse).toBe(1);
  });

  it('прочность инструментов: 20 использований, потом ломаются', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { knife: 1 };
    expect(m.frDurability(s, 'knife')).toBe(20);
    s.dur.knife = 1;
    const tall = s.tiles.findIndex((x) => x === 'tall');
    expect(tall).toBeGreaterThan(-1);
    const tx = tall % 30;
    const ty = Math.floor(tall / 30);
    s.x = tx + 0.5;
    s.y = ty + 0.5;
    const ev = [...frDo(s, tx, ty, 'cut'), ...run(s, 3000)];
    expect(ev).toContainEqual({ type: 'broke', item: 'knife' });
    expect(s.inv.knife ?? 0).toBe(0);
    s.inv = { branch: 1, stone: 1 };
    m.frCraft(s, 'knife');
    expect(m.frDurability(s, 'knife')).toBe(20);
  });

  it('блюдо без места в рюкзаке ложится рядом с костром', () => {
    const s = newForest(7);
    s.fire = 1000;
    s.pot = ['fullflask', 'berries'];
    s.inv = { stone: 99, branch: 99, grass: 99, flint: 99, mushroom: 99, knife: 1, axe: 1, pickaxe: 1, torch: 1 };
    const before = s.drops.length;
    const ev = frPotCook(s);
    expect(ev).toContainEqual({ type: 'cookDropped', item: 'compote' });
    expect(s.drops.length).toBe(before + 1);
    const d = s.drops[s.drops.length - 1];
    expect(d.kind).toBe('compote');
    expect(Math.hypot(d.x - frCenter().x, d.y - frCenter().y)).toBeLessThan(3);
    expect(s.inv.compote ?? 0).toBe(0);
  });

  it('при полном рюкзаке добыча падает на землю рядом', () => {
    const s = newForest(7);
    const ti = s.tiles.findIndex((k, n) => k === 'tall' && n % 30 > 3 && n % 30 < 26 && Math.floor(n / 30) > 3 && Math.floor(n / 30) < 26);
    const tx = ti % 30;
    const ty = Math.floor(ti / 30);
    s.x = tx + 0.5;
    s.y = ty + 0.5;
    s.inv = { stone: 99, branch: 99, flint: 99, mushroom: 99, berries: 99, flask: 1, torch: 1, cooked: 99, tea: 99, knife: 1 };
    const before = s.drops.length;
    const ev = [...frDo(s, tx, ty, 'cut'), ...run(s, 3000)];
    expect(ev).toContainEqual({ type: 'spilled' });
    expect(s.tiles[ti]).toBe('grass');
    expect(s.drops.length).toBeGreaterThan(before);
    expect(s.drops.some((d) => d.kind === 'grass')).toBe(true);
  });

  it('надетый кошелёк увеличивает число ячеек в сетке рюкзака', () => {
    // сетка рисуется по frCapacity, а не по базовым 12
    const s = newForest(7);
    s.inv = { purse: 1 };
    const before = frCapacity(s);
    frWear(s, 'purse');
    expect(frCapacity(s)).toBe(before + 4);
  });

  it('дождь тушит костёр, шалаш защищает и изнашивается, лежанка ускоряет лечение', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.fire = 600_000;
    s.weather = { rain: false, left: 1000 };
    const ev = run(s, 2000);
    expect(ev).toContainEqual({ type: 'rainStart' });
    expect(ev).toContainEqual({ type: 'fireDoused' });
    expect(s.fire).toBe(0);
    // под шалашом костёр горит под дождём
    const s2 = newForest(7);
    s2.fire = 600_000;
    s2.shelter = 2;
    s2.weather = { rain: false, left: 1000 };
    run(s2, 2000);
    expect(s2.fire).toBeGreaterThan(0);
    expect(s2.shelter).toBe(1);
    s2.weather = { rain: false, left: 1000 };
    expect(run(s2, 2000)).toContainEqual({ type: 'shelterBroke' });
    expect(s2.shelter).toBe(0);
    // станок: шалаш и лежанка
    const s3 = newForest(7);
    s3.tiles[frChestSpots(s3)[0]!] = 'loom';
    s3.inv = { cloth: 15, branch: 5, stone: 3, grass: 10 };
    expect(m.frCanWeave(s3, 'bed')).toBe(false);
    expect(m.frWeave(s3, 'shelter')).toContainEqual({ type: 'crafted', item: 'shelter' });
    expect(s3.shelter).toBe(30);
    expect(m.frWeave(s3, 'shelter')).toEqual([{ type: 'needMaterials' }]);
    expect(m.frWeave(s3, 'bed')).toContainEqual({ type: 'crafted', item: 'bed' });
    expect(s3.bed).toBe(true);
  });

  it('монстры: мышь убегает, после удара дерётся; волк нападает; к костру не подходят', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    expect(s.mobs.filter((x) => x.kind === 'mouse').length).toBe(3);
    expect(s.mobs.filter((x) => x.kind === 'rabbit').length).toBe(2);
    const c = frCenter();
    s.mobs = [];
    s.fire = 600_000;
    s.x = c.x + 0.5;
    s.y = c.y + 0.5;
    s.stats.health = 100;
    // волк рядом с кругом света: к костру не заходит
    s.mobs.push({ id: 900, kind: 'wolf', x: c.x + 6.5, y: c.y + 0.5, hp: 30, provoked: false, angry: true, cd: 0, wx: 0, wy: 0 });
    run(s, 6000);
    const w = s.mobs[0]!;
    expect(Math.hypot(w.x - (c.x + 0.5), w.y - (c.y + 0.5))).toBeGreaterThan(m.FR_FIRE_RADIUS - 0.2);
    expect(s.stats.health).toBe(100);
    // мышь: убегает от питомца
    const s2 = newForest(7);
    s2.mobs = [{ id: 901, kind: 'mouse', x: s2.x + 3, y: s2.y, hp: 6, provoked: false, angry: false, cd: 0, wx: 0, wy: 0 }];
    s2.tiles = s2.tiles.map((k) => (k === 'tree' || k === 'rock' || k === 'bush' ? 'grass' : k));
    const d0 = 3;
    run(s2, 1000);
    expect(Math.hypot(s2.mobs[0]!.x - s2.x, s2.mobs[0]!.y - s2.y)).toBeGreaterThan(d0 - 0.5);
    // удар: мышь умирает за два удара
    const s3 = newForest(7);
    s3.tiles = s3.tiles.map((k) => (k === 'tree' || k === 'rock' || k === 'bush' || k === 'water' ? 'grass' : k));
    s3.mobs = [{ id: 902, kind: 'rabbit', x: s3.x + 1, y: s3.y, hp: 12, provoked: false, angry: false, cd: 0, wx: 0, wy: 0 }];
    s3.fire = 0;
    m.frAttack(s3, 902);
    const ev = run(s3, 4000);
    expect(ev).toContainEqual({ type: 'mobKilled', kind: 'rabbit' });
    expect(s3.inv.meat).toBe(1);
  });

  it('ловушка: мышь попадается, мясо достаётся, рецепты мяса', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { cloth: 5, branch: 10 };
    const spot = m.frTrapSpots(s)[0]!;
    expect(m.frCraft(s, 'trap', spot)).toContainEqual({ type: 'crafted', item: 'trap' });
    expect(s.tiles[spot]).toBe('trap');
    s.inv = { cloth: 5, branch: 10 };
    const spot2 = m.frTrapSpots(s)[1]!;
    expect(m.frCraft(s, 'trap', spot2)).toContainEqual({ type: 'crafted', item: 'trap' });
    // мышь бежит прямо по ловушке
    s.mobs = [{ id: 903, kind: 'mouse', x: (spot % FR_W) + 0.5, y: Math.floor(spot / FR_W) + 0.5 - 0.2, hp: 6, provoked: false, angry: false, cd: 0, wx: (spot % FR_W) + 0.5, wy: Math.floor(spot / FR_W) + 0.5 }];
    s.x = (spot % FR_W) + 0.5 - 2;
    s.y = Math.floor(spot / FR_W) + 0.5 - 0.2;
    s.tiles[spot] = 'trap';
    run(s, 800);
    expect(s.tiles[spot]).toBe('trapfull');
    expect(s.mobs.length).toBe(0);
    s.inv = {};
    expect(m.frActions(s, m.frTargetAt(s, spot % FR_W, Math.floor(spot / FR_W))!)).toEqual(['open']);
    expect(m.frRecipe(['meat'])).toBe('steak');
    expect(m.frRecipe(['fullflask', 'meat'])).toBe('broth');
    expect(m.frRecipe(['meat', 'fullflask', 'seeds'])).toBe('meatporridge');
  });

  it('в высокой траве мышь питомца не видит, на открытом месте убегает с 3 клеток', () => {
    const mk = (tall: boolean) => {
      const s = newForest(7);
      s.tiles = s.tiles.map((k) => (k === 'tree' || k === 'rock' || k === 'bush' || k === 'water' || k === 'tall' ? 'grass' : k));
      if (tall) s.tiles[frIndex(Math.floor(s.x), Math.floor(s.y))] = 'tall';
      s.fire = 0;
      s.mobs = [{ id: 950, kind: 'mouse', x: s.x + 2.5, y: s.y, hp: 6, provoked: false, angry: false, cd: 0, wx: s.x + 2.5, wy: s.y }];
      return s;
    };
    const open = mk(false);
    run(open, 600);
    expect(open.mobs[0]!.x - open.x).toBeGreaterThan(2.9);
    const grass = mk(true);
    run(grass, 600);
    expect(grass.mobs[0]!.x - grass.x).toBeLessThan(2.7);
  });

  it('волк замечает питомца за 4 клетки, а в высокой траве только за 2', () => {
    const mk = (tall: boolean, dist: number) => {
      const s = newForest(7);
      s.tiles = s.tiles.map((k) => (k === 'tree' || k === 'rock' || k === 'bush' || k === 'water' || k === 'tall' ? 'grass' : k));
      if (tall) s.tiles[frIndex(Math.floor(s.x), Math.floor(s.y))] = 'tall';
      s.fire = 0;
      s.mobs = [{ id: 960, kind: 'wolf', x: s.x + dist, y: s.y, hp: 30, provoked: false, angry: false, cd: 0, wx: s.x + dist, wy: s.y }];
      run(s, 100);
      return s.mobs[0]!.angry;
    };
    expect(mk(false, 3.8)).toBe(true);
    expect(mk(false, 4.5)).toBe(false);
    expect(mk(true, 2.5)).toBe(false);
    expect(mk(true, 1.8)).toBe(true);
  });

  it('первые две ночи дождя нет, с третьей возможен; задание про шалаш даёт конфету', async () => {
    const m = await import('../src/core/forest');
    const night = (day: number) => {
      const s = newForest(7);
      s.day = day;
      s.clock = m.FR_NIGHT_AT + 1000;
      s.weather = { rain: false, left: 500 };
      return run(s, 3000);
    };
    expect(night(1)).not.toContainEqual({ type: 'rainStart' });
    expect(night(2)).not.toContainEqual({ type: 'rainStart' });
    expect(night(3)).toContainEqual({ type: 'rainStart' });
    const q = m.FR_QUESTS.find((x) => x.id === 'shelter')!;
    expect(q.reward).toBe(1);
  });

  it('локации: выходы, озеро, пещера, дома нет волков, в пещере нет дождя', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    expect(s.loc).toBe('home');
    expect(s.tiles[frIndex(15, 1)]).toBe('exit');
    expect(s.tiles[frIndex(28, 15)]).toBe('exit');
    // вечером дома волков нет
    s.clock = m.FR_EVENING_AT - 10;
    run(s, 500);
    expect(s.mobs.some((x) => x.kind === 'wolf')).toBe(false);
    // идём к выходу на озеро
    const ev = [...frDo(s, 15, 1, 'travel'), ...run(s, 30_000)];
    expect(ev).toContainEqual({ type: 'travelAsk', to: 'lake' });
    expect(s.loc).toBe('home');
    expect(m.frTravel(s, 'lake')).toContainEqual({ type: 'traveled', to: 'lake' });
    expect(s.loc).toBe('lake');
    expect(s.tiles.includes('reed')).toBe(true);
    expect(s.tiles.includes('water')).toBe(true);
    expect(s.pit).toEqual({ x: 15, y: 26 });
    expect(s.tiles[frIndex(15, 26)]).not.toBe('pit');
    // на озере вечером приходят волки
    s.clock = m.FR_EVENING_AT - 10;
    run(s, 500);
    expect(s.mobs.some((x) => x.kind === 'wolf')).toBe(true);
    // обратно домой: дом на месте
    expect(m.frTravel(s, 'home')).toEqual([{ type: 'traveled', to: 'home' }]);
    expect(s.pit).toEqual(frCenter());
    expect(s.tiles[frIndex(frCenter().x, frCenter().y)]).toBe('pit');
    // пещера: темно, дождя нет, волк живёт
    m.frTravel(s, 'cave');
    expect(s.loc).toBe('cave');
    expect(s.tiles.includes('ore')).toBe(true);
    expect(m.frDarkness(s)).toBeGreaterThan(0.8);
    expect(s.mobs.some((x) => x.kind === 'wolf')).toBe(true);
    s.fire = 100_000;
    s.weather = { rain: true, left: 99_999 };
    run(s, 2000);
    expect(s.fire).toBeGreaterThan(0);
    expect(m.frRainHere(s)).toBe(false);
  });

  it('малый костёр в походе, защита деревом, темнота в пещере и железная руда', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    m.frTravel(s, 'lake');
    s.inv = { branch: 3, flint: 1 };
    s.weather = { rain: false, left: 99_999_999 };
    expect(m.frHasPit(s)).toBe(false);
    const spot = m.frCampSpots(s)[0]!;
    expect(m.frCraft(s, 'campfire', spot)).toContainEqual({ type: 'crafted', item: 'campfire' });
    expect(s.tiles[spot]).toBe('pit');
    expect(s.pit).toEqual({ x: spot % 30, y: Math.floor(spot / 30) });
    expect(s.fire).toBe(m.FR_FIRE_START_MS / 3);
    expect(m.frFireRadius(s)).toBe(m.FR_CAMP_RADIUS);
    // дождь без дерева тушит, с деревом нет
    s.weather = { rain: false, left: 100 };
    s.fire = 100_000;
    s.tiles[frIndex(s.pit.x + 1, s.pit.y - 1)] = 'grass';
    s.tiles[frIndex(s.pit.x + 1, s.pit.y)] = 'grass';
    s.tiles[frIndex(s.pit.x - 1, s.pit.y - 1)] = 'grass';
    s.tiles[frIndex(s.pit.x, s.pit.y - 1)] = 'grass';
    s.tiles[frIndex(s.pit.x - 1, s.pit.y)] = 'grass';
    s.tiles[frIndex(s.pit.x - 1, s.pit.y + 1)] = 'grass';
    s.tiles[frIndex(s.pit.x, s.pit.y + 1)] = 'grass';
    s.tiles[frIndex(s.pit.x + 1, s.pit.y + 1)] = 'grass';
    expect(m.frTreeCover(s)).toBe(false);
    run(s, 500);
    expect(s.fire).toBe(0);
    s.tiles[frIndex(s.pit.x + 1, s.pit.y - 1)] = 'tree';
    expect(m.frTreeCover(s)).toBe(true);
    s.weather = { rain: false, left: 100 };
    s.fire = 100_000;
    run(s, 500);
    expect(s.fire).toBeGreaterThan(0);
    // время вышло: костёр пропадает
    s.weather = { rain: false, left: 99_999_999 };
    s.fire = 200;
    expect(run(s, 500)).toContainEqual({ type: 'campGone' });
    expect(s.tiles[frIndex(s.pit.x, s.pit.y)]).toBe('grass');
    expect(m.frHasPit(s)).toBe(false);
    // пещера: без света не разбить руду
    const c = newForest(7);
    m.frTravel(c, 'cave');
    c.mobs = [];
    c.inv = { pickaxe: 1 };
    const oi = c.tiles.findIndex((k) => k === 'ore');
    const ox = oi % 30;
    const oy = Math.floor(oi / 30);
    c.torch = 0;
    c.fire = 0;
    expect([...frDo(c, ox, oy, 'mine'), ...run(c, 20_000)]).toContainEqual({ type: 'tooDark' });
    c.torch = 60_000;
    c.x = c.pit.x + 0.5;
    c.y = c.pit.y + 1.5;
    expect([...frDo(c, ox, oy, 'mine'), ...run(c, 30_000)]).toContainEqual({ type: 'mined' });
    expect(c.inv.ore).toBe(2);
    // железная кирка: 60 ударов
    c.inv = { ingot: 4, branch: 3 };
    expect(m.frCraft(c, 'ironpick')).toContainEqual({ type: 'crafted', item: 'ironpick' });
    expect(m.frDurability(c, 'ironpick')).toBe(60);
  });

  it('рыбалка: нужна удочка, улов и рецепты', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    m.frTravel(s, 'lake');
    s.inv = { reed: 3, branch: 1 };
    expect(m.frCraft(s, 'rod')).toContainEqual({ type: 'crafted', item: 'rod' });
    const wi = s.tiles.findIndex((k, i) => k === 'water' && [i + 1, i - 1, i + 30, i - 30].some((n) => s.tiles[n] === 'grass'));
    const wx = wi % 30;
    const wy = Math.floor(wi / 30);
    let fished = 0;
    for (let k = 0; k < 14; k++) {
      s.busy = null;
      const ev = [...frDo(s, wx, wy, 'fish'), ...run(s, 20_000)];
      if (ev.some((e) => e.type === 'fished')) fished++;
    }
    expect(fished).toBeGreaterThan(2);
    expect(s.inv.fish).toBe(fished);
    expect(m.frRecipe(['fish'])).toBe('friedfish');
    expect(m.frRecipe(['fullflask', 'fish'])).toBe('fishsoup');
  });

  it('литейная: 2 руды в слиток, железные инструменты из слитков, каша с рыбой', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { stone: 15, branch: 5 };
    const spot = m.frChestSpots(s)[0]!;
    expect(m.frCraft(s, 'foundry', spot)).toContainEqual({ type: 'crafted', item: 'foundry' });
    expect(s.tiles[spot]).toBe('foundry');
    expect(m.frActions(s, m.frTargetAt(s, spot % 30, Math.floor(spot / 30))!)).toEqual(['open']);
    s.inv = { ore: 5 };
    expect(m.frSmelt(s)).toContainEqual({ type: 'smelted' });
    expect(m.frSmelt(s)).toContainEqual({ type: 'smelted' });
    expect(m.frSmelt(s)).toEqual([{ type: 'needMaterials' }]);
    expect(s.inv.ingot).toBe(2);
    expect(s.inv.ore).toBe(1);
    // слитки: нож 1+2, топор 3+3, кирка 4+3
    for (const [id, ingots, branches] of [['ironknife', 1, 2], ['ironaxe', 3, 3], ['ironpick', 4, 3]] as const) {
      const c = m.FR_CRAFT.find((r) => r.id === id)!;
      expect(c.cost).toEqual([['ingot', ingots], ['branch', branches]]);
    }
    s.inv = { ingot: 1, branch: 2 };
    expect(m.frCraft(s, 'ironknife')).toContainEqual({ type: 'crafted', item: 'ironknife' });
    expect(m.frDurability(s, 'ironknife')).toBe(60);
    expect(m.frRecipe(['fullflask', 'seeds', 'fish'])).toBe('fishporridge');
    const q = m.FR_QUESTS.find((x) => x.id === 'ironpick')!;
    expect(q.reward).toBe(0);
    expect(q.items).toEqual({ ingot: 3 });
  });
});

import { frRecipeAvailable, frRecipeFill, FR_RECIPES as RCP } from '../src/core/forest';
describe('recipe list', () => {
  it('fills pot from recipe and detects shortage', () => {
    const s = newForest(1);
    for (const k of Object.keys(s.inv)) (s.inv as any)[k] = 0;
    const r = RCP.find((x) => x.to === 'cooked')!;
    expect(frRecipeAvailable(s, r)).toBe(false);
    expect(frRecipeFill(s, r)).toBe(false);
    s.inv.mushroom = 1;
    expect(frRecipeAvailable(s, r)).toBe(true);
    expect(frRecipeFill(s, r)).toBe(true);
    expect(s.pot).toEqual(['mushroom']);
    expect(s.inv.mushroom ?? 0).toBe(0);
    expect(frRecipeFill(s, r)).toBe(true);
    expect(s.pot).toEqual(['mushroom']);
  });
});

import { frYield } from '../src/core/forest';
describe('yields', () => {
  it('frYield stays in range and favours the lowest', () => {
    const s = newForest(3);
    const c = [0, 0, 0];
    for (let i = 0; i < 400; i++) {
      s.count['pick:grass'] = i;
      c[frYield(s, 'pick:grass', 1) - 1]!++;
    }
    expect(c[0]! > c[1]! && c[1]! > c[2]! && c[2]! > 0).toBe(true);
  });
});

describe('сушилка', () => {
  it('мясо и рыба с солью превращаются в вяленое', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { branch: 10, cloth: 2, grass: 5 };
    const spot = m.frChestSpots(s)[0]!;
    expect(m.frCraft(s, 'dryer', spot)).toContainEqual({ type: 'crafted', item: 'dryer' });
    expect(s.tiles[spot]).toBe('dryer');
    expect(m.frActions(s, m.frTargetAt(s, spot % 30, Math.floor(spot / 30))!)).toEqual(['open']);
    s.inv = { meat: 1, fish: 1 };
    expect(m.frDry(s, 'meat')).toContainEqual({ type: 'needMaterials' });
    s.inv.salt = 2;
    expect(m.frDry(s, 'meat')).toContainEqual({ type: 'dried' });
    expect(m.frDry(s, 'fish')).toContainEqual({ type: 'dried' });
    expect(s.inv.jerky).toBe(1);
    expect(s.inv.driedfish).toBe(1);
    expect(s.inv.salt ?? 0).toBe(0);
    expect(m.FR_EFFECTS.jerky?.food).toBeGreaterThan(m.FR_EFFECTS.steak!.food! - 10);
  });
});

describe('предметы не на постройках', () => {
  it('предмет на занятой постройкой клетке переезжает на землю', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    const spot = m.frChestSpots(s)[0]!;
    s.tiles[spot] = 'chest';
    const before = s.drops.length + 1;
    s.drops.push({ id: 9999, kind: 'branch', x: spot % 30, y: Math.floor(spot / 30) });
    m.frFixDrops(s);
    for (const d of s.drops) expect(s.tiles[d.y * 30 + d.x]).toBe('grass');
    expect(s.drops.length).toBe(before);
  });
  it('бросок предмета на костре кладёт его рядом, а не на кострище', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { branch: 1 };
    const c = m.frCenter(s);
    s.x = c.x + 0.5;
    s.y = c.y + 0.5;
    m.frThrow(s, 'branch');
    for (const d of s.drops) expect(s.tiles[d.y * 30 + d.x]).toBe('grass');
  });
});

describe('работа инструментами голодит', () => {
  it('рубка топором уменьшает сытость', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { axe: 1 };
    const t = s.tiles.findIndex((x) => x === 'tree');
    const tx = t % 30;
    const ty = Math.floor(t / 30);
    s.x = tx + 0.5;
    s.y = ty + 1.5;
    s.stats.food = 80;
    m.frDo(s, tx, ty, 'chop');
    for (let i = 0; i < 80; i++) m.frTick(s, 100);
    expect(s.stats.food).toBeLessThan(79.5);
    expect(m.FR_TOOL_FOOD).toBeGreaterThan(0);
  });
});

describe('озеро и пещера: новое', () => {
  it('сундучок при рыбалке иногда находится (ресурсы или конфета)', async () => {
    const m = await import('../src/core/forest');
    let found = 0;
    for (let seed = 1; seed <= 12 && !found; seed++) {
      const s = newForest(seed);
      m.frTravel(s, 'lake');
      s.mobs = [];
      s.inv = { rod: 1 };
      const wi = s.tiles.findIndex((k, i) => k === 'water' && [i + 1, i - 1, i + 30, i - 30].some((n) => s.tiles[n] === 'grass'));
      for (let k = 0; k < 40; k++) {
        s.busy = null;
        s.dur.rod = 99;
        s.stats.food = 100;
        s.stats.water = 100;
        s.stats.health = 100;
        const ev = [...frDo(s, wi % 30, Math.floor(wi / 30), 'fish'), ...run(s, 20_000)];
        if (ev.some((e) => e.type === 'treasure')) found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('в пещере есть летучие мыши, светящиеся грибы и озеро из нескольких клеток', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(5);
    m.frTravel(s, 'cave');
    expect(s.mobs.filter((x) => x.kind === 'bat').length).toBe(2);
    expect(s.drops.some((d) => d.kind === 'glowcap')).toBe(true);
    expect(s.tiles.filter((t) => t === 'water').length).toBeGreaterThan(2);
  });
  it('рецепт грибного супа и счётчики заданий', async () => {
    const m = await import('../src/core/forest');
    expect(m.frRecipe(['fullflask', 'glowcap'])).toBe('glowsoup');
    const s = newForest(5);
    m.frTravel(s, 'lake');
    expect(m.frCounter(s, 'visit:lake')).toBe(1);
  });
});

describe('редкий камень', () => {
  it('фонарь горит дольше факела; камень удваивает прочность и один раз', async () => {
    const m = await import('../src/core/forest');
    const s = newForest(7);
    s.inv = { crystal: 3, branch: 2, grass: 2 };
    expect(m.frCraft(s, 'lantern')).toContainEqual({ type: 'crafted', item: 'lantern' });
    expect(m.frLantern(s)).toContainEqual({ type: 'torchLit' });
    expect(s.torch).toBe(m.FR_LANTERN_MS);
    expect(s.torchMax).toBe(m.FR_LANTERN_MS);
    s.inv.axe = 1;
    expect(m.frCanUpgrade(s, 'axe')).toBe(true);
    expect(m.frUpgrade(s, 'axe')).toContainEqual({ type: 'upgraded', item: 'axe' });
    expect(m.frDurability(s, 'axe')).toBe(40);
    expect(m.frToolMax(s, 'axe')).toBe(40);
    expect(m.frCanUpgrade(s, 'axe')).toBe(false);
    expect(s.inv.crystal).toBe(1);
  });
});
