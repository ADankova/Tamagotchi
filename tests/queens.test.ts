import { describe, expect, it } from 'vitest';
import {
  blockedBy,
  brokenRule,
  countSolutions,
  generatePuzzle,
  isSolutionCell,
  QUEENS_LEVELS,
  type Puzzle,
} from '../src/core/queens';

function check(p: Puzzle): void {
  const n = p.size;
  // зоны: ровно n штук, каждая связная
  const ids = new Set(p.regions.flat());
  expect([...ids].sort((a, b) => a - b)).toEqual([...Array(n).keys()]);
  for (const id of ids) {
    const cells: Array<[number, number]> = [];
    p.regions.forEach((row, r) => row.forEach((v, c) => v === id && cells.push([r, c])));
    const seen = new Set([cells[0]!.join()]);
    const stack = [cells[0]!];
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Array<[number, number]>) {
        if (p.regions[y]?.[x] === id && !seen.has(`${y},${x}`)) {
          seen.add(`${y},${x}`);
          stack.push([y, x]);
        }
      }
    }
    expect(seen.size).toBe(cells.length);
  }
  // решение: по одному в строке, столбце, зоне; без касаний
  expect(new Set(p.solution).size).toBe(n);
  expect(new Set(p.solution.map((c, r) => p.regions[r]![c])).size).toBe(n);
  for (let r = 1; r < n; r++) expect(Math.abs(p.solution[r]! - p.solution[r - 1]!)).toBeGreaterThan(1);
  // и оно единственное
  expect(countSolutions(p.regions, 3)).toBe(1);
}

describe('Судоку с питомцем: генератор', () => {
  for (const { size } of QUEENS_LEVELS) {
    it(`${size}×${size}: корректные поля с единственным решением`, () => {
      for (let seed = 1; seed <= 15; seed++) check(generatePuzzle(size, seed * 104729));
    });
  }

  it('одно и то же зерно — одно и то же поле', () => {
    expect(generatePuzzle(6, 777)).toEqual(generatePuzzle(6, 777));
  });

  it('награда растёт со сложностью', () => {
    expect(QUEENS_LEVELS.map((l) => l.reward)).toEqual([1, 2, 3]);
  });
});

describe('Судоку с питомцем: ходы', () => {
  const p = generatePuzzle(5, 42);
  const sol = (r: number): [number, number] => [r, p.solution[r]!];

  it('правильная клетка — из решения', () => {
    for (let r = 0; r < 5; r++) expect(isSolutionCell(p, ...sol(r))).toBe(true);
    expect(isSolutionCell(p, 0, (p.solution[0]! + 2) % 5)).toBe(false);
  });

  it('нарушенное правило: касание, строка/столбец, цвет', () => {
    const [r0, c0] = sol(0);
    const placed: Array<[number, number]> = [[r0, c0]];
    expect(brokenRule(p, placed, r0 + 1, c0)).toBe('touch');
    expect(brokenRule(p, placed, r0 + 2 < 5 ? r0 + 2 : r0, c0)).toBe('line');
    // клетка той же зоны, не в строке/столбце и не рядом — если такая есть
    const same: Array<[number, number]> = [];
    p.regions.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v === p.regions[r0]![c0] && r !== r0 && c !== c0 && (Math.abs(r - r0) > 1 || Math.abs(c - c0) > 1)) same.push([r, c]);
      }),
    );
    if (same[0]) expect(brokenRule(p, placed, ...same[0])).toBe('region');
    expect(brokenRule(p, placed, ...sol(2))).toBeNull();
  });

  it('после питомца зачёркиваются его строка, столбец, зона и соседи — но не клетки решения', () => {
    const [r, c] = sol(1);
    const blocked = blockedBy(p, r, c);
    const has = (y: number, x: number) => blocked.some(([a, b]) => a === y && b === x);
    expect(has(r, (c + 2) % 5)).toBe(true);
    expect(has((r + 2) % 5, c)).toBe(true);
    if (r + 1 < 5 && c + 1 < 5) expect(has(r + 1, c + 1)).toBe(true);
    for (let k = 0; k < 5; k++) if (k !== r) expect(has(...sol(k))).toBe(false);
  });
});
