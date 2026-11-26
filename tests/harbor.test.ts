import { describe, expect, it } from 'vitest';
import {
  advanceHarbor,
  fieldCounts,
  HARBOR_COLS,
  HARBOR_KINDS,
  HARBOR_NEED,
  HARBOR_PIER,
  HARBOR_ROWS,
  HARBOR_SHIPS,
  HARBOR_TRIPLES,
  newHarbor,
  tapHarborPet,
  type HarborState,
} from '../src/core/harbor';

function allPets(s: HarborState) {
  const pets = [...s.pier];
  s.field.forEach((i) => i && pets.push(...i.pets));
  s.deck.forEach((i) => pets.push(...i.pets));
  return pets;
}

/** Простая стратегия: сначала тех, для кого есть корабль, потом самых многочисленных. */
function play(seed: number): HarborState {
  let s = newHarbor(seed);
  for (let step = 0; step < 3000 && !s.won && !s.stuck; step++) {
    for (let i = 0; i < 6; i++) s = advanceHarbor(s);
    if (s.won || s.stuck) break;
    const open = new Set(s.ships.filter((x) => x !== null).map((x) => x!.kind));
    const counts = fieldCounts(s);
    const cands: Array<{ island: number; pet: number; kind: number }> = [];
    s.field.forEach((isl) => isl?.pets.forEach((p) => cands.push({ island: isl.id, pet: p.id, kind: p.kind })));
    if (cands.length === 0) continue;
    cands.sort((a, b) => Number(open.has(b.kind)) - Number(open.has(a.kind)) || counts[b.kind]! - counts[a.kind]!);
    const next = tapHarborPet(s, cands[0]!.island, cands[0]!.pet);
    if (next) s = next;
    else break;
  }
  return s;
}

