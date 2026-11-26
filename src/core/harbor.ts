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
export const HARBOR_COLS = 3;
export const HARBOR_ROWS = 4;
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
}

export interface HarborShip {
  kind: number;
  count: number;
}

export interface HarborState {
  rng: number;
  /** Места на воде: индекс = ряд * HARBOR_COLS + столбец, ряд 0 — самый верхний. */
  field: (HarborIsland | null)[];
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
    islands.push({ id: islands.length + 1, pets: pets.slice(at, at + size) });
    at += size;
  }
  const field: (HarborIsland | null)[] = Array.from({ length: HARBOR_COLS * HARBOR_ROWS }, () => null);
  // Первые три ряда уже на воде, нижний ряд свободен — туда будут всплывать новые.
  for (let i = 0; i < HARBOR_COLS * (HARBOR_ROWS - 1); i++) field[i] = islands.shift() ?? null;
  const state: HarborState = {
    rng,
    field,
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
  return settle(state);
}

/** Питомцы каждого вида на воде. */
export function fieldCounts(state: HarborState): number[] {
  const counts = Array.from({ length: HARBOR_KINDS }, () => 0);
  for (const island of state.field) island?.pets.forEach((p) => counts[p.kind]!++);
  return counts;
}

/** Есть ли питомцы на воде, которых можно отправить сразу (для них есть корабль). */
export function hasMatchOnField(state: HarborState): boolean {
  const open = new Set(state.ships.filter((s): s is HarborShip => s !== null).map((s) => s.kind));
  return state.field.some((island) => island?.pets.some((p) => open.has(p.kind)));
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
  state.stuck = !state.won && isStuck(state);
  return state;
}

function isStuck(state: HarborState): boolean {
  if (state.pier.length < HARBOR_PIER) return false;
  if (hasMatchOnField(state)) return false;
  // Пристань полна и сдать нечего: новые острова — последняя надежда, но только если им есть где всплыть.
  return state.deck.length === 0 || state.field.every((island) => island !== null);
}

/** Нажать питомца. null — нельзя: пристань полна, а корабля для него нет. */
export function tapHarborPet(state: HarborState, islandId: number, petId: number): HarborState | null {
  if (state.won || state.stuck) return null;
  const at = state.field.findIndex((island) => island?.id === islandId);
  if (at < 0) return null;
  const island = state.field[at]!;
  const pet = island.pets.find((p) => p.id === petId);
  if (!pet) return null;
  const ship = state.ships.findIndex((s) => s !== null && s.kind === pet.kind && s.count < HARBOR_NEED);
  if (ship < 0 && state.pier.length >= HARBOR_PIER) return null;
  const field = state.field.slice();
  const rest = island.pets.filter((p) => p.id !== petId);
  field[at] = rest.length > 0 ? { ...island, pets: rest } : null;
  const ships = state.ships.slice();
  let pier = state.pier;
  if (ship >= 0) {
    const s = ships[ship]!;
    ships[ship] = { ...s, count: s.count + 1 };
  } else {
    pier = [...state.pier, pet];
  }
  return settle({ ...state, field, ships, pier, moves: state.moves + 1 });
}

/** Один шаг воды: острова поднимаются на свободное место выше, снизу всплывает новый. */
export function advanceHarbor(state: HarborState): HarborState {
  if (state.won || state.stuck) return state;
  const field = state.field.slice();
  let moved = false;
  for (let col = 0; col < HARBOR_COLS; col++) {
    for (let row = 1; row < HARBOR_ROWS; row++) {
      const here = row * HARBOR_COLS + col;
      const above = (row - 1) * HARBOR_COLS + col;
      if (field[here] && !field[above]) {
        field[above] = field[here]!;
        field[here] = null;
        moved = true;
      }
    }
  }
  let deck = state.deck;
  let rng = state.rng;
  const free: number[] = [];
  const bottom = (HARBOR_ROWS - 1) * HARBOR_COLS;
  for (let col = 0; col < HARBOR_COLS; col++) if (!field[bottom + col]) free.push(bottom + col);
  if (free.length > 0 && deck.length > 0) {
    const [i, next] = pick(rng, free.length);
    rng = next;
    field[free[i]!] = deck[0]!;
    deck = deck.slice(1);
    moved = true;
  }
  if (!moved) return state.stuck ? state : settle(state);
  return settle({ ...state, field, deck, rng });
}
