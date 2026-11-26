import { describe, expect, it } from 'vitest';
import {
  findMatches,
  hasMoves,
  M3_COLS,
  M3_ROWS,
  m3Index,
  restoreM3,
  M3_MAX_TREATS,
  m3Swap,
  m3Tap,
  newM3,
  type M3Piece,
  type M3Special,
  type M3State,
} from '../src/core/match3';

/** Поле из строк: цифра — вид питомца, '.' — «запас» из неповторяющихся видов, буква — бонус (r,c,b,w=радуга). */
function board(rows: string[]): M3State {
  const cells: (M3Piece | null)[] = [];
  let id = 1;
  const special: Record<string, M3Special> = { r: 'row', c: 'col', b: 'bomb', w: 'rainbow' };
  for (let r = 0; r < M3_ROWS; r++) {
    for (let c = 0; c < M3_COLS; c++) {
      const ch = rows[r]?.[c] ?? '.';
      // Фон: шахматка из 4,5 — без троек и квадратов.
      const filler = (r * 2 + c * 3 + (r >> 1)) % 2 === 0 ? 4 : 5;
      if (ch === '.') cells.push({ id: id++, kind: filler });
      else if (special[ch]) cells.push({ id: id++, kind: ch === 'w' ? -1 : 0, special: special[ch] });
      else cells.push({ id: id++, kind: Number(ch) });
    }
  }
  return { cells, seed: 7, nextId: id };
}

describe('three in a row', () => {
  it('new board has no matches and has a move', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = newM3(seed);
      const m = findMatches(s.cells);
      expect(m.runs.length + m.squares.length).toBe(0);
      expect(hasMoves(s.cells)).toBe(true);
    }
  });

  it('rejects a swap that makes nothing', () => {
    const s = board([]);
    expect(m3Swap(s, 0, 1)).toBeNull();
  });

  it('clears three and drops the upper pieces', () => {
    const s = board(['', '', '', '', '', '', '.1.....', '11.1...'].map((x) => x));
    // 1 1 . 1 → меняем клетки (7,2) и (6,1)? проще: ряд «1 1 x 1», сверху 1 над x
    s.cells[m3Index(7, 2)] = { id: 900, kind: 3 };
    s.cells[m3Index(6, 2)] = { id: 901, kind: 1 };
    const above = s.cells[m3Index(5, 0)]!;
    const res = m3Swap(s, m3Index(6, 2), m3Index(7, 2))!;
    expect(res).not.toBeNull();
    expect(res.steps[0]!.cleared).toBeGreaterThanOrEqual(3);
    expect(res.state.cells.every((p) => p !== null)).toBe(true);
    expect(above !== undefined).toBe(true);
  });
});

