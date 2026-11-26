import { nextRandom } from './rng';

// «Бухта питомцев»: снизу всплывают острова с питомцами. Нажатый питомец плывёт на корабль своего
// вида, а если такого корабля нет — ждёт на пристани. На корабль нужно собрать трёх одинаковых.

/** Видов питомцев в партии. */
export const HARBOR_KINDS = 8;
/** Сколько троек каждого вида нужно собрать. */
export const HARBOR_TRIPLES = 3;
export const HARBOR_SHIPS = 3;
export const HARBOR_PIER = 5;
export const HARBOR_NEED = 3;
/** Поле: ширина 1, высота HARBOR_H. Острова — круги, радиус зависит от числа питомцев на острове. */
export const HARBOR_H = 1.25;
export const HARBOR_RADIUS = [0.11, 0.15, 0.18, 0.205] as const;
/** На сколько остров поднимается за один шаг воды. */
export const HARBOR_RISE = 0.06;
const GAP = 0.002;
/** Награда за победу, лакомств. */
export const HARBOR_REWARD = 3;
/** Шансы острова на 1, 2, 3 и 4 питомцев, в процентах. */
export const HARBOR_ISLAND_WEIGHTS = [5, 40, 40, 15] as const;

export type HarborBonus = 'net' | 'clear' | 'shuffle';
export const HARBOR_BONUSES: readonly HarborBonus[] = ['net', 'clear', 'shuffle'];
/** Шанс острова нести бонус, в процентах. */
export const HARBOR_BONUS_CHANCE = 14;

export interface HarborPet {
  id: number;
  kind: number;
  /** Место питомца на острове: не меняется, пока остров не перемешают. */
  spot: number;
}

export interface HarborIsland {
  id: number;
  pets: HarborPet[];
  /** Сколько питомцев было на острове вначале: от этого зависит размер, и он не уменьшается. */
  size: number;
  /** Бонус, который достанется, когда остров опустеет. */
  bonus: HarborBonus | null;
  /** Центр острова-пузыря. */
  x: number;
  y: number;
}

export interface HarborShip {
  kind: number;
  count: number;
}

export interface HarborState {
  rng: number;
  /** Острова на воде. */
  field: HarborIsland[];
  /** Острова, которые ещё не всплыли. */
  deck: HarborIsland[];
  ships: (HarborShip | null)[];
  pier: HarborPet[];
  /** Общий блок рядом с пристанью. */
  stash: HarborPet[];
  /** Сколько бонусов собрано. */
  bonuses: Record<HarborBonus, number>;
  delivered: number;
  total: number;
  /** Доставлено питомцев каждого вида. */
  deliveredByKind: number[];
  moves: number;
  won: boolean;
  stuck: boolean;
}

function pick(rng: number, n: number): [number, number] {
  const [r, next] = nextRandom(rng);
  return [Math.floor(r * n), next];
}

function islandSize(rng: number): [number, number] {
  const [r, next] = nextRandom(rng);
  const total = HARBOR_ISLAND_WEIGHTS.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < HARBOR_ISLAND_WEIGHTS.length; i++) {
    x -= HARBOR_ISLAND_WEIGHTS[i]!;
    if (x < 0) return [i + 1, next];
  }
  return [HARBOR_ISLAND_WEIGHTS.length, next];
}

