import { nextRandom } from './rng';
import { PET_PICTURES } from './mosaicPictures';

// «Мозаика»: картинка из цветных кубиков. Снизу — баночки с числами; нажатая баночка встаёт в
// свободную ячейку, и питомцы уносят из картинки столько кубиков её цвета, сколько написано.

export const MOSAIC_SLOTS = 4;
export const MOSAIC_COLUMNS = 4;
/** Награда за собранную картинку, лакомств. */
export const MOSAIC_REWARD = 3;

/** Картинка: буква — цвет кубика, точка — пусто. */
export const MOSAIC_PICTURES = {
  heart: [
    'BBBBBBBBBB',
    'BRRRBBRRRB',
    'RPPPRRPPPR',
    'RPWWPPPPPR',
    'RPWPPPPPPR',
    'BRPPPPPPRB',
    'BBRPPPPRBB',
    'BBBRPPRBBB',
    'BBBBRRBBBB',
  ],
  // Питомцы: картинки сделаны из их спрайтов (scripts/mosaic-from-pets.py).
  ...PET_PICTURES,
} as const;

export type MosaicPicture = keyof typeof MOSAIC_PICTURES;
export const MOSAIC_PICTURE_NAMES = Object.keys(MOSAIC_PICTURES) as MosaicPicture[];

/** Цвета кубиков: буква картинки → индекс цвета. */
export const MOSAIC_COLORS = ['B', 'R', 'P', 'W', 'O', 'T', 'K', 'Y'] as const;
/** Цвет кубика и баночки на экране, в том же порядке. */
export const MOSAIC_COLOR_HEX = ['#5aaef0', '#e8505b', '#ffa6c9', '#fff6e6', '#f5a35c', '#a8724a', '#4a3a33', '#ffd75e'] as const;

export interface Jar {
  id: number;
  color: number;
  /** Сколько кубиков ещё надо унести. */
  n: number;
}

export interface MosaicState {
  picture: MosaicPicture;
  w: number;
  h: number;
  /** Индекс цвета кубика или -1, если клетка пуста. */
  cells: number[];
  /** Очереди баночек: тапнуть можно только первую в очереди. */
  columns: Jar[][];
  slots: (Jar | null)[];
  left: number;
  moves: number;
  won: boolean;
  stuck: boolean;
}

export interface Carry {
  slot: number;
  /** Индекс клетки, из которой унесён кубик. */
  cell: number;
  color: number;
  jarId: number;
  /** Баночка опустела и освободила ячейку. */
  done: boolean;
}

function pictureCells(picture: MosaicPicture): { w: number; h: number; cells: number[] } {
  const rows = MOSAIC_PICTURES[picture];
  const cells = rows.flatMap((row) => [...row].map((ch) => MOSAIC_COLORS.indexOf(ch as (typeof MOSAIC_COLORS)[number])));
  return { w: rows[0]!.length, h: rows.length, cells };
}

/** Новая партия: числа на баночках каждого цвета в сумме равны числу кубиков этого цвета. */
export function newMosaic(seed: number, picture: MosaicPicture = 'heart'): MosaicState {
  const { w, h, cells } = pictureCells(picture);
  let rng = seed;
  const rand = (): number => {
    const [v, s] = nextRandom(rng);
    rng = s;
    return v;
  };
  const jars: Jar[] = [];
  let id = 1;
  MOSAIC_COLORS.forEach((_, color) => {
    let rest = cells.filter((c) => c === color).length;
    while (rest > 0) {
      const n = rest <= 8 ? rest : 4 + Math.floor(rand() * 5);
      // Не оставляем хвост из одного-двух кубиков отдельной баночкой.
      const take = rest - n > 0 && rest - n < 3 ? rest : n;
      jars.push({ id: id++, color, n: take });
      rest -= take;
    }
  });
  for (let i = jars.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [jars[i], jars[j]] = [jars[j]!, jars[i]!];
  }
  const columns: Jar[][] = Array.from({ length: MOSAIC_COLUMNS }, () => []);
  jars.forEach((jar, i) => columns[i % MOSAIC_COLUMNS]!.push(jar));
  const state: MosaicState = {
    picture,
    w,
    h,
    cells,
    columns,
    slots: Array.from({ length: MOSAIC_SLOTS }, () => null),
    left: cells.filter((c) => c >= 0).length,
    moves: 0,
    won: false,
    stuck: false,
  };
  return state;
}

/** Кубик открыт, если с какой-то стороны от него пусто или край картинки. */
export function isExposed(state: MosaicState, index: number): boolean {
  const { w, h, cells } = state;
  if (cells[index]! < 0) return false;
  const x = index % w;
  const y = Math.floor(index / w);
  const empty = (nx: number, ny: number): boolean => nx < 0 || ny < 0 || nx >= w || ny >= h || cells[ny * w + nx]! < 0;
  return empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1);
}

/** Открытые кубики цвета; ближе к норке (низ по центру) — раньше. */
export function exposedCells(state: MosaicState, color: number): number[] {
  const { w, h, cells } = state;
  const out: number[] = [];
  cells.forEach((c, i) => {
    if (c === color && isExposed(state, i)) out.push(i);
  });
  const dist = (i: number): number => Math.abs((i % w) - (w - 1) / 2) + (h - 1 - Math.floor(i / w));
  return out.sort((a, b) => dist(a) - dist(b) || a - b);
}

/** Тап по баночке в очереди col: она встаёт в свободную ячейку. null — нельзя. */
export function tapJar(state: MosaicState, col: number): MosaicState | null {
  if (state.won || state.stuck) return null;
  const jar = state.columns[col]?.[0];
  const slot = state.slots.indexOf(null);
  if (!jar || slot < 0) return null;
  const columns = state.columns.map((c, i) => (i === col ? c.slice(1) : c));
  const slots = state.slots.map((s, i) => (i === slot ? jar : s));
  return settle({ ...state, columns, slots, moves: state.moves + 1 });
}

/** Один шаг: каждая баночка в ячейке уносит один открытый кубик своего цвета. */
export function stepMosaic(state: MosaicState): { state: MosaicState; carries: Carry[] } {
  if (state.won || state.stuck) return { state, carries: [] };
  const cells = state.cells.slice();
  const slots = state.slots.slice();
  const carries: Carry[] = [];
  let work: MosaicState = { ...state, cells, slots };
  state.slots.forEach((jar, slot) => {
    if (!jar) return;
    const cell = exposedCells(work, jar.color)[0];
    if (cell === undefined) return;
    cells[cell] = -1;
    const n = jar.n - 1;
    slots[slot] = n > 0 ? { ...jar, n } : null;
    carries.push({ slot, cell, color: jar.color, jarId: jar.id, done: n === 0 });
    work = { ...work, cells, slots };
  });
  const left = cells.filter((c) => c >= 0).length;
  return { state: settle({ ...state, cells, slots, left }), carries };
}

/** Победа, если кубиков не осталось; тупик — если все ячейки заняты и ни одна не может ничего унести. */
function settle(state: MosaicState): MosaicState {
  if (state.left === 0) return { ...state, won: true, stuck: false };
  const full = state.slots.every((s) => s !== null);
  const canWork = state.slots.some((s) => s && exposedCells(state, s.color).length > 0);
  return { ...state, won: false, stuck: full && !canWork };
}
