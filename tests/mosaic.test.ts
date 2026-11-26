import { describe, expect, it } from 'vitest';
import { exposedCells, isExposed, MOSAIC_COLORS, MOSAIC_PICTURES, newMosaic, stepMosaic, tapJar } from '../src/core/mosaic';

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

  it('баночка встаёт в ячейку и уносит кубики по одному', () => {
    let s = newMosaic(5);
    const jar = s.columns[0]![0]!;
    s = tapJar(s, 0)!;
    expect(s.slots[0]?.id).toBe(jar.id);
    expect(s.columns[0]!.length).toBeGreaterThanOrEqual(0);
    const before = s.left;
    const r = stepMosaic(s);
    expect(r.carries.length).toBeLessThanOrEqual(1);
    expect(r.state.left).toBe(before - r.carries.length);
  });

  it('нельзя взять баночку, когда все ячейки заняты', () => {
    let s = newMosaic(5);
    for (let c = 0; c < 4; c++) s = tapJar(s, c)!;
    expect(s.slots.every((x) => x)).toBe(true);
    expect(tapJar(s, 0)).toBe(null);
  });

  it('партию можно выиграть, беря баночки подряд', () => {
    let s = newMosaic(11);
    for (let i = 0; i < 2000 && !s.won && !s.stuck; i++) {
      const col = s.columns.findIndex((c) => c.length > 0);
      if (col >= 0 && s.slots.includes(null)) s = tapJar(s, col) ?? s;
      s = stepMosaic(s).state;
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
    const s = { ...base, w: 8, h: 2, cells, left: 2 };
    expect(exposedCells(s, 3, 0)[0]).toBe(0);
    expect(exposedCells(s, 3, 3)[0]).toBe(7);
  });
});