describe('bonuses', () => {
  it('four in a row makes a line bonus in the swapped cell', () => {
    const s = board(['', '', '', '', '', '', '.....', '1 11'.replace(' ', '2') + '..']);
    // ряд 7: 1 2 1 1, сверху над 2 стоит 1 → меняем (6,1)<->(7,1)
    s.cells[m3Index(6, 1)] = { id: 800, kind: 1 };
    s.cells[m3Index(7, 0)] = { id: 801, kind: 1 };
    s.cells[m3Index(7, 1)] = { id: 802, kind: 2 };
    s.cells[m3Index(7, 2)] = { id: 803, kind: 1 };
    s.cells[m3Index(7, 3)] = { id: 804, kind: 1 };
    const res = m3Swap(s, m3Index(6, 1), m3Index(7, 1))!;
    const made = res.steps[0]!.afterClear.find((p) => p?.special === 'row');
    expect(made !== undefined).toBe(true);
    expect(made!.kind).toBe(1);
  });

  it('vertical four makes a column bonus', () => {
    const s = board([]);
    for (const r of [3, 4, 6]) s.cells[m3Index(r, 2)] = { id: 700 + r, kind: 1 };
    s.cells[m3Index(5, 2)] = { id: 710, kind: 2 };
    s.cells[m3Index(5, 3)] = { id: 711, kind: 1 };
    const res = m3Swap(s, m3Index(5, 2), m3Index(5, 3))!;
    expect(res.steps[0]!.afterClear.some((p) => p?.special === 'col')).toBe(true);
  });

  it('a 2x2 square makes a bomb', () => {
    const s = board([]);
    s.cells[m3Index(3, 2)] = { id: 600, kind: 1 };
    s.cells[m3Index(3, 3)] = { id: 601, kind: 1 };
    s.cells[m3Index(4, 2)] = { id: 602, kind: 1 };
    s.cells[m3Index(4, 3)] = { id: 603, kind: 2 };
    s.cells[m3Index(4, 4)] = { id: 604, kind: 1 };
    const res = m3Swap(s, m3Index(4, 3), m3Index(4, 4))!;
    expect(res).not.toBeNull();
    expect(res.steps[0]!.afterClear.some((p) => p?.special === 'bomb')).toBe(true);
  });

  it('five in a row makes a rainbow', () => {
    const s = board([]);
    for (const c of [0, 1, 3, 4]) s.cells[m3Index(7, c)] = { id: 500 + c, kind: 1 };
    s.cells[m3Index(7, 2)] = { id: 510, kind: 2 };
    s.cells[m3Index(6, 2)] = { id: 511, kind: 1 };
    const res = m3Swap(s, m3Index(6, 2), m3Index(7, 2))!;
    expect(res.steps[0]!.afterClear.some((p) => p?.special === 'rainbow')).toBe(true);
  });

  it('a T or an L of five makes a bomb', () => {
    const s = board([]);
    for (const [r, c] of [[5, 1], [5, 3], [6, 2], [7, 2], [4, 2]] as const) s.cells[m3Index(r, c)] = { id: 400 + r * 10 + c, kind: 1 };
    s.cells[m3Index(5, 2)] = { id: 450, kind: 2 };
    const res = m3Swap(s, m3Index(4, 2), m3Index(5, 2))!;
    expect(res !== null).toBe(true);
    expect(res.steps[0]!.afterClear.some((p) => p?.special === 'bomb')).toBe(true);
    const l = board([]);
    for (const [r, c] of [[5, 2], [6, 2], [7, 2], [5, 3], [5, 4]] as const) l.cells[m3Index(r, c)] = { id: 460 + r * 10 + c, kind: 1 };
    l.cells[m3Index(5, 2)] = { id: 470, kind: 2 };
    l.cells[m3Index(4, 2)] = { id: 471, kind: 1 };
    const res2 = m3Swap(l, m3Index(4, 2), m3Index(5, 2))!;
    expect(res2.steps[0]!.afterClear.some((p) => p?.special === 'bomb')).toBe(true);
  });

  it('rainbow swapped with a neighbour clears every pet of that kind', () => {
    const s = board([]);
    s.cells[m3Index(4, 3)] = { id: 300, kind: -1, special: 'rainbow' };
    s.cells[m3Index(4, 4)] = { id: 301, kind: 4 };
    const fours = s.cells.filter((p) => p?.kind === 4).length;
    const res = m3Swap(s, m3Index(4, 3), m3Index(4, 4))!;
    expect(res.steps[0]!.cleared).toBeGreaterThanOrEqual(fours);
    expect(res.steps[0]!.afterClear.filter((p) => p?.kind === 4).length).toBe(0);
  });

  it('a line bonus clears its whole row when tapped', () => {
    const s = board([]);
    s.cells[m3Index(5, 3)] = { id: 200, kind: 0, special: 'row' };
    const res = m3Tap(s, m3Index(5, 3))!;
    expect(res.steps[0]!.cleared).toBeGreaterThanOrEqual(M3_COLS);
    expect(res.steps[0]!.afterClear.slice(m3Index(5, 0), m3Index(5, 0) + M3_COLS).every((p) => p === null)).toBe(true);
  });

  it('a bomb clears everything within three cells', () => {
    const s = board([]);
    s.cells[m3Index(4, 3)] = { id: 100, kind: 0, special: 'bomb' };
    const res = m3Tap(s, m3Index(4, 3))!;
    const after = res.steps[0]!.afterClear;
    expect(after[m3Index(4, 3)]).toBeNull();
    expect(after[m3Index(4, 6)]).toBeNull(); // ровно 3 клетки
    expect(after[m3Index(7, 3)]).toBeNull(); // 3 вниз
    expect(after[m3Index(7, 6)]).not.toBeNull(); // дальше трёх
    expect(after[m3Index(0, 0)]).not.toBeNull();
  });

  it('tapping an ordinary pet or a rainbow does nothing', () => {
    const s = board([]);
    expect(m3Tap(s, 0)).toBeNull();
  });
});

