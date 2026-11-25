import { nextRandom } from './rng';

// «Питомцы-блоки» (в духе Haru Cats Slide). Поле 10×10, строки нумеруются сверху (0) вниз (9).
// В каждой полосе лежат горизонтальные блоки длиной 1–4. Игрок сдвигает один блок влево или
// вправо по свободным клеткам; блоки, под которыми пусто, падают; заполненная полоса исчезает;
// затем сверху падает новая полоса. Если стопка дорастает до верхней полосы — игра окончена.
// Раз в 15–20 полос на одном из блоков новой полосы лежит лакомство: убери этот блок — получишь его.
// Здесь только логика, без DOM. Всё детерминировано по seed.

export const SLIDE_SIZE = 10;
export const SLIDE_START_ROWS = 3;
export const TREAT_EVERY_MIN = 15;
export const TREAT_EVERY_MAX = 20;
export const BLOCK_COLORS = 6;

export interface Block {
  id: number;
  row: number;
  /** Левая клетка блока. */
  col: number;
  len: number;
  color: number;
  treat: boolean;
}

/** Будущая полоса: блоки без строки. */
export type RowTemplate = ReadonlyArray<Omit<Block, 'id' | 'row'>>;

export interface SlideState {
  blocks: Block[];
  /** Полоса, которая упадёт после следующего хода (видна над полем). */
  next: RowTemplate;
  rng: number;
  nextId: number;
  /** Сколько полос уже сгенерировано (для лакомств). */
  rowsMade: number;
  /** На какой по счёту полосе будет следующее лакомство. */
  treatAt: number;
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
  const grid = Array.from({ length: SLIDE_SIZE }, () => Array<number>(SLIDE_SIZE).fill(-1));
  for (const b of blocks) {
    for (let c = b.col; c < b.col + b.len; c++) {
      if (b.row >= 0 && b.row < SLIDE_SIZE) grid[b.row]![c] = b.id;
    }
  }
  return grid;
}

/** Случайная полоса: 3–6 занятых клеток, всегда хотя бы одна дырка. */
function makeRow(rng: Rng, withTreat: boolean): RowTemplate {
  for (;;) {
    const row: Array<Omit<Block, 'id' | 'row'>> = [];
    let c = 0;
    while (c < SLIDE_SIZE) {
      if (rng.next() < 0.35) {
        c++; // дырка
        continue;
      }
      const len = Math.min(1 + rng.int(4), SLIDE_SIZE - c);
      row.push({ col: c, len, color: rng.int(BLOCK_COLORS), treat: false });
      c += len;
    }
    const filled = row.reduce((s, b) => s + b.len, 0);
    if (filled < 3 || filled > 6) continue;
    if (withTreat) row[rng.int(row.length)]!.treat = true;
    return row;
  }
}

function nextTemplate(state: SlideState, rng: Rng): RowTemplate {
  state.rowsMade++;
  const withTreat = state.rowsMade >= state.treatAt;
  if (withTreat) state.treatAt = state.rowsMade + TREAT_EVERY_MIN + rng.int(TREAT_EVERY_MAX - TREAT_EVERY_MIN + 1);
  return makeRow(rng, withTreat);
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
    while (row + 1 < SLIDE_SIZE) {
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
    const earned = gone.filter((b) => b.treat).length;
    state.lines += rows.length;
    state.treats += earned;
    frames.push({ ...frame(state), clearing: gone.map((b) => b.id), treatsEarned: earned });
    state.blocks = state.blocks.filter((b) => !rows.includes(b.row));
  }
}

function frame(state: SlideState, spawned: number[] = []): SlideFrame {
  return { blocks: copy(state.blocks), clearing: [], spawned, treatsEarned: 0 };
}

/** Новая партия: три нижние полосы и следующая полоса наготове. */
export function newSlideGame(seed: number): SlideState {
  const rng = new Rng(seed >>> 0 || 1);
  for (;;) {
    const state: SlideState = {
      blocks: [],
      next: [],
      rng: 0,
      nextId: 1,
      rowsMade: 0,
      treatAt: TREAT_EVERY_MIN + rng.int(TREAT_EVERY_MAX - TREAT_EVERY_MIN + 1),
      lines: 0,
      treats: 0,
      moves: 0,
      over: false,
    };
    for (let i = 0; i < SLIDE_START_ROWS; i++) {
      // Стартовые полосы без лакомств и не считаются.
      place(state, makeRow(rng, false), SLIDE_SIZE - SLIDE_START_ROWS + i);
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
  while (max + b.len < SLIDE_SIZE && grid[b.row]![max + b.len] === -1) max++;
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

  // Новая полоса падает сверху. Если стопка дошла до верха — места нет, конец игры.
  for (let guard = 0; guard < 5; guard++) {
    if (state.blocks.some((b) => b.row === 0)) {
      state.over = true;
      break;
    }
    const ids = place(state, state.next, 0);
    state.next = nextTemplate(state, rng);
    frames.push(frame(state, ids));
    resolve(state, frames);
    if (state.blocks.some((b) => b.row === 0)) {
      state.over = true;
      break;
    }
    // Поле опустело — двигать нечего, пусть падает ещё одна полоса.
    if (state.blocks.length > 0) break;
  }
  state.rng = rng.state;
  return { state, frames };
}
