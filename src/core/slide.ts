import { nextRandom } from './rng';

// «Питомцы-блоки» (в духе Haru Cats Slide). Поле 8 клеток в ширину и 10 в высоту, строки нумеруются сверху (0) вниз (9).
// В каждой полосе лежат горизонтальные блоки длиной 1–4. Игрок сдвигает один блок влево или
// вправо по свободным клеткам; блоки, под которыми пусто, падают; заполненная полоса исчезает;
// затем появляется новая полоса. Если стопка дорастает до верхней полосы — игра окончена.
// Два режима: «Лавина» — новая полоса падает сверху; «Прилив» — новая полоса вырастает снизу и поднимает стопку.
// Раз в 10–15 полос на одном из блоков новой полосы лежит лакомство: убери этот блок — получишь его.
// Раз в 3–5 полос на блоке лежит случайный бонус:
//  · заморозка и крошки уходят в запас (кнопки под полем): заморозка на 3 хода останавливает новые полосы,
//    крошки разбивают блоки внутри поля 3×3 на одиночные клетки;
//  · молния срабатывает, когда исчезает её полоса: вместе с ней пропадают блоки, касавшиеся её сверху и снизу.
// Здесь только логика, без DOM. Всё детерминировано по seed.

export const SLIDE_COLS = 8;
export const SLIDE_ROWS = 10;
export type SlideMode = 'fall' | 'rise';
export const SLIDE_MODES: readonly SlideMode[] = ['fall', 'rise'];
/** Ключ рекордов в статистике: у «Лавины» прежний (10), чтобы не потерять старые рекорды. */
export const slideStatsKey = (mode: SlideMode): number => (mode === 'fall' ? 10 : 11);
export const SLIDE_START_ROWS = 3;
export const TREAT_EVERY_MIN = 15;
export const TREAT_EVERY_MAX = 20;
export const BLOCK_COLORS = 6;
export const BONUS_EVERY_MIN = 4;
export const BONUS_EVERY_MAX = 7;
/** Сколько ходов не падают новые полосы после заморозки. */
export const FREEZE_MOVES = 3;
/** Сторона поля, которое разбивают крошки. */
export const CRUMB_SIZE = 3;

export type Bonus = 'freeze' | 'lightning' | 'crumbs';
export const BONUSES: readonly Bonus[] = ['freeze', 'lightning', 'crumbs'];

export interface Block {
  id: number;
  row: number;
  /** Левая клетка блока. */
  col: number;
  len: number;
  color: number;
  treat: boolean;
  bonus?: Bonus;
}

/** Будущая полоса: блоки без строки. */
export type RowTemplate = ReadonlyArray<Omit<Block, 'id' | 'row'>>;

export interface SlideState {
  mode: SlideMode;
  blocks: Block[];
  /** Полоса, которая появится после следующего хода (видна у края, откуда придёт). */
  next: RowTemplate;
  rng: number;
  nextId: number;
  /** Сколько полос уже сгенерировано (для лакомств). */
  rowsMade: number;
  /** На какой по счёту полосе будет следующее лакомство. */
  treatAt: number;
  /** На какой по счёту полосе будет следующий бонус. */
  bonusAt: number;
  /** Запас бонусов: кнопки под полем. */
  freezes: number;
  crumbs: number;
  /** Сколько ходов ещё не будут падать новые полосы. */
  frozen: number;
  lines: number;
  treats: number;
  moves: number;
  over: boolean;
}

/** Кадр для анимации: расположение блоков и какие из них сейчас исчезают. */
export interface SlideFrame {
  blocks: Block[];
  clearing: number[];
  /** Новая полоса только что появилась сверху. */
  spawned: number[];
  treatsEarned: number;
  /** Сколько полос исчезло в этом кадре (соседи молнии — не полосы). */
  lines: number;
  /** Бонусы, полученные в этом кадре (в запас идут заморозка и крошки). */
  bonusesEarned: Bonus[];
  /** Блоки с молнией, которая сработала. */
  bolts: number[];
  /** Соседи молнии, исчезнувшие вместе с полосой. */
  zapped: number[];
  /** Поле, разбитое крошками: левый верхний угол. */
  crumbArea?: { row: number; col: number };
}