export function newHarbor(seed: number): HarborState {
  let rng = seed | 0;
  const pets: HarborPet[] = [];
  let id = 1;
  for (let kind = 0; kind < HARBOR_KINDS; kind++) {
    for (let i = 0; i < HARBOR_TRIPLES * HARBOR_NEED; i++) pets.push({ id: id++, kind, spot: 0 });
  }
  for (let i = pets.length - 1; i > 0; i--) {
    const [j, next] = pick(rng, i + 1);
    rng = next;
    [pets[i], pets[j]] = [pets[j]!, pets[i]!];
  }
  const islands: HarborIsland[] = [];
  let at = 0;
  while (at < pets.length) {
    const [size, next] = islandSize(rng);
    rng = next;
    const group = pets.slice(at, at + size).map((p, spot) => ({ ...p, spot }));
    const [chance, afterChance] = nextRandom(rng);
    const [which, afterWhich] = pick(afterChance, HARBOR_BONUSES.length);
    rng = afterWhich;
    islands.push({
      id: islands.length + 1,
      pets: group,
      size: group.length,
      bonus: chance * 100 < HARBOR_BONUS_CHANCE ? HARBOR_BONUSES[which]! : null,
      x: 0,
      y: 0,
    });
    at += size;
  }
  const state: HarborState = {
    rng,
    field: [],
    deck: islands,
    ships: Array.from({ length: HARBOR_SHIPS }, () => null),
    pier: [],
    stash: [],
    bonuses: { net: 0, clear: 0, shuffle: 0 },
    delivered: 0,
    total: pets.length,
    deliveredByKind: Array.from({ length: HARBOR_KINDS }, () => 0),
    moves: 0,
    won: false,
    stuck: false,
  };
  // Сразу на воде уже лежит пара рядов островов: прокручиваем воду, пока они не соберутся.
  let water = state;
  for (let i = 0; i < 400 && water.field.length < 9 && (water.deck.length > 0 || water.field.length === 0); i++) {
    water = moveWater(water);
  }
  return settle(water);
}

export function islandRadius(island: { size: number }): number {
  return HARBOR_RADIUS[Math.min(Math.max(island.size, 1), 4) - 1] ?? HARBOR_RADIUS[0];
}

function fits(field: HarborIsland[], x: number, y: number, r: number, skip?: number): boolean {
  if (x - r < 0 || x + r > 1 || y - r < 0) return false;
  return field.every((o) => o.id === skip || Math.hypot(o.x - x, o.y - y) >= r + islandRadius(o) + GAP);
}

/** Питомцы каждого вида на воде. */
export function fieldCounts(state: HarborState): number[] {
  const counts = Array.from({ length: HARBOR_KINDS }, () => 0);
  for (const island of state.field) island.pets.forEach((p) => counts[p.kind]!++);
  return counts;
}

/** Есть ли питомцы на воде, которых можно отправить сразу (для них есть корабль). */
export function hasMatchOnField(state: HarborState): boolean {
  const open = new Set(state.ships.filter((s): s is HarborShip => s !== null).map((s) => s.kind));
  return state.field.some((island) => island.pets.some((p) => open.has(p.kind)));
}

/** Корабли сдают питомцев, освободившиеся места занимают новые корабли, пристань пересаживается. */
function settle(input: HarborState): HarborState {
  let state: HarborState = {
    ...input,
    ships: input.ships.slice(),
    pier: input.pier.slice(),
    stash: input.stash.slice(),
    bonuses: { ...input.bonuses },
    deliveredByKind: input.deliveredByKind.slice(),
  };
  for (let guard = 0; guard < 40; guard++) {
    let changed = false;
    state.ships.forEach((ship, i) => {
      if (ship && ship.count >= HARBOR_NEED) {
        state.delivered += HARBOR_NEED;
        state.deliveredByKind[ship.kind]! += HARBOR_NEED;
        state.ships[i] = null;
        changed = true;
      }
    });
    const taken = new Set(state.ships.filter((s): s is HarborShip => s !== null).map((s) => s.kind));
    const counts = fieldCounts(state);
    for (let i = 0; i < state.ships.length; i++) {
      if (state.ships[i]) continue;
      let best = -1;
      let bestScore = -1;
      let rng = state.rng;
      for (let kind = 0; kind < HARBOR_KINDS; kind++) {
        if (taken.has(kind)) continue;
        if (state.deliveredByKind[kind]! >= HARBOR_TRIPLES * HARBOR_NEED) continue;
        const [jitter, next] = nextRandom(rng);
        rng = next;
        const score = (counts[kind]! > 0 ? 1 : 0) + jitter;
        if (score > bestScore) {
          bestScore = score;
          best = kind;
        }
      }
      state.rng = rng;
      if (best < 0) continue;
      taken.add(best);
      const waiting = [...state.pier, ...state.stash].filter((p) => p.kind === best).slice(0, HARBOR_NEED);
      state.pier = state.pier.filter((p) => !waiting.includes(p));
      state.stash = state.stash.filter((p) => !waiting.includes(p));
      state.ships[i] = { kind: best, count: waiting.length };
      changed = true;
    }
    if (!changed) break;
  }
  state.won = state.delivered >= state.total;
  return state;
}

