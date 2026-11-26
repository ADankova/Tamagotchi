import { nextRandom } from './rng';

// «Три в ряд с питомцами»: чистая логика поля. Рисование и анимации — в render/match3.ts.

export const M3_COLS = 7;
export const M3_ROWS = 8;
export const M3_KINDS = 6;
export const M3_MOVES = 25;
export const M3_GOAL = 4500;
/** Лакомства за победу. */
export const M3_REWARD = 3;
/** Бомба сносит всё, что ближе этого числа клеток (по прямой). */
export const M3_BOMB_RADIUS = 3;

/** row/col — бонус за четыре в ряд, bomb — за квадрат 2×2, rainbow — за пять в ряд или крест. */
export type M3Special = 'row' | 'col' | 'bomb' | 'rainbow';

export interface M3Piece {
  id: number;
  /** Вид питомца; у радужного бонуса -1: сам он ни с чем не складывается. */
  kind: number;
  special?: M3Special;
}

export type M3Cells = (M3Piece | null)[];

export interface M3State {
  cells: M3Cells;
  seed: number;
  nextId: number;
  moves: number;
  score: number;
  goal: number;
}

/** Один шаг каскада: сначала исчезают сложенные, потом всё падает и досыпается. */
export interface M3Step {
  /** Поле после исчезновения (на местах бонусов уже стоят бонусы). */
  afterClear: M3Cells;
  /** Поле после падения и досыпания. */
  afterFall: M3Cells;
  cleared: number;
  gain: number;
  /** Номер звена цепочки: 1, 2, 3… */
  chain: number;
}

export interface M3Result {
  state: M3State;
  steps: M3Step[];
  /** Поле перемешано, потому что ходов не осталось. */
  reshuffled: boolean;
}

export const m3Index = (row: number, col: number): number => row * M3_COLS + col;
const rowOf = (i: number): number => Math.floor(i / M3_COLS);
const colOf = (i: number): number => i % M3_COLS;

export function m3Adjacent(a: number, b: number): boolean {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
}

function rand(state: M3State): number {
  const [value, next] = nextRandom(state.seed);
  state.seed = next;
  return value;
}

function randomKind(state: M3State): number {
  return Math.floor(rand(state) * M3_KINDS);
}

function kindAt(cells: M3Cells, row: number, col: number): number {
  if (row < 0 || col < 0 || row >= M3_ROWS || col >= M3_COLS) return -2;
  const piece = cells[m3Index(row, col)];
  return piece && piece.kind >= 0 ? piece.kind : -2;
}

interface Run {
  cells: number[];
  dir: 'h' | 'v';
}

/** Ряды из трёх и больше и квадраты 2×2 из одного вида. */
export function findMatches(cells: M3Cells): { runs: Run[]; squares: number[][] } {
  const runs: Run[] = [];
  for (let r = 0; r < M3_ROWS; r++) {
    let c = 0;
    while (c < M3_COLS) {
      const k = kindAt(cells, r, c);
      let e = c + 1;
      while (k >= 0 && e < M3_COLS && kindAt(cells, r, e) === k) e++;
      if (k >= 0 && e - c >= 3) runs.push({ dir: 'h', cells: range(c, e).map((x) => m3Index(r, x)) });
      c = e;
    }
  }
  for (let c = 0; c < M3_COLS; c++) {
    let r = 0;
    while (r < M3_ROWS) {
      const k = kindAt(cells, r, c);
      let e = r + 1;
      while (k >= 0 && e < M3_ROWS && kindAt(cells, e, c) === k) e++;
      if (k >= 0 && e - r >= 3) runs.push({ dir: 'v', cells: range(r, e).map((y) => m3Index(y, c)) });
      r = e;
    }
  }
  const squares: number[][] = [];
  for (let r = 0; r + 1 < M3_ROWS; r++) {
    for (let c = 0; c + 1 < M3_COLS; c++) {
      const k = kindAt(cells, r, c);
      if (k >= 0 && kindAt(cells, r, c + 1) === k && kindAt(cells, r + 1, c) === k && kindAt(cells, r + 1, c + 1) === k) {
        squares.push([m3Index(r, c), m3Index(r, c + 1), m3Index(r + 1, c), m3Index(r + 1, c + 1)]);
      }
    }
  }
  return { runs, squares };
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i++) out.push(i);
  return out;
}

interface Maker {
  prio: number;
  cells: number[];
  at: number;
  special: M3Special;
}