describe('treats and saving', () => {
  it('an ordinary match does not take a treat, a line bonus and a bomb do', () => {
    const s = board([]);
    s.cells[m3Index(5, 0)] = { id: 900, kind: -3, treat: true };
    s.cells[m3Index(5, 3)] = { id: 901, kind: 0, special: 'row' };
    s.cells[m3Index(3, 5)] = { id: 902, kind: -3, treat: true };
    const res = m3Tap(s, m3Index(5, 3))!;
    expect(res.steps[0]!.treats).toBe(1);
    const b = board([]);
    b.cells[m3Index(2, 2)] = { id: 910, kind: -3, treat: true };
    b.cells[m3Index(4, 3)] = { id: 911, kind: 0, special: 'bomb' };
    expect(m3Tap(b, m3Index(4, 3))!.steps[0]!.treats).toBe(1);
  });

  it('a treat next to a match is not cleared', () => {
    const s = board([]);
    s.cells[m3Index(4, 3)] = { id: 920, kind: -3, treat: true };
    for (const c of [0, 1, 2]) s.cells[m3Index(4, c)] = { id: 930 + c, kind: 1 };
    const res = m3Swap(s, m3Index(0, 0), m3Index(0, 1))!;
    expect(res.steps[0]!.treats).toBe(0);
    expect(res.steps[0]!.afterClear.some((p) => p?.id === 920)).toBe(true);
  });

  it('treats appear while playing but never more than the cap', () => {
    let seen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let s = newM3(seed);
      for (let n = 0; n < 40; n++) {
        let moved = false;
        for (let i = 0; i < 56 && !moved; i++) {
          for (const j of [i + 1, i + 7]) {
            const r = m3Swap(s, i, j);
            if (r) {
              s = r.state;
              moved = true;
              break;
            }
          }
        }
        const treats = s.cells.filter((p) => p?.treat).length;
        expect(treats).toBeLessThanOrEqual(M3_MAX_TREATS);
        seen += treats;
        if (!moved) break;
      }
    }
    expect(seen).toBeGreaterThanOrEqual(1);
  });

  it('a saved board is restored and a broken one is rejected', () => {
    const s = newM3(11);
    const back = restoreM3(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
    expect(restoreM3({ cells: [], seed: 1, nextId: 1 })).toBeNull();
    expect(restoreM3(null)).toBeNull();
    expect(restoreM3({ ...s, cells: s.cells.map((p) => ({ ...p, kind: 99 })) })).toBeNull();
  });

  it('is deterministic', () => {
    expect(newM3(5).cells.map((p) => p?.kind)).toEqual(newM3(5).cells.map((p) => p?.kind));
  });
});

describe('combination table', () => {
  const H = (r: number, c: number, n: number): [number, number][] => Array.from({ length: n }, (_, i) => [r, c + i]);
  const V = (r: number, c: number, n: number): [number, number][] => Array.from({ length: n }, (_, i) => [r + i, c]);
  /** Готовая комбинация уже стоит на поле; обмен двух дальних клеток запускает разбор. */
  function made(points: [number, number][]): string {
    const s = board([]);
    points.forEach(([r, c], i) => (s.cells[m3Index(r, c)] = { id: 500 + i, kind: 1 }));
    const res = m3Swap(s, m3Index(0, 0), m3Index(0, 1));
    const found = res?.steps[0]?.afterClear.find((p) => p && p.id >= 500 && p.special);
    return found?.special ?? 'none';
  }
  it.each([
    ['3 horizontal', H(4, 2, 3), 'none'],
    ['3 vertical', V(3, 2, 3), 'none'],
    ['4 horizontal', H(4, 1, 4), 'row'],
    ['4 vertical', V(2, 2, 4), 'col'],
    ['5 horizontal', H(4, 1, 5), 'rainbow'],
    ['5 vertical', V(1, 2, 5), 'rainbow'],
    ['6 in a row', H(4, 0, 6), 'rainbow'],
    ['square', [[3, 2], [3, 3], [4, 2], [4, 3]], 'bomb'],
    ['T', [...H(3, 1, 3), [4, 2], [5, 2]], 'bomb'],
    ['L', [...V(3, 1, 3), [5, 2], [5, 3]], 'bomb'],
    ['plus', [...H(4, 1, 3), [3, 2], [5, 2]], 'rainbow'],
  ] as [string, [number, number][], string][])('%s makes %s', (_name, points, expected) => {
    expect(made(points)).toBe(expected);
  });
});