describe('бухта питомцев', () => {
  it('всех питомцев поровну, каждого вида кратно трём', () => {
    for (const seed of [1, 5, 77]) {
      const s = newHarbor(seed);
      expect(allPets(s).length).toBe(HARBOR_KINDS * HARBOR_TRIPLES * HARBOR_NEED);
      expect(s.total).toBe(allPets(s).length);
      for (let k = 0; k < HARBOR_KINDS; k++) expect(allPets(s).filter((p) => p.kind === k).length).toBe(HARBOR_TRIPLES * HARBOR_NEED);
    }
  });

  it('на старте три ряда островов и корабли разных видов', () => {
    const s = newHarbor(3);
    expect(s.field.slice(0, HARBOR_COLS * (HARBOR_ROWS - 1)).every((i) => i !== null)).toBe(true);
    expect(s.field.slice(HARBOR_COLS * (HARBOR_ROWS - 1)).every((i) => i === null)).toBe(true);
    const kinds = s.ships.filter((x) => x !== null).map((x) => x!.kind);
    expect(kinds.length).toBe(HARBOR_SHIPS);
    expect(new Set(kinds).size).toBe(HARBOR_SHIPS);
  });

  it('размеры островов близки к 5/40/40/15 процентов', () => {
    const sizes = [0, 0, 0, 0];
    for (let seed = 1; seed <= 60; seed++) {
      const s = newHarbor(seed);
      [...s.field, ...s.deck].forEach((i) => i && sizes[i.pets.length - 1]!++);
    }
    const total = sizes.reduce((a, b) => a + b, 0);
    const pct = sizes.map((n) => (n / total) * 100);
    expect(pct[0]! > 2 && pct[0]! < 10).toBe(true);
    expect(pct[1]! > 32 && pct[1]! < 48).toBe(true);
    expect(pct[2]! > 32 && pct[2]! < 48).toBe(true);
    expect(pct[3]! > 9 && pct[3]! < 22).toBe(true);
  });

  it('питомец с кораблём плывёт на корабль, без корабля — на пристань', () => {
    const s = newHarbor(4);
    const shipKinds = new Set(s.ships.map((x) => x!.kind));
    const island = s.field.find((i) => i && i.pets.some((p) => shipKinds.has(p.kind)))!;
    const onShip = island.pets.find((p) => shipKinds.has(p.kind))!;
    const a = tapHarborPet(s, island.id, onShip.id)!;
    expect(a.pier.length).toBe(0);
    expect(a.ships.find((x) => x?.kind === onShip.kind)?.count).toBe(1);
    const other = s.field.find((i) => i && i.pets.some((p) => !shipKinds.has(p.kind)))!;
    const waiting = other.pets.find((p) => !shipKinds.has(p.kind))!;
    const b = tapHarborPet(s, other.id, waiting.id)!;
    expect(b.pier.length).toBe(1);
    expect(b.pier[0]!.id).toBe(waiting.id);
  });

  it('когда появляется корабль, ждавшие на пристани пересаживаются на него', () => {
    let s = newHarbor(9);
    // Найдём вид без корабля и отправим трёх таких на пристань.
    const open = new Set(s.ships.map((x) => x!.kind));
    const kind = [...Array(HARBOR_KINDS).keys()].find((k) => !open.has(k) && fieldCounts(s)[k]! >= 3)!;
    const pets: Array<[number, number]> = [];
    s.field.forEach((i) => i?.pets.forEach((p) => p.kind === kind && pets.push([i.id, p.id])));
    for (const [i, p] of pets.slice(0, 3)) s = tapHarborPet(s, i, p)!;
    expect(s.pier.filter((p) => p.kind === kind).length + s.deliveredByKind[kind]! / 1).toBeGreaterThan(0);
    // Освободим корабль: достроим любой.
    for (let guard = 0; guard < 80 && s.ships.every((x) => x?.kind !== kind) && s.pier.some((p) => p.kind === kind); guard++) {
      const sh = s.ships.find((x) => x)!;
      let found: [number, number] | null = null;
      s.field.forEach((i) => i?.pets.forEach((p) => !found && p.kind === sh.kind && (found = [i.id, p.id])));
      if (!found) {
        s = advanceHarbor(s);
        continue;
      }
      s = tapHarborPet(s, found[0], found[1]) ?? s;
    }
    const ship = s.ships.find((x) => x?.kind === kind);
    expect(ship !== undefined || s.deliveredByKind[kind]! > 0).toBe(true);
  });

  it('пристань полна и корабля нет — нажатие отклоняется', () => {
    let s = newHarbor(11);
    const open = new Set(s.ships.map((x) => x!.kind));
    const tapped: number[] = [];
    s.field.forEach((i) =>
      i?.pets.forEach((p) => {
        if (!open.has(p.kind) && s.pier.length < HARBOR_PIER && !s.won) {
          const n = tapHarborPet(s, i.id, p.id);
          if (n && n.pier.length > s.pier.length) {
            s = n;
            tapped.push(p.id);
          }
        }
      }),
    );
    expect(s.pier.length <= HARBOR_PIER).toBe(true);
    if (s.pier.length === HARBOR_PIER) {
      const extra = s.field.flatMap((i) => (i ? i.pets.map((p) => [i.id, p] as const) : [])).find(([, p]) => !s.ships.some((x) => x?.kind === p.kind));
      if (extra) expect(tapHarborPet(s, extra[0], extra[1].id)).toBe(null);
    }
  });

  it('острова поднимаются и снизу всплывает новый', () => {
    let s = newHarbor(2);
    const before = s.deck.length;
    s = advanceHarbor(s);
    expect(s.deck.length).toBe(before - 1);
    expect(s.field.slice((HARBOR_ROWS - 1) * HARBOR_COLS).some((i) => i !== null)).toBe(true);
  });

  it('пустой остров исчезает, остальные занимают освободившееся место', () => {
    let s = newHarbor(6);
    const target = s.field[0]!;
    const ids = target.pets.map((p) => p.id);
    // Освободим остров: отправим всех питомцев (на пристань или корабли), пока можно.
    for (const id of ids) s = tapHarborPet(s, target.id, id) ?? s;
    if (!s.field.some((i) => i?.id === target.id)) {
      const below = s.field[HARBOR_COLS]!;
      s = advanceHarbor(s);
      expect(s.field[0]?.id).toBe(below.id);
    }
  });

  it('простая стратегия выигрывает почти всегда и счётчик сходится', () => {
    let wins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = play(seed);
      if (s.won) {
        wins++;
        expect(s.delivered).toBe(s.total);
        expect(s.pier.length).toBe(0);
      }
    }
    expect(wins >= 32).toBe(true);
  });
});