/** Какие бонусы рождаются из сложенного: радуга главнее бомбы, бомба — линии. */
function makers(cells: M3Cells, matches: ReturnType<typeof findMatches>, hint: number[]): Maker[] {
  const list: Maker[] = [];
  const pick = (group: number[]): number => hint.find((i) => group.includes(i)) ?? group[Math.floor((group.length - 1) / 2)]!;
  const { runs, squares } = matches;
  for (const run of runs) {
    if (run.cells.length >= 5) list.push({ prio: 3, cells: run.cells, at: pick(run.cells), special: 'rainbow' });
  }
  // Крест, «Т» и «Г»: горизонтальный и вертикальный ряд делят клетку.
  for (const h of runs.filter((x) => x.dir === 'h')) {
    for (const v of runs.filter((x) => x.dir === 'v')) {
      const shared = h.cells.find((i) => v.cells.includes(i));
      if (shared !== undefined && cells[shared]?.kind === cells[h.cells[0]!]?.kind) {
        list.push({ prio: 3, cells: [...new Set([...h.cells, ...v.cells])], at: shared, special: 'rainbow' });
      }
    }
  }
  for (const sq of squares) list.push({ prio: 2, cells: sq, at: pick(sq), special: 'bomb' });
  for (const run of runs) {
    if (run.cells.length === 4) list.push({ prio: 1, cells: run.cells, at: pick(run.cells), special: run.dir === 'h' ? 'row' : 'col' });
  }
  list.sort((a, b) => b.prio - a.prio);
  const taken = new Set<number>();
  const chosen: Maker[] = [];
  for (const m of list) {
    if (m.cells.some((i) => taken.has(i))) continue;
    m.cells.forEach((i) => taken.add(i));
    chosen.push(m);
  }
  return chosen;
}

/** Клетки, которые сносит бонус, стоящий в клетке index. */
function reach(piece: M3Piece, index: number): number[] {
  const row = rowOf(index);
  const col = colOf(index);
  if (piece.special === 'row') return range(0, M3_COLS).map((c) => m3Index(row, c));
  if (piece.special === 'col') return range(0, M3_ROWS).map((r) => m3Index(r, col));
  if (piece.special === 'bomb') {
    const out: number[] = [];
    for (let r = 0; r < M3_ROWS; r++) {
      for (let c = 0; c < M3_COLS; c++) {
        if ((r - row) ** 2 + (c - col) ** 2 <= M3_BOMB_RADIUS ** 2) out.push(m3Index(r, c));
      }
    }
    return out;
  }
  return [];
}

function fall(state: M3State, cells: M3Cells): M3Cells {
  const out: M3Cells = new Array<M3Piece | null>(cells.length).fill(null);
  for (let c = 0; c < M3_COLS; c++) {
    let write = M3_ROWS - 1;
    for (let r = M3_ROWS - 1; r >= 0; r--) {
      const piece = cells[m3Index(r, c)];
      if (piece) out[m3Index(write--, c)] = piece;
    }
    for (let r = write; r >= 0; r--) out[m3Index(r, c)] = { id: state.nextId++, kind: randomKind(state) };
  }
  return out;
}

/** Есть ли хоть один ход: бонус на поле или обмен, после которого что-то сложится. */
export function hasMoves(cells: M3Cells): boolean {
  if (cells.some((p) => p && p.special && p.special !== 'rainbow')) return true;
  for (let i = 0; i < cells.length; i++) {
    for (const j of [i + 1, i + M3_COLS]) {
      if (j >= cells.length || !m3Adjacent(i, j)) continue;
      if (swapIsValid(cells, i, j)) return true;
    }
  }
  return false;
}

function swapped(cells: M3Cells, a: number, b: number): M3Cells {
  const next = cells.slice();
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
}

function swapIsValid(cells: M3Cells, a: number, b: number): boolean {
  const pa = cells[a];
  const pb = cells[b];
  if (!pa || !pb) return false;
  if (pa.special === 'rainbow' || pb.special === 'rainbow' || pa.special || pb.special) return true;
  const m = findMatches(swapped(cells, a, b));
  return m.runs.length > 0 || m.squares.length > 0;
}

/** Можно ли поменять эти две клетки местами. */
export function m3CanSwap(state: M3State, a: number, b: number): boolean {
  return state.moves > 0 && m3Adjacent(a, b) && swapIsValid(state.cells, a, b);
}

function cloneState(state: M3State): M3State {
  return { ...state, cells: state.cells.slice() };
}