/** Отправить питомца с острова: на корабль своего вида (если ему есть место) или на пристань. */
function sendPet(state: HarborState, island: HarborIsland, pet: HarborPet, toShip: number): HarborState {
  const rest = island.pets.filter((p) => p.id !== pet.id);
  const field = state.field.flatMap((i) => (i.id !== island.id ? [i] : rest.length > 0 ? [{ ...i, pets: rest }] : []));
  const ships = state.ships.slice();
  let pier = state.pier;
  if (toShip >= 0) {
    const s = ships[toShip]!;
    ships[toShip] = { ...s, count: s.count + 1 };
  } else {
    pier = [...state.pier, pet];
  }
  const bonuses = { ...state.bonuses };
  // Опустевший остров отдаёт свой бонус.
  if (rest.length === 0 && island.bonus) bonuses[island.bonus]++;
  return settle({ ...state, field, ships, pier, bonuses, stuck: false, moves: state.moves + 1 });
}

/** Нажать питомца. null — нельзя: пристань полна, а корабля для него нет. */
export function tapHarborPet(state: HarborState, islandId: number, petId: number): HarborState | null {
  if (state.won || state.stuck) return null;
  const island = state.field.find((i) => i.id === islandId);
  if (!island) return null;
  const pet = island.pets.find((p) => p.id === petId);
  if (!pet) return null;
  const ship = state.ships.findIndex((s) => s !== null && s.kind === pet.kind && s.count < HARBOR_NEED);
  if (ship < 0 && state.pier.length >= HARBOR_PIER) return null;
  return sendPet(state, island, pet, ship);
}

export interface NetCatch {
  state: HarborState;
  islandId: number;
  petId: number;
}

/**
 * «Сачок»: выуживает питомца того вида, которого на кораблях уже больше всего,
 * и отправляет его на корабль. null — бонуса нет или такого питомца на воде нет.
 */
export function useNet(state: HarborState): NetCatch | null {
  if (state.won || state.stuck || state.bonuses.net <= 0) return null;
  const onField = new Set<number>();
  state.field.forEach((i) => i.pets.forEach((p) => onField.add(p.kind)));
  const ships = state.ships
    .map((ship, index) => ({ ship, index }))
    .filter((x): x is { ship: HarborShip; index: number } => x.ship !== null && x.ship.count < HARBOR_NEED && onField.has(x.ship.kind));
  if (ships.length === 0) return null;
  const top = Math.max(...ships.map((x) => x.ship.count));
  const best = ships.filter((x) => x.ship.count === top);
  const [pickIndex, rng] = pick(state.rng, best.length);
  const target = best[pickIndex]!;
  const island = state.field.find((i) => i.pets.some((p) => p.kind === target.ship.kind))!;
  const pet = island.pets.find((p) => p.kind === target.ship.kind)!;
  const next = sendPet({ ...state, rng, bonuses: { ...state.bonuses, net: state.bonuses.net - 1 } }, island, pet, target.index);
  return { state: next, islandId: island.id, petId: pet.id };
}

/** «Удаление»: питомцы с пристани уходят в общий блок рядом (там они лежат кучкой). null — нечего убирать. */
export function useClear(state: HarborState): HarborState | null {
  if (state.won || state.stuck || state.bonuses.clear <= 0) return null;
  if (state.pier.length === 0) return null;
  const moved = state.pier.slice();
  return settle({
    ...state,
    pier: state.pier.slice(moved.length),
    stash: [...state.stash, ...moved],
    bonuses: { ...state.bonuses, clear: state.bonuses.clear - 1 },
    moves: state.moves + 1,
  });
}

