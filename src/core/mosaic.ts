import { nextRandom } from './rng';
import { PET_PICTURES } from './mosaicPictures';

// «Мозаика»: картинка из цветных кубиков. Снизу — баночки с числами; нажатая баночка встаёт в
// свободную ячейку, и питомцы уносят из картинки столько кубиков её цвета, сколько написано.

export const MOSAIC_SLOTS = 5;
export const MOSAIC_COLUMNS = 4;
/** Награда за собранную картинку, лакомств. */
export const MOSAIC_REWARD = 3;

/** Картинка: буква — цвет кубика, точка — пусто. */
/** Каждая клетка рисунка — четыре клетки (вдвое крупнее по каждой стороне). */
function doubled(rows: readonly string[]): string[] {
  return rows.flatMap((row) => {
    const wide = [...row].map((ch) => ch + ch).join('');
    return [wide, wide];
  });
}

export const MOSAIC_PICTURES = {
  heart: doubled([
    'BBBBBBBBBB',
    'BRRRBBRRRB',
    'RPPPRRPPPR',
    'RPWWPPPPPR',
    'RPWPPPPPPR',
    'BRPPPPPPRB',
    'BBRPPPPRBB',
    'BBBRPPRBBB',
    'BBBBRRBBBB',
  ]),
  // Питомцы: картинки сделаны из их спрайтов (scripts/mosaic-from-pets.py).
  ...PET_PICTURES,
} as { heart: readonly string[] } & typeof PET_PICTURES;

export type MosaicPicture = keyof typeof MOSAIC_PICTURES;
export const MOSAIC_PICTURE_NAMES = Object.keys(MOSAIC_PICTURES) as MosaicPicture[];

/** Цвета кубиков: буква картинки → индекс цвета. */
export const MOSAIC_COLORS = ['B', 'R', 'P', 'W', 'O', 'T', 'K', 'Y', 'G'] as const;
/** Цвет кубика и баночки на экране, в том же порядке. */
export const MOSAIC_COLOR_HEX = ['#5aaef0', '#e8505b', '#ffa6c9', '#fff6e6', '#f5a35c', '#a8724a', '#4a3a33', '#ffd75e', '#7bc67e'] as const;

