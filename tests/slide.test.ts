import { describe, expect, it } from 'vitest';
import {
  canMove,
  fullRows,
  moveRange,
  newSlideGame,
  occupancy,
  settle,
  slide,
  SLIDE_COLS,
  SLIDE_ROWS,
  useCrumbs,
  useFreeze,
  CRUMB_SIZE,
  FREEZE_MOVES,
  type Block,
  type SlideState,
} from '../src/core/slide';

function noOverlap(blocks: readonly Block[]): void {
  const seen = new Set<string>();
  for (const b of blocks) {
    expect(b.col).toBeGreaterThanOrEqual(0);
    expect(b.col + b.len).toBeLessThanOrEqual(SLIDE_COLS);
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

const bl = (id: number, row: number, col: number, len: number, treat = false, bonus?: Block['bonus']): Block => ({
  id,
  row,
  col,
  len,
  color: 0,
  treat,
  ...(bonus ? { bonus } : {}),
});

describe('Питомцы-блоки', () => {
  it('новая игра: три нижние полосы, без пересечений, ничего не висит, полос целиком нет', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = newSlideGame(seed * 7919);
      noOverlap(s.blocks);
      stable(s.blocks);
      expect(Math.min(...s.blocks.map((b) => b.row))).toBeGreaterThanOrEqual(SLIDE_ROWS - 3);
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
    expect(moveRange(s, 2)).toEqual([2, 5]);
    expect(slide(s, 1, 4)).toBeNull(); // перепрыгнуть соседа нельзя
    expect(slide(s, 1, 0)).toBeNull(); // ход на месте — не ход
    expect(slide(s, 1, 3)).not.toBeNull();
  });

  it('висящий блок падает, заполненная полоса исчезает, верхние опускаются', () => {
    const blocks = [bl(1, 9, 0, 3), bl(2, 9, 5, 3), bl(3, 8, 3, 2), bl(4, 7, 0, 3)];
    const s: SlideState = { ...newSlideGame(3), blocks, nextId: 10 };
    // Дырка в полосе 9 — клетки 3–4, блок 3 висит над ней.
    expect(settle(s.blocks.map((b) => ({ ...b })))).toBe(true);
    const r = slide(s, 4, 5)!;
    expect(r).not.toBeNull();
    // Блок 3 упал в дырку, полоса 9 исчезла; блок 4 опустился на дно.
    expect(r.state.lines).toBeGreaterThanOrEqual(1);
    expect(r.frames.some((f) => f.clearing.includes(1) && f.clearing.includes(3))).toBe(true);
    noOverlap(r.state.blocks);
    stable(r.state.blocks);
  });

  it('за убранный блок с лакомством — лакомство', () => {
    // Двойной блок сверху сдвигаем к дырке — он падает, нижняя полоса заполняется.
    const blocks = [bl(1, 9, 0, 3, true), bl(2, 9, 5, 3), bl(3, 8, 5, 2)];
    const s: SlideState = { ...newSlideGame(5), blocks, nextId: 10 };
    const r = slide(s, 3, 3)!;
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
    // Полосы 2–9: блоки 0–3 и 5–7 (дырка в 4). Полоса 1: блоки 0–2 и 4–6.
    const blocks: Block[] = [bl(1, 1, 0, 3), bl(2, 1, 4, 3)];
    let id = 3;
    for (let row = 2; row < SLIDE_ROWS; row++) blocks.push(bl(id++, row, 0, 4), bl(id++, row, 5, 3));
    const next = [
      { col: 0, len: 3, color: 0, treat: false },
      { col: 4, len: 3, color: 0, treat: false },
    ];
    const s: SlideState = { ...newSlideGame(7), blocks, next, nextId: id };
    const r = slide(s, 2, 5)!; // сдвигаем блок полосы 1 вправо — он не падает
    expect(r.state.over).toBe(true);
    expect(anyMove(r.state) === null || slide(r.state, ...anyMove(r.state)!) === null).toBe(true);
  });

  it('лакомство появляется раз в 10–15 полос', () => {
    // Каждый ход очищаем поле до одного блока — партия не кончается, считаем полосы.
    let s = newSlideGame(99);
    const treatRows: number[] = [];
    for (let i = 0; i < 120; i++) {
      if (s.next.some((b) => b.treat)) treatRows.push(s.rowsMade);
      s = slide({ ...s, blocks: [bl(1, 9, 0, 1)], nextId: 1000 + i * 20 }, 1, 1)!.state;
    }
    expect(treatRows.length).toBeGreaterThanOrEqual(5);
    expect(treatRows[0]!).toBeLessThanOrEqual(15);
    for (let i = 1; i < treatRows.length; i++) {
      const gap = treatRows[i]! - treatRows[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(10);
      expect(gap).toBeLessThanOrEqual(15);
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

describe('бонусы «Питомцев-блоков»', () => {
  /** Поле пустеет каждый ход — партия не кончается, считаем полосы с бонусами. */
  function bonusRows(seed: number, moves: number) {
    let s = newSlideGame(seed);
    const rows: Array<{ at: number; bonus: string; sameTreat: boolean }> = [];
    for (let i = 0; i < moves; i++) {
      const b = s.next.find((x) => x.bonus);
      if (b) rows.push({ at: s.rowsMade, bonus: b.bonus!, sameTreat: b.treat });
      s = slide({ ...s, blocks: [bl(1, 9, 0, 1)], nextId: 1000 + i * 20 }, 1, 1)!.state;
    }
    return rows;
  }

  it('бонус появляется раз в 3–5 полос, случайный, и не на блоке с лакомством', () => {
    const rows = bonusRows(7, 200);
    expect(rows.length).toBeGreaterThan(20);
    expect(rows[0]!.at).toBeLessThanOrEqual(6);
    for (let i = 1; i < rows.length; i++) {
      const gap = rows[i]!.at - rows[i - 1]!.at;
      expect(gap).toBeGreaterThanOrEqual(3);
      expect(gap).toBeLessThanOrEqual(5);
    }
    expect(new Set(rows.map((r) => r.bonus))).toEqual(new Set(['freeze', 'lightning', 'crumbs']));
    expect(rows.some((r) => r.sameTreat)).toBe(false);
  });

  it('заморозка: запас, три хода без новых полос, потом полосы падают снова', () => {
    const base: SlideState = { ...newSlideGame(5), blocks: [bl(1, 9, 0, 2), bl(2, 9, 5, 2)], nextId: 10, freezes: 1 };
    expect(useFreeze({ ...base, freezes: 0 })).toBeNull();
    let s = useFreeze(base)!;
    expect(s.freezes).toBe(0);
    expect(s.frozen).toBe(FREEZE_MOVES);
    const moves: Array<[number, number]> = [[1, 1], [1, 0], [1, 1]];
    for (const [id, col] of moves) {
      const r = slide(s, id, col)!;
      expect(r.frames.every((f) => f.spawned.length === 0)).toBe(true);
      s = r.state;
    }
    expect(s.frozen).toBe(0);
    expect(s.blocks).toHaveLength(2);
    const r = slide(s, 1, 0)!;
    expect(r.frames.some((f) => f.spawned.length > 0)).toBe(true);
  });

  it('молния: вместе с полосой исчезают блоки, касавшиеся её сверху и снизу', () => {
    const blocks = [
      bl(1, 9, 0, 4, false, 'lightning'),
      bl(2, 9, 6, 4),
      bl(4, 8, 6, 2),
      bl(5, 8, 0, 2), // сидит на молнии
      bl(6, 7, 0, 2), // выше — молнии не касается
      bl(7, 8, 3, 1, true), // тоже касается молнии, с лакомством
    ];
    const s: SlideState = { ...newSlideGame(5), blocks, nextId: 10 };
    const r = slide(s, 4, 4)!;
    const clearing = r.frames.find((f) => f.clearing.length > 0)!;
    expect([...clearing.clearing].sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 7]);
    expect(clearing.bolts).toEqual([1]);
    expect(clearing.lines).toBe(1);
    expect(r.state.lines).toBe(1);
    expect(r.state.treats).toBe(1);
    // Блок 6 жив и упал вниз.
    expect(r.state.blocks.find((b) => b.id === 6)?.row).toBe(9);
    noOverlap(r.state.blocks);
  });

  it('молния снизу тоже работает', () => {
    const blocks = [
      bl(1, 8, 0, 4, false, 'lightning'),
      bl(2, 8, 6, 4),
      bl(3, 7, 6, 2),
      bl(4, 9, 0, 2), // под молнией
      bl(5, 9, 5, 2), // вне её клеток
    ];
    const s: SlideState = { ...newSlideGame(5), blocks, nextId: 10 };
    const r = slide(s, 3, 4)!; // падает в дырку полосы 8
    const clearing = r.frames.find((f) => f.clearing.length > 0)!;
    expect(clearing.clearing.includes(4)).toBe(true);
    expect(clearing.clearing.includes(5)).toBe(false);
  });

  it('заморозка и крошки с исчезнувшего блока уходят в запас', () => {
    const blocks = [
      bl(1, 9, 0, 4, false, 'freeze'),
      bl(2, 9, 6, 4, false, 'crumbs'),
      bl(3, 8, 6, 2),
    ];
    const s: SlideState = { ...newSlideGame(5), blocks, nextId: 10 };
    const r = slide(s, 3, 4)!;
    expect(r.state.freezes).toBe(1);
    expect(r.state.crumbs).toBe(1);
    expect(r.frames.find((f) => f.clearing.length > 0)?.bonusesEarned.sort()).toEqual(['crumbs', 'freeze']);
  });

  it('крошки: внутри поля 3×3 блоки становятся одиночными, занятые клетки те же', () => {
    const blocks = [bl(1, 9, 2, 5, true), bl(2, 8, 4, 2, false, 'freeze'), bl(3, 9, 7, 1)];
    const s: SlideState = { ...newSlideGame(5), blocks, nextId: 10, crumbs: 1 };
    expect(useCrumbs({ ...s, crumbs: 0 })).toBeNull();
    const r = useCrumbs(s)!;
    expect(r.state.crumbs).toBe(0);
    expect(r.state.moves).toBe(s.moves);
    expect(r.frames).toHaveLength(1);
    const area = r.frames[0]!.crumbArea!;
    noOverlap(r.state.blocks);
    for (const b of r.state.blocks) {
      const inside = b.row >= area.row && b.row < area.row + CRUMB_SIZE && b.col >= area.col && b.col + b.len <= area.col + CRUMB_SIZE;
      if (inside) expect(b.len).toBe(1);
    }
    // Ни одна занятая клетка не пропала и не добавилась.
    const cells = (bs: readonly Block[]) => bs.flatMap((b) => Array.from({ length: b.len }, (_, i) => `${b.row},${b.col + i}`)).sort();
    expect(cells(r.state.blocks)).toEqual(cells(blocks));
    // Лакомство осталось на левом куске блока.
    expect(r.state.blocks.filter((b) => b.treat)).toHaveLength(1);
    expect(r.state.blocks.filter((b) => b.bonus === 'freeze')).toHaveLength(1);
  });

  it('крошки: если длинных блоков нет — разбивать нечего', () => {
    const s: SlideState = { ...newSlideGame(5), blocks: [bl(1, 9, 0, 1), bl(2, 9, 4, 1)], nextId: 10, crumbs: 1 };
    expect(useCrumbs(s)).toBeNull();
  });
});

describe('режим «Прилив»', () => {
  it('новая полоса вырастает снизу и поднимает стопку', () => {
    const s: SlideState = { ...newSlideGame(3, 'rise'), blocks: [bl(1, 9, 0, 2), bl(2, 9, 5, 2)], nextId: 10 };
    expect(s.mode).toBe('rise');
    const r = slide(s, 1, 1)!;
    const spawned = r.frames.find((f) => f.spawned.length > 0)!;
    expect(spawned.blocks.filter((b) => spawned.spawned.includes(b.id)).every((b) => b.row === 9)).toBe(true);
    // Старые блоки стоят выше нового ряда (или упали в его дырки).
    const old = r.state.blocks.filter((b) => b.id < 10);
    expect(old.every((b) => b.row <= 9)).toBe(true);
    expect(r.state.blocks.some((b) => b.row === 9)).toBe(true);
    noOverlap(r.state.blocks);
    stable(r.state.blocks);
  });

  it('игра кончается, когда стопка доходит до верхней линии', () => {
    let s = newSlideGame(5, 'rise');
    for (let i = 0; i < 400 && !s.over; i++) {
      const move = anyMove(s);
      if (!move) break;
      s = slide(s, ...move)!.state;
      noOverlap(s.blocks);
      stable(s.blocks);
      expect(occupancy(s.blocks)[0]!.some((x) => x !== -1)).toBe(s.over);
    }
    expect(s.over).toBe(true);
  });

  it('детерминирована по seed и режиму', () => {
    expect(newSlideGame(42, 'rise')).toEqual(newSlideGame(42, 'rise'));
    expect(newSlideGame(42, 'rise').mode).toBe('rise');
  });
});
