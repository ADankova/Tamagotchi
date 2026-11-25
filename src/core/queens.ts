import { nextRandom } from './rng';

// «Судоку с питомцем» (головоломка типа Queens / Star Battle):
// поле N×N разбито на N цветных зон; в каждой строке, каждом столбце и каждой зоне
// стоит ровно один питомец, и питомцы не касаются друг друга — даже углами.
// Здесь только логика: генерация с единственным решением, проверка ходов. Без DOM.

export interface Puzzle {
  size: number;
  /** regions[r][c] — номер цветной зоны клетки (0..size-1). */
  regions: number[][];
  /** solution[r] — столбец питомца в строке r. */
  solution: number[];
}

export type QueensRule = 'region' | 'line' | 'touch';

/** Детерминированный генератор случайных чисел поверх общего RNG игры. */
class Rng {
  constructor(private state: number) {}
  next(): number {
    const [v, s] = nextRandom(this.state);
    this.state = s;
    return v;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const a = arr.at(i) as T;
      arr[i] = arr.at(j) as T;
      arr[j] = a;
    }
    return arr;
  }
}

/** Случайная расстановка N питомцев: по одному в строке и столбце, без касаний. */
function randomPlacement(size: number, rng: Rng): number[] | null {
  const cols: number[] = [];
  const used = new Set<number>();
  const place = (r: number): boolean => {
    if (r === size) return true;
    for (const c of rng.shuffle([...Array(size).keys()])) {
      if (used.has(c)) continue;
      if (r > 0 && Math.abs((cols.at(r - 1) ?? -9) - c) <= 1) continue;
      cols.push(c);
      used.add(c);
      if (place(r + 1)) return true;
      cols.pop();
      used.delete(c);
    }
    return false;
  };
  return place(0) ? cols : null;
}

/** Зоны растут от каждого питомца случайными шагами, пока не заполнят поле. */
function growRegions(size: number, solution: number[], rng: Rng): number[][] {
  const regions = Array.from({ length: size }, () => Array<number>(size).fill(-1));
  solution.forEach((c, r) => {
    regions[r]![c] = r;
  });
  let free = size * size - size;
  while (free > 0) {
    const r = rng.int(size);
    const c = rng.int(size);
    if (regions[r]![c] !== -1) continue;
    const around = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ].filter(([y, x]) => y! >= 0 && y! < size && x! >= 0 && x! < size && regions[y!]![x!] !== -1);
    if (around.length === 0) continue;
    const [y, x] = around[rng.int(around.length)]!;
    regions[r]![c] = regions[y!]![x!]!;
    free--;
  }
  return regions;
}

/** Сколько решений у раскладки зон (считает до limit — дальше неинтересно). */
export function countSolutions(regions: number[][], limit = 2): number {
  const size = regions.length;
  const usedCols = new Set<number>();
  const usedRegions = new Set<number>();
  let found = 0;
  let prev = -9;
  const solve = (r: number): void => {
    if (found >= limit) return;
    if (r === size) {
      found++;
      return;
    }
    for (let c = 0; c < size; c++) {
      const region = regions[r]![c]!;
      if (usedCols.has(c) || usedRegions.has(region) || Math.abs(prev - c) <= 1) continue;
      usedCols.add(c);
      usedRegions.add(region);
      const keep = prev;
      prev = c;
      solve(r + 1);
      prev = keep;
      usedCols.delete(c);
      usedRegions.delete(region);
    }
  };
  solve(0);
  return found;
}

/**
 * Новая головоломка size×size с единственным решением. Детерминирована по seed.
 * Перебирает случайные раскладки, пока не найдёт однозначную (обычно за несколько попыток).
 */
export function generatePuzzle(size: number, seed: number): Puzzle {
  const rng = new Rng(seed);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const solution = randomPlacement(size, rng);
    if (!solution) continue;
    const regions = growRegions(size, solution, rng);
    if (countSolutions(regions) === 1) return { size, regions, solution };
  }
  throw new Error(`Не удалось построить головоломку ${size}×${size}`);
}

/** Какое правило нарушит питомец в (r, c) при уже стоящих питомцах; null — не нарушит. */
export function brokenRule(puzzle: Puzzle, placed: ReadonlyArray<readonly [number, number]>, r: number, c: number): QueensRule | null {
  for (const [pr, pc] of placed) {
    if (Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1) return 'touch';
  }
  for (const [pr, pc] of placed) {
    if (pr === r || pc === c) return 'line';
  }
  const region = puzzle.regions[r]![c];
  for (const [pr, pc] of placed) {
    if (puzzle.regions[pr]![pc] === region) return 'region';
  }
  return null;
}

export function isSolutionCell(puzzle: Puzzle, r: number, c: number): boolean {
  return puzzle.solution[r] === c;
}

/** Клетки, где после питомца в (r, c) других питомцев быть не может: строка, столбец, зона и соседи. */
export function blockedBy(puzzle: Puzzle, r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const region = puzzle.regions[r]![c];
  for (let y = 0; y < puzzle.size; y++) {
    for (let x = 0; x < puzzle.size; x++) {
      if (y === r && x === c) continue;
      const near = Math.abs(y - r) <= 1 && Math.abs(x - c) <= 1;
      if (near || y === r || x === c || puzzle.regions[y]![x] === region) out.push([y, x]);
    }
  }
  return out;
}

export interface QueensLevel {
  size: number;
  reward: number;
}

/** Уровни сложности: размер поля и награда в лакомствах. */
export const QUEENS_LEVELS: readonly QueensLevel[] = [
  { size: 5, reward: 1 },
  { size: 6, reward: 2 },
  { size: 7, reward: 3 },
];

export const QUEENS_LIVES = 3;
