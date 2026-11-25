import { describe, expect, it } from 'vitest';
import {
  canMove,
  fullRows,
  moveRange,
  newSlideGame,
  occupancy,
  settle,
  slide,
  SLIDE_SIZE,
  type Block,
  type SlideState,
} from '../src/core/slide';

function noOverlap(blocks: readonly Block[]): void {
  const seen = new Set<string>();
  for (const b of blocks) {
    expect(b.col).toBeGreaterThanOrEqual(0);
    expect(b.col + b.len).toBeLessThanOrEqual(SLIDE_SIZE);
    for (let c = b.col; c < b.col + b.len; c++) {
      const k = `${b.row},${c}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  }
}

function stable(blocks: Block[]): void {
  expect(settle(blocks.map((b) => ({ ...b })))).toBe(false);
  expect(fullRows(blocks)).toEqual([]);
}

/** Любой возможный ход (первый подходящий). */
function anyMove(s: SlideState): [number, number] | null {
  for (const b of s.blocks) {
    const [min, max] = moveRange(s, b.id);
    for (let c = min; c <= max; c++) if (c !== b.col) return [b.id, c];
  }
  return null;
}

const bl = (id: number, row: number, col: number, len: number, treat = false): Block => ({ id, row, col, len, color: 0, treat });

describe('Питомцы-блоки', () => {
  it('новая игра: три нижние полосы, без пересечений, ничего не висит, полос целиком нет', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = newSlideGame(seed * 7919);
      noOverlap(s.blocks);
      stable(s.blocks);
      expect(Math.min(...s.blocks.map((b) => b.row))).toBeGreaterThanOrEqual(SLIDE_SIZE - 3);
      expect(s.next.length).toBeGreaterThan(0);
      expect(s.over).toBe(false);
    }
  });

  it('детерминирована по seed', () => {
    expect(newSlideGame(42)).toEqual(newSlideGame(42));
  });

  it('блок двигается только по свободным клеткам своей полосы', () => {
    const s = { ...newSlideGame(1), blocks: [bl(1, 9, 0, 2), bl(2, 9, 5, 3)] };
    expect(moveRange(s, 1)).toEqual([0, 3]);
    expect(moveRange(s, 2)).toEqual([2, 7]);
    expect(slide(s, 1, 4)).toBeNull(); // перепрыгнуть соседа нельзя
    expect(slide(s, 1, 0)).toBeNull(); // ход на месте — не ход
    expect(slide(s, 1, 3)).not.toBeNull();
  });

  it('висящий блок падает, заполненная полоса исчезает, верхние опускаются', () => {
    const blocks = [bl(1, 9, 0, 4), bl(2, 9, 6, 4), bl(3, 8, 4, 2), bl(4, 7, 0, 3)];
    const s: SlideState = { ...newSlideGame(3), blocks, nextId: 10 };
    // Сдвигаем... блок 3 стоит в дырке? нет: дырка в полосе 9 — клетки 4–5, блок 3 над ней.
    expect(settle(s.blocks.map((b) => ({ ...b })))).toBe(true);
    const r = slide(s, 4, 7)!;
    expect(r).not.toBeNull();
    // Блок 3 упал в дырку, полоса 9 исчезла; блок 4 опустился на дно.
    expect(r.state.lines).toBeGreaterThanOrEqual(1);
    expect(r.frames.some((f) => f.clearing.includes(1) && f.clearing.includes(3))).toBe(true);
    noOverlap(r.state.blocks);
    stable(r.state.blocks);
  });

  it('за убранный блок с лакомством — лакомство', () => {
    // Двойной блок сверху сдвигаем к дырке — он падает, нижняя полоса заполняется.
    const blocks = [bl(1, 9, 0, 4, true), bl(2, 9, 6, 4), bl(3, 8, 6, 2)];
    const s: SlideState = { ...newSlideGame(5), blocks, nextId: 10 };
    const r = slide(s, 3, 4)!;
    expect(r.state.treats).toBe(1);
    expect(r.frames.find((f) => f.clearing.length > 0)?.treatsEarned).toBe(1);
  });

  it('после хода сверху падает новая полоса', () => {
    const s = newSlideGame(11);
    const [id, col] = anyMove(s)!;
    const r = slide(s, id, col)!;
    expect(r.frames.some((f) => f.spawned.length > 0)).toBe(true);
    expect(r.state.moves).toBe(1);
    expect(r.state.next).not.toBe(s.next);
  });

  it('стопка до верха — игра окончена, дальше ходить нельзя', () => {
    // Полосы 2–9: блоки 0–3 и 5–8 (дырки в 4 и 9). Полоса 1: блоки 0–3 и 4–7.
    const blocks: Block[] = [bl(1, 1, 0, 4), bl(2, 1, 4, 4)];
    let id = 3;
    for (let row = 2; row < SLIDE_SIZE; row++) blocks.push(bl(id++, row, 0, 4), bl(id++, row, 5, 4));
    const next = [
      { col: 0, len: 4, color: 0, treat: false },
      { col: 4, len: 4, color: 0, treat: false },
    ];
    const s: SlideState = { ...newSlideGame(7), blocks, next, nextId: id };
    const r = slide(s, 2, 6)!; // сдвигаем блок полосы 1 вправо — он не падает
    expect(r.state.over).toBe(true);
    expect(anyMove(r.state) === null || slide(r.state, ...anyMove(r.state)!) === null).toBe(true);
  });

  it('лакомство появляется раз в 15–20 полос', () => {
    // Каждый ход очищаем поле до одного блока — партия не кончается, считаем полосы.
    let s = newSlideGame(99);
    const treatRows: number[] = [];
    for (let i = 0; i < 120; i++) {
      if (s.next.some((b) => b.treat)) treatRows.push(s.rowsMade);
      s = slide({ ...s, blocks: [bl(1, 9, 0, 1)], nextId: 1000 + i * 20 }, 1, 1)!.state;
    }
    expect(treatRows.length).toBeGreaterThanOrEqual(5);
    expect(treatRows[0]!).toBeLessThanOrEqual(20);
    for (let i = 1; i < treatRows.length; i++) {
      const gap = treatRows[i]! - treatRows[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(15);
      expect(gap).toBeLessThanOrEqual(20);
    }
  });

  it('длинная случайная партия: поле всегда корректно', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let s = newSlideGame(seed);
      for (let i = 0; i < 150 && !s.over; i++) {
        const movable = s.blocks.filter((b) => canMove(s, b.id));
        expect(movable.length).toBeGreaterThan(0);
        const b = movable[(i * 7 + seed) % movable.length]!;
        const [min, max] = moveRange(s, b.id);
        const col = b.col === max ? min : max;
        const r = slide(s, b.id, col)!;
        s = r.state;
        noOverlap(s.blocks);
        stable(s.blocks);
        expect(occupancy(s.blocks)[0]!.some((x) => x !== -1)).toBe(s.over);
      }
    }
  });
});