/** Всё сложенное и сорванное бонусами исчезает; потом падение; и так, пока есть что убирать. */
function cascade(state: M3State, forced: Set<number>, hint: number[]): M3Step[] {
  const steps: M3Step[] = [];
  let chain = 0;
  let pending = forced;
  let spot = hint;
  while (true) {
    const matches = findMatches(state.cells);
    if (matches.runs.length === 0 && matches.squares.length === 0 && pending.size === 0) break;
    chain++;
    const clear = new Set<number>(pending);
    for (const run of matches.runs) run.cells.forEach((i) => clear.add(i));
    for (const sq of matches.squares) sq.forEach((i) => clear.add(i));
    const born = makers(state.cells, matches, spot);
    const spared = new Set(born.map((m) => m.at));
    spared.forEach((i) => clear.delete(i));
    // Бонусы, попавшие под удар, взрываются сами и тянут за собой соседей.
    const queue = [...clear];
    const done = new Set<number>();
    while (queue.length > 0) {
      const i = queue.pop()!;
      if (done.has(i)) continue;
      done.add(i);
      const piece = state.cells[i];
      if (!piece?.special || piece.special === 'rainbow') continue;
      for (const j of reach(piece, i)) {
        if (spared.has(j)) continue;
        clear.add(j);
        queue.push(j);
      }
    }
    const afterClear = state.cells.slice();
    let removed = 0;
    for (const i of clear) {
      if (afterClear[i]) removed++;
      afterClear[i] = null;
    }
    for (const m of born) {
      const base = state.cells[m.at]!;
      afterClear[m.at] = { id: base.id, kind: m.special === 'rainbow' ? -1 : base.kind, special: m.special };
    }
    const gain = removed * 10 * chain;
    state.score += gain;
    const afterFall = fall(state, afterClear);
    state.cells = afterFall;
    steps.push({ afterClear, afterFall, cleared: removed, gain, chain });
    pending = new Set();
    spot = [];
  }
  return steps;
}

/** Если ходов не осталось — перемешиваем питомцев на поле, пока не появится ход. */
function ensurePlayable(state: M3State): boolean {
  let again = false;
  for (let tries = 0; tries < 50 && (!hasMoves(state.cells) || (() => { const m = findMatches(state.cells); return m.runs.length + m.squares.length > 0; })()); tries++) {
    const pieces = state.cells.filter((p): p is M3Piece => p !== null);
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(rand(state) * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j]!, pieces[i]!];
    }
    state.cells = pieces;
    again = true;
  }
  return again;
}

/** Поменять две клетки. Возвращает null, если ход не получился (ничего не складывается). */
export function m3Swap(state: M3State, a: number, b: number): M3Result | null {
  if (!m3CanSwap(state, a, b)) return null;
  const next = cloneState(state);
  next.cells = swapped(next.cells, a, b);
  next.moves--;
  const pa = next.cells[b]!; // бывший a
  const pb = next.cells[a]!; // бывший b
  const forced = new Set<number>();
  const rainbowA = pa.special === 'rainbow';
  const rainbowB = pb.special === 'rainbow';
  if (rainbowA || rainbowB) {
    const wholeBoard = rainbowA && rainbowB;
    const target = rainbowA ? pb.kind : pa.kind;
    next.cells.forEach((p, i) => {
      if (p && (wholeBoard || p.kind === target)) forced.add(i);
    });
    forced.add(a);
    forced.add(b);
  } else {
    if (pa.special) forced.add(b);
    if (pb.special) forced.add(a);
  }
  const steps = cascade(next, forced, [a, b]);
  return finish(next, steps);
}

/** Нажать на бонус-линию или бомбу: сработает на месте. */
export function m3Tap(state: M3State, index: number): M3Result | null {
  const piece = state.cells[index];
  if (state.moves <= 0 || !piece || !piece.special || piece.special === 'rainbow') return null;
  const next = cloneState(state);
  next.moves--;
  const steps = cascade(next, new Set([index]), [index]);
  return finish(next, steps);
}

function finish(next: M3State, steps: M3Step[]): M3Result {
  const reshuffled = next.score < next.goal && next.moves > 0 && ensurePlayable(next);
  return { state: next, steps, reshuffled };
}

export type M3Outcome = 'playing' | 'won' | 'lost';

export function m3Outcome(state: M3State): M3Outcome {
  if (state.score >= state.goal) return 'won';
  return state.moves <= 0 ? 'lost' : 'playing';
}

/** Новая партия: поле без готовых троек и квадратов, но с ходом. */
export function newM3(seed: number, goal = M3_GOAL, moves = M3_MOVES): M3State {
  const state: M3State = { cells: new Array<M3Piece | null>(M3_ROWS * M3_COLS).fill(null), seed, nextId: 1, moves, score: 0, goal };
  for (let r = 0; r < M3_ROWS; r++) {
    for (let c = 0; c < M3_COLS; c++) {
      let kind = randomKind(state);
      for (let tries = 0; tries < M3_KINDS; tries++) {
        const bad =
          (c >= 2 && kindAt(state.cells, r, c - 1) === kind && kindAt(state.cells, r, c - 2) === kind) ||
          (r >= 2 && kindAt(state.cells, r - 1, c) === kind && kindAt(state.cells, r - 2, c) === kind) ||
          (r >= 1 && c >= 1 && kindAt(state.cells, r - 1, c) === kind && kindAt(state.cells, r, c - 1) === kind && kindAt(state.cells, r - 1, c - 1) === kind);
        if (!bad) break;
        kind = (kind + 1) % M3_KINDS;
      }
      state.cells[m3Index(r, c)] = { id: state.nextId++, kind };
    }
  }
  ensurePlayable(state);
  return state;
}