/** «Обновление»: питомцы на островах перемешиваются и садятся по-новому. */
export function useShuffle(state: HarborState): HarborState | null {
  if (state.won || state.stuck || state.bonuses.shuffle <= 0) return null;
  let rng = state.rng;
  const pets = state.field.flatMap((i) => i.pets);
  if (pets.length < 2) return null;
  const kinds = pets.map((p) => p.kind);
  for (let i = kinds.length - 1; i > 0; i--) {
    const [j, next] = pick(rng, i + 1);
    rng = next;
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  let at = 0;
  const field = state.field.map((island) => ({
    ...island,
    pets: island.pets.map((p) => ({ ...p, kind: kinds[at++]! })),
  }));
  return settle({ ...state, rng, field, bonuses: { ...state.bonuses, shuffle: state.bonuses.shuffle - 1 }, moves: state.moves + 1 });
}

/** Вода движется: острова поднимаются, снизу всплывает новый. Возвращает то же состояние, если ничего не изменилось. */
function moveWater(state: HarborState): HarborState {
  let field = state.field.slice();
  let moved = false;
  const SUB = 3;
  const step = HARBOR_RISE / SUB;
  // Углы от вертикали, в градусах: сначала строго вверх, потом скатывание вбок.
  const ANGLES = [0, 15, 30, 45, 60, 75, 88];
  for (let sub = 0; sub < SUB; sub++) {
    const order = field.slice().sort((a, b) => a.y - b.y);
    for (const island of order) {
      const cur = field.find((i) => i.id === island.id)!;
      const r = islandRadius(cur);
      let done = false;
      // Вверх, а если мешает сосед — вверх-вбок: остров скатывается по соседу в свободную щель.
      for (const angle of ANGLES) {
        const sides = angle === 0 ? [0] : cur.id % 2 === 0 ? [-1, 1] : [1, -1];
        for (const side of sides) {
          const rad = (angle * Math.PI) / 180;
          const nx = cur.x + side * Math.sin(rad) * step * 1.6;
          const ny = cur.y - Math.cos(rad) * step * 1.6;
          if (ny < cur.y - 1e-6 && fits(field, nx, ny, r, cur.id)) {
            field = field.map((i) => (i.id === cur.id ? { ...i, x: nx, y: ny } : i));
            moved = true;
            done = true;
            break;
          }
        }
        if (done) break;
      }
      if (!done) {
        // Подняться нельзя: прижимаемся вбок к ближайшему препятствию (стенке или соседу), чтобы не оставалось щелей.
        const room = (dir: number): number => {
          let d = 0;
          while (d < 0.3 && fits(field, cur.x + dir * (d + 0.005), cur.y, r, cur.id)) d += 0.005;
          return d;
        };
        const left = room(-1);
        const right = room(1);
        const dir = left <= right ? -1 : 1;
        const gap = Math.min(left, right);
        if (gap >= 0.005) {
          const slide = Math.min(gap, 0.03);
          field = field.map((i) => (i.id === cur.id ? { ...i, x: cur.x + dir * slide } : i));
          moved = true;
        }
      }
    }
  }
  let deck = state.deck;
  let rng = state.rng;
  const next = deck[0];
  if (next) {
    const r = islandRadius(next);
    const y = HARBOR_H + r + 0.02;
    for (let attempt = 0; attempt < 14; attempt++) {
      const [u, nr] = nextRandom(rng);
      rng = nr;
      const x = r + u * (1 - 2 * r);
      if (fits(field, x, y, r)) {
        field = [...field, { ...next, x, y }];
        deck = deck.slice(1);
        moved = true;
        break;
      }
    }
  }
  if (!moved) return state;
  return { ...state, field, deck, rng };
}

/** Один шаг воды; если вода встала, а пристань полна и отправить некого, партия проиграна. */
export function advanceHarbor(state: HarborState): HarborState {
  if (state.won || state.stuck) return state;
  const next = moveWater(state);
  if (next !== state) return settle(next);
  // Спасти может «Обновление» или «Удаление».
  const rescue = state.bonuses.shuffle > 0 || state.bonuses.clear > 0;
  const lost = state.pier.length >= HARBOR_PIER && !hasMatchOnField(state) && !rescue;
  return lost ? { ...state, stuck: true } : state;
}
