import { nextRandom } from './rng';

// «Бухта питомцев»: снизу всплывают острова с питомцами. Нажатый питомец плывёт на корабль своего
// вида, а если такого корабля нет — ждёт на пристани. На корабль нужно собрать трёх одинаковых.

/** Видов питомцев в партии. */
export const HARBOR_KINDS = 9;
/** Сколько троек каждого вида нужно собрать. */
export const HARBOR_TRIPLES = 3;
export const HARBOR_SHIPS = 3;
export const HARBOR_PIER = 5;
export const HARBOR_NEED = 3;
/** Поле: ширина 1, высота HARBOR_H. Острова — круги, радиус зависит от числа питомцев на острове. */
export const HARBOR_H = 1.25;
export const HARBOR_RADIUS = [0.115, 0.16, 0.19, 0.215] as const;
/** На сколько остров поднимается за один шаг воды. */
export const HARBOR_RISE = 0.06;
const GAP = 0.002;
/** Награда за победу, лакомств. */
export const HARBOR_REWARD = 3;
/** Шансы острова на 1, 2, 3 и 4 питомцев, в процентах. */
export const HARBOR_ISLAND_WEIGHTS = [5, 40, 40, 15] as const;

export interface HarborPet {
  id: number;
  kind: number;
}

export interface HarborIsland {
  id: number;
  pets: HarborPet[];
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
    for (let i = 0; i < HARBOR_TRIPLES * HARBOR_NEED; i++) pets.push({ id: id++, kind });
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
    islands.push({ id: islands.length + 1, pets: pets.slice(at, at + size), x: 0, y: 0 });
    at += size;
  }
  const state: HarborState = {
    rng,
    field: [],
    deck: islands,
    ships: Array.from({ length: HARBOR_SHIPS }, () => null),
    pier: [],
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

export function islandRadius(island: { pets: unknown[] }): number {
  return HARBOR_RADIUS[Math.min(island.pets.length, 4) - 1] ?? HARBOR_RADIUS[0];
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
      const waiting = state.pier.filter((p) => p.kind === best).slice(0, HARBOR_NEED);
      state.pier = state.pier.filter((p) => !waiting.includes(p));
      state.ships[i] = { kind: best, count: waiting.length };
      changed = true;
    }
    if (!changed) break;
  }
  state.won = state.delivered >= state.total;
  return state;
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
  const rest = island.pets.filter((p) => p.id !== petId);
  // Остров уменьшается вместе с числом питомцев, поэтому он остаётся на месте и просто становится меньше.
  const field = state.field.flatMap((i) => (i.id !== islandId ? [i] : rest.length > 0 ? [{ ...i, pets: rest }] : []));
  const ships = state.ships.slice();
  let pier = state.pier;
  if (ship >= 0) {
    const s = ships[ship]!;
    ships[ship] = { ...s, count: s.count + 1 };
  } else {
    pier = [...state.pier, pet];
  }
  return settle({ ...state, field, ships, pier, stuck: false, moves: state.moves + 1 });
}

/** Вода движется: острова поднимаются, снизу всплывает новый. Возвращает то же состояние, если ничего не изменилось. */
function moveWater(state: HarborState): HarborState {
  const order = state.field.slice().sort((a, b) => a.y - b.y);
  let field = state.field.slice();
  let moved = false;
  for (const island of order) {
    const cur = field.find((i) => i.id === island.id)!;
    const r = islandRadius(cur);
    // Сначала вверх, потом вверх-вбок (скатывается с соседа), в конце — вбок к стенке, чтобы не оставалось щелей.
    const tries: Array<[number, number]> = [
      [0, HARBOR_RISE],
      [-0.03, HARBOR_RISE * 0.8],
      [0.03, HARBOR_RISE * 0.8],
      [-0.06, HARBOR_RISE * 0.6],
      [0.06, HARBOR_RISE * 0.6],
      [-0.1, HARBOR_RISE * 0.4],
      [0.1, HARBOR_RISE * 0.4],
    ];
    let done = false;
    for (const [dx, dy] of tries) {
      const nx = cur.x + dx;
      const ny = cur.y - dy;
      if (fits(field, nx, ny, r, cur.id)) {
        field = field.map((i) => (i.id === cur.id ? { ...i, x: nx, y: ny } : i));
        moved = true;
        done = true;
        break;
      }
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
        const step = Math.min(gap, 0.04);
        field = field.map((i) => (i.id === cur.id ? { ...i, x: cur.x + dir * step } : i));
        moved = true;
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
  const lost = state.pier.length >= HARBOR_PIER && !hasMatchOnField(state);
  return lost ? { ...state, stuck: true } : state;
}
