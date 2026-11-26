import { describe, expect, it } from 'vitest';
import { exposedCells, isExposed, pickCell, MOSAIC_COLORS, MOSAIC_PICTURES, newMosaic, stepMosaic, tapJar } from '../src/core/mosaic';

describe('мозаика', () => {
  it('числа на баночках каждого цвета в сумме равны числу кубиков', () => {
    for (const seed of [1, 7, 99, 12345]) {
      const s = newMosaic(seed);
      MOSAIC_COLORS.forEach((_, color) => {
        const cubes = s.cells.filter((c) => c === color).length;
        const jars = s.columns.flat().filter((j) => j.color === color).reduce((a, j) => a + j.n, 0);
        expect(jars).toBe(cubes);
      });
      expect(s.left).toBe(MOSAIC_PICTURES.heart.join('').length);
    }
  });

  it('открыты только кубики у края или у пустого места', () => {
    const s = newMosaic(3);
    expect(isExposed(s, 0)).toBe(true);
    const inner = 4 * s.w + 4;
    expect(isExposed(s, inner)).toBe(false);
    s.cells[inner - 1] = -1;
    expect(isExposed(s, inner)).toBe(true);
  });

  it('число на баночке не уменьшается, пока питомец не может выбежать', () => {
    let s = newMosaic(5);
    s = tapJar(s, 0)!;
    const n = s.slots[0]!.n;
    const r = stepMosaic(s, () => false);
    expect(r.carries.length).toBe(0);
    expect(r.state.slots[0]!.n).toBe(n);
  });

  it('из баночки за шаг выбегает цепочка питомцев', () => {
    let s = newMosaic(5);
    s = tapJar(s, 0)!;
    const jar = s.slots[0]!;
    const r = stepMosaic(s);
    const sent = jar.n - r.state.slots[0]!.n;
    expect(sent === r.carries.filter((c) => c.slot === 0).length).toBe(true);
    expect(sent <= 2).toBe(true);
  });

  it('баночка встаёт в ячейку и уносит кубики по одному', () => {
    let s = newMosaic(5);
    const jar = s.columns[0]![0]!;
    s = tapJar(s, 0)!;
    expect(s.slots[0]?.id).toBe(jar.id);
    expect(s.columns[0]!.length).toBeGreaterThanOrEqual(0);
    const before = s.left;
    const r = stepMosaic(s);
    expect(r.carries.length).toBeLessThanOrEqual(2);
    // Кубик пропадает, когда питомец его взял.
    expect(r.state.left).toBe(before);
    expect(r.state.reserved.length).toBe(r.carries.length);
    const taken = r.carries.reduce((st, c) => pickCell(st, c.cell), r.state);
    expect(taken.left).toBe(before - r.carries.length);
  });

  it('нельзя взять баночку, когда все ячейки заняты', () => {
    const s = newMosaic(5);
    const jar = (id: number): { id: number; color: number; n: number } => ({ id, color: 0, n: 3 });
    const full = { ...s, slots: [jar(101), jar(102), jar(103), jar(104)], columns: [[jar(1)], [], [], []] };
    expect(tapJar(full, 0)).toBe(null);
  });

  it('связанные баночки берутся только вместе и уходят только вместе', () => {
    const s = newMosaic(5);
    const a = { id: 1, color: 0, n: 1, pair: 2 };
    const b = { id: 2, color: 3, n: 1, pair: 1 };
    const base = { ...s, columns: [[a], [b], [], []], slots: [null, null, null, null] as (typeof a | null)[] };
    // Одна свободная ячейка — пара не берётся.
    expect(tapJar({ ...base, slots: [{ id: 9, color: 0, n: 2 }, { id: 8, color: 0, n: 2 }, { id: 7, color: 0, n: 2 }, null] }, 0)).toBe(null);
    // Две свободные — берутся обе, из очереди пропадают обе, ячейки соседние.
    const took = tapJar(base, 0)!;
    expect(took.slots.filter((x) => x).length).toBe(2);
    expect(took.columns.flat().length).toBe(0);
    expect(took.slots[0]?.id).toBe(1);
    expect(took.slots[1]?.id).toBe(2);
    // Одна опустела — остаётся и ждёт вторую.
    const cells = s.cells.slice();
    const mid = { ...took, cells, slots: [{ ...a, n: 0 }, { ...b, n: 2 }, null, null] };
    const step = stepMosaic(mid).state;
    expect(step.slots[0]?.id).toBe(1);
    // Опустели обе — уходят обе.
    const both = stepMosaic({ ...mid, slots: [{ ...a, n: 0 }, { ...b, n: 0 }, null, null] }).state;
    expect(both.slots.every((x) => x === null)).toBe(true);
  });

  it('баночки в очередях иногда связаны парами, пары взаимны', () => {
    let pairs = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const jars = newMosaic(seed, 'cat_baby').columns.flat();
      for (const j of jars) {
        if (j.pair === undefined) continue;
        pairs++;
        expect(jars.find((o) => o.id === j.pair)?.pair).toBe(j.id);
      }
    }
    expect(pairs > 10).toBe(true);
  });

  it('партию можно выиграть, беря баночки подряд', () => {
    let s = newMosaic(11);
    for (let i = 0; i < 2000 && !s.won && !s.stuck; i++) {
      const col = s.columns.findIndex((c) => c.length > 0);
      if (col >= 0 && s.slots.includes(null)) s = tapJar(s, col) ?? s;
      const step = stepMosaic(s);
      s = step.carries.reduce((st, c) => pickCell(st, c.cell), step.state);
    }
    expect(s.won || s.stuck).toBe(true);
    if (s.won) expect(s.left).toBe(0);
  });

  it('exposedCells ближе к норке идут раньше', () => {
    const s = newMosaic(2);
    const list = exposedCells(s, 0);
    expect(list.length).toBeGreaterThan(0);
    expect(Math.floor(list[0]! / s.w)).toBeGreaterThanOrEqual(Math.floor(list[list.length - 1]! / s.w));
  });

  it('картинок с питомцами много, они крупнее сердечка, и каждую можно собрать', () => {
    const names = Object.keys(MOSAIC_PICTURES);
    expect(names.length >= 21).toBe(true);
    for (const name of names) {
      const rows = MOSAIC_PICTURES[name as keyof typeof MOSAIC_PICTURES];
      expect(rows.every((r) => r.length === rows[0]!.length)).toBe(true);
      expect([...rows.join('')].every((ch) => ch === '.' || (MOSAIC_COLORS as readonly string[]).includes(ch))).toBe(true);
      const s = newMosaic(11, name as keyof typeof MOSAIC_PICTURES);
      expect(s.left).toBe(rows.join('').replace(/\./g, '').length);
      MOSAIC_COLORS.forEach((_, color) => {
        const jars = s.columns.flat().filter((j) => j.color === color).reduce((a, j) => a + j.n, 0);
        expect(jars).toBe(s.cells.filter((c) => c === color).length);
      });
    }
    expect(Math.max(...names.map((n) => MOSAIC_PICTURES[n as keyof typeof MOSAIC_PICTURES][0]!.length)) >= 14).toBe(true);
  });

  it('питомец уносит ближайший к его ячейке кубик нужного цвета', () => {
    const base = newMosaic(1);
    const cells = Array.from({ length: 16 }, () => -1);
    cells[0] = 3;
    cells[7] = 3;
    const s = { ...base, w: 8, h: 2, cells, left: 2, reserved: [] };
    expect(exposedCells(s, 3, 0)[0]).toBe(0);
    expect(exposedCells(s, 3, 3)[0]).toBe(7);
  });

  it('освободившаяся ячейка слева: баночки справа сдвигаются влево', () => {
    const s = newMosaic(5);
    const cells = Array.from({ length: s.w * s.h }, () => -1);
    cells[0] = 3;
    const a = { id: 1, color: 3, n: 1 };
    const b = { id: 2, color: 3, n: 4 };
    const c = { id: 3, color: 3, n: 4 };
    const state = { ...s, cells, left: 1, reserved: [], columns: [[], [], [], []], slots: [a, b, c, null, null] };
    const next = stepMosaic(state).state;
    expect(next.slots.map((j) => j?.id ?? 0)).toEqual([2, 3, 0, 0, 0]);
  });

  it('кубик открывает соседей, только когда питомец его взял, а не когда за ним побежали', () => {
    const base = newMosaic(5);
    const cells = Array.from({ length: 9 }, () => 2);
    cells[4] = 5;
    const brown = { id: 1, color: 5, n: 1 };
    const state = { ...base, w: 3, h: 3, cells, left: 9, reserved: [7], columns: [[], [], [], []], slots: [brown, null, null, null, null] };
    // За нижним розовым уже бегут, но он ещё на месте: коричневый под ним закрыт.
    expect(exposedCells(state, 5, 0)).toEqual([]);
    // Питомец взял розовый — коричневый открылся.
    expect(exposedCells(pickCell(state, 7), 5, 0)).toEqual([4]);
  });
});