export interface Jar {
  id: number;
  color: number;
  /** Сколько кубиков ещё надо унести. */
  n: number;
  /** Id баночки-пары: связанные баночки берутся из очереди вместе и уходят из ячеек тоже вместе. */
  pair?: number;
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
  /** Кубики, за которыми питомцы уже побежали, но ещё не взяли: пока они на месте, их нельзя брать и они закрывают соседей. */
  reserved: number[];
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

/** Доля баночек, которые получают пару. */
const PAIR_CHANCE = 0.1;

/** Связывает соседние в очередях баночки по две: справа или под ними. */
function linkJars(columns: Jar[][], rand: () => number): void {
  const depth = Math.max(...columns.map((c) => c.length));
  for (let d = 0; d < depth; d++) {
    for (let c = 0; c < columns.length; c++) {
      const jar = columns[c]![d];
      if (!jar || jar.pair !== undefined || rand() > PAIR_CHANCE) continue;
      const options = [columns[c + 1]?.[d], columns[c]?.[d + 1], columns[c + 1]?.[d + 1], columns[c - 1]?.[d + 1]].filter(
        (o): o is Jar => !!o && o.pair === undefined,
      );
      const other = options[Math.floor(rand() * options.length)];
      if (!other) continue;
      jar.pair = other.id;
      other.pair = jar.id;
    }
  }
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
  linkJars(columns, rand);
  const state: MosaicState = {
    picture,
    w,
    h,
    cells,
    columns,
    slots: Array.from({ length: MOSAIC_SLOTS }, () => null),
    reserved: [],
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

/** Колонка картинки (или соседняя с ней), над которой стоит ячейка slot. */
function slotColumn(state: MosaicState, slot: number): number {
  return Math.min(state.w - 1, Math.max(0, Math.round(((slot + 0.5) * state.w) / MOSAIC_SLOTS - 0.5)));
}

/** Длина пути питомца из ячейки slot до каждой клетки: по пустым местам и вокруг картинки, чужие кубики обходит. */
function runDistances(state: MosaicState, slot: number): Map<number, number> {
  const { w, h, cells } = state;
  const key = (x: number, y: number): number => (y + 1) * (w + 2) + (x + 1);
  const dist = new Map<number, number>();
  const start: [number, number] = [slotColumn(state, slot), h];
  const queue: Array<[number, number]> = [start];
  dist.set(key(start[0], start[1]), 0);
  for (let at = 0; at < queue.length; at++) {
    const [x, y] = queue[at]!;
    const d = dist.get(key(x, y))!;
    for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < -1 || ny < -1 || nx > w || ny > h || dist.has(key(nx, ny))) continue;
      const inside = nx >= 0 && ny >= 0 && nx < w && ny < h;
      dist.set(key(nx, ny), d + 1);
      // Сквозь кубик не идём: в него только входят (это и есть цель), дальше путь не продолжается.
      if (!inside || cells[ny * w + nx]! < 0) queue.push([nx, ny]);
    }
  }
  const out = new Map<number, number>();
  cells.forEach((c, i) => {
    if (c >= 0) out.set(i, dist.get(key(i % w, Math.floor(i / w))) ?? Infinity);
  });
  return out;
}

/** Открытые кубики цвета: сначала ближайшие к питомцу в ячейке slot (по пути), при равенстве — ближе к норке. */
export function exposedCells(state: MosaicState, color: number, slot = 1): number[] {
  const { w, h, cells } = state;
  const out: number[] = [];
  const way = runDistances(state, slot);
  cells.forEach((c, i) => {
    // Брать можно открытый кубик, которого ещё никто не ждёт и до которого есть свободный путь.
    if (c === color && isExposed(state, i) && !state.reserved.includes(i) && (way.get(i) ?? Infinity) < Infinity) out.push(i);
  });
  const hole = (i: number): number => Math.abs((i % w) - (w - 1) / 2) + (h - 1 - Math.floor(i / w));
  return out.sort((a, b) => (way.get(a) ?? Infinity) - (way.get(b) ?? Infinity) || hole(a) - hole(b) || a - b);
}

/** Свободные ячейки, которые нужны баночке: одной или паре (рядом, если есть где). */
function freeSlotsFor(state: MosaicState, count: number): number[] | null {
  const free = state.slots.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
  if (free.length < count) return null;
  if (count === 1) return [free[0]!];
  const near = free.find((i) => free.includes(i + 1));
  return near !== undefined ? [near, near + 1] : [free[0]!, free[1]!];
}

/** Можно ли сейчас взять баночку из очереди col. */
export function canTapJar(state: MosaicState, col: number): boolean {
  const jar = state.columns[col]?.[0];
  return !!jar && freeSlotsFor(state, jar.pair === undefined ? 1 : 2) !== null;
}

/** Тап по баночке в очереди col: она встаёт в свободную ячейку (связанная — вместе с парой). null — нельзя. */
export function tapJar(state: MosaicState, col: number): MosaicState | null {
  if (state.won || state.stuck) return null;
  const jar = state.columns[col]?.[0];
  if (!jar) return null;
  const places = freeSlotsFor(state, jar.pair === undefined ? 1 : 2);
  if (!places) return null;
  const taken = new Set<number>([jar.id]);
  const slots = state.slots.slice();
  slots[places[0]!] = jar;
  if (jar.pair !== undefined) {
    const partner = state.columns.flat().find((j) => j.id === jar.pair);
    if (!partner) return null;
    taken.add(partner.id);
    slots[places[1]!] = partner;
  }
  const columns = state.columns.map((c) => c.filter((j) => !taken.has(j.id)));
  return settle({ ...state, columns, slots, moves: state.moves + 1 });
}

/** Один шаг: каждая баночка в ячейке посылает питомца за открытым кубиком своего цвета. Кубик пропадёт, когда питомец его возьмёт (pickCell). */
/** Сколько питомцев выбегает из одной баночки за шаг. */
export const RUNNERS_PER_STEP = 2;

/** `canTake` — может ли питомец прямо сейчас выбежать к этому кубику (иначе число на баночке не трогаем). */
export function stepMosaic(state: MosaicState, canTake: (cell: number) => boolean = () => true): { state: MosaicState; carries: Carry[] } {
  if (state.won || state.stuck) return { state, carries: [] };
  const slots = state.slots.slice();
  const reserved = state.reserved.slice();
  const carries: Carry[] = [];
  state.slots.forEach((jar, slot) => {
    if (!jar || jar.n <= 0) return;
    // Из баночки выбегает цепочка питомцев: за шаг — до RUNNERS_PER_STEP штук.
    let n = jar.n;
    for (let k = 0; k < RUNNERS_PER_STEP && n > 0; k++) {
      const cell = exposedCells({ ...state, reserved }, jar.color, slot).find(canTake);
      if (cell === undefined) break;
      reserved.push(cell);
      n--;
      carries.push({ slot, cell, color: jar.color, jarId: jar.id, done: n === 0 });
    }
    slots[slot] = { ...jar, n };
  });
  // Опустевшая баночка уходит из ячейки; у связанной пары — только когда опустеют обе.
  const gone: number[] = [];
  slots.forEach((jar, slot) => {
    if (!jar || jar.n > 0) return;
    const mate = jar.pair === undefined ? -1 : slots.findIndex((o) => o?.id === jar.pair);
    if (mate < 0 || slots[mate]!.n <= 0) gone.push(slot);
  });
  gone.forEach((slot) => (slots[slot] = null));
  // Освободившаяся ячейка не остаётся посередине: баночки справа сдвигаются влево, свободные места — все справа.
  const packed = slots.filter((j) => j !== null);
  slots.forEach((_, i) => (slots[i] = packed[i] ?? null));
  return { state: settle({ ...state, slots, reserved }), carries };
}

/** Питомец взял кубик: он пропадает с поля, и соседние кубики открываются. */
export function pickCell(state: MosaicState, cell: number): MosaicState {
  if (state.cells[cell]! < 0 && !state.reserved.includes(cell)) return state;
  const cells = state.cells.slice();
  cells[cell] = -1;
  const reserved = state.reserved.filter((c) => c !== cell);
  const left = cells.filter((c) => c >= 0).length;
  return settle({ ...state, cells, reserved, left });
}

/** Победа, если кубиков не осталось; тупик — если ни одна баночка в ячейке не может ничего унести и ни одну нельзя взять. */
function settle(state: MosaicState): MosaicState {
  if (state.left === 0) return { ...state, won: true, stuck: false };
  const canWork = state.slots.some((s) => s && s.n > 0 && exposedCells(state, s.color).length > 0);
  const canTap = state.columns.some((_, col) => canTapJar(state, col));
  // Пока питомцы несут кубики, после их возвращения могут открыться новые: это ещё не тупик.
  return { ...state, won: false, stuck: !canWork && !canTap && state.reserved.length === 0 };
}