class Rng {
  constructor(public state: number) {}
  next(): number {
    const [v, s] = nextRandom(this.state);
    this.state = s;
    return v;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}

const copy = (blocks: readonly Block[]): Block[] => blocks.map((b) => ({ ...b }));

/** Сетка занятости: id блока или -1. */
export function occupancy(blocks: readonly Block[]): number[][] {
  const grid = Array.from({ length: SLIDE_ROWS }, () => Array<number>(SLIDE_COLS).fill(-1));
  for (const b of blocks) {
    for (let c = b.col; c < b.col + b.len; c++) {
      if (b.row >= 0 && b.row < SLIDE_ROWS) grid[b.row]![c] = b.id;
    }
  }
  return grid;
}

/** Случайная полоса: 3–5 занятых клеток, всегда хотя бы одна дырка. */
function makeRow(rng: Rng, withTreat: boolean, bonus?: Bonus): RowTemplate {
  for (;;) {
    const row: Array<Omit<Block, 'id' | 'row'>> = [];
    let c = 0;
    while (c < SLIDE_COLS) {
      if (rng.next() < 0.35) {
        c++; // дырка
        continue;
      }
      const len = Math.min(1 + rng.int(4), SLIDE_COLS - c);
      row.push({ col: c, len, color: rng.int(BLOCK_COLORS), treat: false });
      c += len;
    }
    const filled = row.reduce((s, b) => s + b.len, 0);
    if (filled < 3 || filled > 5) continue;
    if (withTreat) row[rng.int(row.length)]!.treat = true;
    if (bonus) {
      const free = row.filter((b) => !b.treat);
      if (free.length === 0) continue;
      free[rng.int(free.length)]!.bonus = bonus;
    }
    return row;
  }
}

function nextTemplate(state: SlideState, rng: Rng): RowTemplate {
  state.rowsMade++;
  const withTreat = state.rowsMade >= state.treatAt;
  if (withTreat) state.treatAt = state.rowsMade + TREAT_EVERY_MIN + rng.int(TREAT_EVERY_MAX - TREAT_EVERY_MIN + 1);
  let bonus: Bonus | undefined;
  if (state.rowsMade >= state.bonusAt) {
    bonus = BONUSES[rng.int(BONUSES.length)];
    state.bonusAt = state.rowsMade + BONUS_EVERY_MIN + rng.int(BONUS_EVERY_MAX - BONUS_EVERY_MIN + 1);
  }
  return makeRow(rng, withTreat, bonus);
}

function place(state: SlideState, template: RowTemplate, row: number): number[] {
  const ids: number[] = [];
  for (const t of template) {
    const id = state.nextId++;
    state.blocks.push({ ...t, id, row });
    ids.push(id);
  }
  return ids;
}

/** Блоки падают, пока под ними целиком пусто. true — что-то сдвинулось. */
export function settle(blocks: Block[]): boolean {
  let moved = false;
  const grid = occupancy(blocks);
  const order = [...blocks].sort((a, b) => b.row - a.row);
  for (const b of order) {
    let row = b.row;
    while (row + 1 < SLIDE_ROWS) {
      let free = true;
      for (let c = b.col; c < b.col + b.len; c++) if (grid[row + 1]![c] !== -1) free = false;
      if (!free) break;
      row++;
    }
    if (row !== b.row) {
      for (let c = b.col; c < b.col + b.len; c++) {
        grid[b.row]![c] = -1;
        grid[row]![c] = b.id;
      }
      b.row = row;
      moved = true;
    }
  }
  return moved;
}

export function fullRows(blocks: readonly Block[]): number[] {
  const grid = occupancy(blocks);
  return grid.flatMap((cells, r) => (cells.every((id) => id !== -1) ? [r] : []));
}

/** Падения и очистки до устойчивого состояния; кадры дописываются в frames. */
function resolve(state: SlideState, frames: SlideFrame[]): void {
  for (;;) {
    if (settle(state.blocks)) frames.push(frame(state));
    const rows = fullRows(state.blocks);
    if (rows.length === 0) return;
    const gone = state.blocks.filter((b) => rows.includes(b.row));
    // Молния в исчезающей полосе уносит блоки, которые её касались сверху и снизу.
    const bolts = gone.filter((b) => b.bonus === 'lightning');
    const hit = new Set(gone.map((b) => b.id));
    for (const bolt of bolts) {
      for (const other of state.blocks) {
        const touches =
          Math.abs(other.row - bolt.row) === 1 && other.col < bolt.col + bolt.len && other.col + other.len > bolt.col;
        if (touches) hit.add(other.id);
      }
    }
    const all = state.blocks.filter((b) => hit.has(b.id));
    const earned = all.filter((b) => b.treat).length;
    const bonuses = all.flatMap((b) => (b.bonus === 'freeze' || b.bonus === 'crumbs' ? [b.bonus] : []));
    state.lines += rows.length;
    state.treats += earned;
    state.freezes += bonuses.filter((b) => b === 'freeze').length;
    state.crumbs += bonuses.filter((b) => b === 'crumbs').length;
    frames.push({
      ...frame(state),
      clearing: all.map((b) => b.id),
      treatsEarned: earned,
      lines: rows.length,
      bonusesEarned: bonuses,
      bolts: bolts.map((b) => b.id),
      zapped: all.filter((b) => !gone.includes(b)).map((b) => b.id),
    });
    state.blocks = state.blocks.filter((b) => !hit.has(b.id));
  }
}

function frame(state: SlideState, spawned: number[] = []): SlideFrame {
  return { blocks: copy(state.blocks), clearing: [], spawned, treatsEarned: 0, lines: 0, bonusesEarned: [], bolts: [], zapped: [] };
}

/** Новая партия: три нижние полосы и следующая полоса наготове. */
export function newSlideGame(seed: number, mode: SlideMode = 'fall'): SlideState {
  const rng = new Rng(seed >>> 0 || 1);
  for (;;) {
    const state: SlideState = {
      mode,
      blocks: [],
      next: [],
      rng: 0,
      nextId: 1,
      rowsMade: 0,
      treatAt: TREAT_EVERY_MIN + rng.int(TREAT_EVERY_MAX - TREAT_EVERY_MIN + 1),
      bonusAt: BONUS_EVERY_MIN + rng.int(BONUS_EVERY_MAX - BONUS_EVERY_MIN + 1),
      freezes: 0,
      crumbs: 0,
      frozen: 0,
      lines: 0,
      treats: 0,
      moves: 0,
      over: false,
    };
    for (let i = 0; i < SLIDE_START_ROWS; i++) {
      // Стартовые полосы без лакомств и не считаются.
      place(state, makeRow(rng, false), SLIDE_ROWS - SLIDE_START_ROWS + i);
    }
    settle(state.blocks);
    if (fullRows(state.blocks).length > 0) continue;
    state.next = nextTemplate(state, rng);
    state.rng = rng.state;
    return state;
  }
}

/** Куда можно поставить левый край блока: [min, max]. */
export function moveRange(state: SlideState, id: number): [number, number] {
  const b = state.blocks.find((x) => x.id === id);
  if (!b) return [0, -1];
  const grid = occupancy(state.blocks);
  let min = b.col;
  while (min > 0 && grid[b.row]![min - 1] === -1) min--;
  let max = b.col;
  while (max + b.len < SLIDE_COLS && grid[b.row]![max + b.len] === -1) max++;
  return [min, max];
}

export function canMove(state: SlideState, id: number): boolean {
  const [min, max] = moveRange(state, id);
  return max > min;
}

/**
 * Ход: сдвинуть блок id так, чтобы его левый край встал в col.
 * null — ход невозможен. Иначе новое состояние и кадры анимации.
 */
export function slide(prev: SlideState, id: number, col: number): { state: SlideState; frames: SlideFrame[] } | null {
  if (prev.over) return null;
  const [min, max] = moveRange(prev, id);
  const from = prev.blocks.find((b) => b.id === id);
  if (!from || col < min || col > max || col === from.col) return null;
  const state: SlideState = { ...prev, blocks: copy(prev.blocks) };
  const rng = new Rng(state.rng);
  state.blocks.find((b) => b.id === id)!.col = col;
  state.moves++;
  const frames: SlideFrame[] = [frame(state)];
  resolve(state, frames);

  // Пока действует заморозка, новые полосы не падают (если поле не пусто).
  if (state.frozen > 0 && state.blocks.length > 0) {
    state.frozen--;
    state.rng = rng.state;
    return { state, frames };
  }

  // Новая полоса падает сверху («Лавина») или вырастает снизу («Прилив»).
  // Если стопка дошла до верха — места нет, конец игры.
  for (let guard = 0; guard < 5; guard++) {
    if (state.blocks.some((b) => b.row === 0)) {
      state.over = true;
      break;
    }
    let ids: number[];
    if (state.mode === 'rise') {
      for (const b of state.blocks) b.row--;
      ids = place(state, state.next, SLIDE_ROWS - 1);
    } else {
      ids = place(state, state.next, 0);
    }
    state.next = nextTemplate(state, rng);
    frames.push(frame(state, ids));
    resolve(state, frames);
    if (state.blocks.some((b) => b.row === 0)) {
      state.over = true;
      break;
    }
    // Поле опустело — двигать нечего, пусть появится ещё одна полоса.
    if (state.blocks.length > 0) break;
  }
  state.rng = rng.state;
  return { state, frames };
}

/** Бонус «заморозка»: следующие FREEZE_MOVES ходов новые полосы не падают. */
export function useFreeze(prev: SlideState): SlideState | null {
  if (prev.over || prev.freezes <= 0) return null;
  return { ...prev, freezes: prev.freezes - 1, frozen: prev.frozen + FREEZE_MOVES };
}

/** Поле 3×3, где крошки разобьют больше всего клеток длинных блоков (при равенстве — случайное). */
function crumbWindow(blocks: readonly Block[], rng: Rng): { row: number; col: number } | null {
  let best = 0;
  let spots: Array<{ row: number; col: number }> = [];
  for (let row = 0; row + CRUMB_SIZE <= SLIDE_ROWS; row++) {
    for (let col = 0; col + CRUMB_SIZE <= SLIDE_COLS; col++) {
      let score = 0;
      for (const b of blocks) {
        if (b.len < 2 || b.row < row || b.row >= row + CRUMB_SIZE) continue;
        score += Math.max(0, Math.min(b.col + b.len, col + CRUMB_SIZE) - Math.max(b.col, col));
      }
      if (score > best) {
        best = score;
        spots = [];
      }
      if (score === best && best > 0) spots.push({ row, col });
    }
  }
  return spots.length > 0 ? spots[rng.int(spots.length)]! : null;
}

/**
 * Бонус «крошки»: внутри поля 3×3 все блоки разбиваются на одиночные клетки.
 * Часть блока вне поля остаётся целой; лакомство или бонус остаются на левом куске.
 * null — разбивать нечего (нет длинных блоков) или нет крошек в запасе.
 */
export function useCrumbs(prev: SlideState): { state: SlideState; frames: SlideFrame[] } | null {
  if (prev.over || prev.crumbs <= 0) return null;
  const rng = new Rng(prev.rng);
  const area = crumbWindow(prev.blocks, rng);
  if (!area) return null;
  const state: SlideState = { ...prev, crumbs: prev.crumbs - 1, rng: rng.state, nextId: prev.nextId };
  const out: Block[] = [];
  for (const b of prev.blocks) {
    const inRows = b.row >= area.row && b.row < area.row + CRUMB_SIZE;
    const from = Math.max(b.col, area.col);
    const to = Math.min(b.col + b.len, area.col + CRUMB_SIZE);
    if (!inRows || b.len < 2 || to <= from) {
      out.push({ ...b });
      continue;
    }
    const pieces: Array<{ col: number; len: number }> = [];
    if (from > b.col) pieces.push({ col: b.col, len: from - b.col });
    for (let c = from; c < to; c++) pieces.push({ col: c, len: 1 });
    if (to < b.col + b.len) pieces.push({ col: to, len: b.col + b.len - to });
    pieces.forEach((p, i) => {
      if (i === 0) {
        out.push({ ...b, ...p });
        return;
      }
      const piece: Block = { ...b, ...p, id: state.nextId++, treat: false };
      delete piece.bonus;
      out.push(piece);
    });
  }
  state.blocks = out;
  const frames: SlideFrame[] = [{ ...frame(state), crumbArea: area }];
  // Осколки падают на свободные места, полные полосы исчезают.
  resolve(state, frames);
  return { state, frames };
}
