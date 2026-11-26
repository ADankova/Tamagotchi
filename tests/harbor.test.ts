import { describe, expect, it } from 'vitest';
import {
  advanceHarbor,
  fieldCounts,
  HARBOR_RADIUS,
  islandRadius,
  HARBOR_KINDS,
  HARBOR_NEED,
  HARBOR_PIER,
  HARBOR_SHIPS,
  HARBOR_TRIPLES,
  newHarbor,
  tapHarborPet,
  type HarborState,
} from '../src/core/harbor';

function allPets(s: HarborState) {
  const pets = [...s.pier];
  s.field.forEach((i) => pets.push(...i.pets));
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
    s.field.forEach((isl) => isl.pets.forEach((p) => cands.push({ island: isl.id, pet: p.id, kind: p.kind })));
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

  it('на старте на воде несколько островов и корабли разных видов, острова не налезают друг на друга', () => {
    const s = newHarbor(3);
    expect(s.field.length >= 6).toBe(true);
    for (const a of s.field) {
      const r = islandRadius(a);
      expect(a.x - r >= 0 && a.x + r <= 1 && a.y - r >= 0).toBe(true);
      for (const b of s.field) {
        if (a.id !== b.id) expect(Math.hypot(a.x - b.x, a.y - b.y) >= r + islandRadius(b)).toBe(true);
      }
    }
    const kinds = s.ships.filter((x) => x !== null).map((x) => x!.kind);
    expect(kinds.length).toBe(HARBOR_SHIPS);
    expect(new Set(kinds).size).toBe(HARBOR_SHIPS);
  });

  it('размер острова зависит от числа питомцев', () => {
    expect(islandRadius({ pets: [1] }) < islandRadius({ pets: [1, 2] })).toBe(true);
    expect(islandRadius({ pets: [1, 2] }) < islandRadius({ pets: [1, 2, 3] })).toBe(true);
    expect(islandRadius({ pets: [1, 2, 3] }) < islandRadius({ pets: [1, 2, 3, 4] })).toBe(true);
    expect(HARBOR_RADIUS.length).toBe(4);
  });

  it('размеры островов близки к 5/40/40/15 процентов', () => {
    const sizes = [0, 0, 0, 0];
    for (let seed = 1; seed <= 60; seed++) {
      const s = newHarbor(seed);
      [...s.field, ...s.deck].forEach((i) => sizes[i.pets.length - 1]!++);
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
    const island = s.field.find((i) => i.pets.some((p) => shipKinds.has(p.kind)))!;
    const onShip = island.pets.find((p) => shipKinds.has(p.kind))!;
    const a = tapHarborPet(s, island.id, onShip.id)!;
    expect(a.pier.length).toBe(0);
    expect(a.ships.find((x) => x?.kind === onShip.kind)?.count).toBe(1);
    const other = s.field.find((i) => i.pets.some((p) => !shipKinds.has(p.kind)))!;
    const waiting = other.pets.find((p) => !shipKinds.has(p.kind))!;
    const b = tapHarborPet(s, other.id, waiting.id)!;
    expect(b.pier.length).toBe(1);
    expect(b.pier[0]!.id).toBe(waiting.id);
  });

  it('когда появляется корабль, ждавшие на пристани пересаживаются на него', () => {
    let hops = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let s = newHarbor(seed);
      for (let step = 0; step < 400 && !s.won && !s.stuck; step++) {
        for (let i = 0; i < 4; i++) s = advanceHarbor(s);
        const open = new Set(s.ships.filter((x) => x !== null).map((x) => x!.kind));
        // Пока на пристани мало народу, отправляем тех, у кого нет корабля; потом достраиваем корабли.
        const cands = s.field.flatMap((i) => i.pets.map((p) => ({ i: i.id, p: p.id, k: p.kind })));
        const waitFirst = s.pier.length < 3 ? 1 : -1;
        cands.sort((a, b) => waitFirst * (Number(open.has(a.k)) - Number(open.has(b.k))));
        const c = cands[0];
        if (!c) continue;
        const before = s.pier.length;
        const next = tapHarborPet(s, c.i, c.p);
        if (!next) break;
        const wasOnPier = next.pier.length > before;
        if (!wasOnPier && next.pier.length < before) {
          hops++;
          // Пересевшие питомцы встали на корабль своего вида.
          const moved = s.pier.filter((p) => !next.pier.some((q) => q.id === p.id));
          for (const m of moved) expect(next.ships.some((x) => x?.kind === m.kind) || next.deliveredByKind[m.kind]! > s.deliveredByKind[m.kind]!).toBe(true);
        }
        s = next;
      }
    }
    expect(hops > 0).toBe(true);
  });

  it('пристань полна и корабля нет — нажатие отклоняется', () => {
    let s = newHarbor(11);
    const open = new Set(s.ships.map((x) => x!.kind));
    const tapped: number[] = [];
    s.field.forEach((i) =>
      i.pets.forEach((p) => {
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
      const extra = s.field.flatMap((i) => i.pets.map((p) => [i.id, p] as const)).find(([, p]) => !s.ships.some((x) => x?.kind === p.kind));
      if (extra) expect(tapHarborPet(s, extra[0], extra[1].id)).toBe(null);
    }
  });

  it('острова поднимаются, а снизу всплывает новый, когда есть место', () => {
    let s = newHarbor(2);
    const deckBefore = s.deck.length;
    // Освобождаем воду: отправляем питомцев на пристань и корабли, пока можно.
    for (let k = 0; k < 6; k++) {
      const island = s.field[0];
      const pet = island?.pets[0];
      if (island && pet) s = tapHarborPet(s, island.id, pet.id) ?? s;
    }
    for (let i = 0; i < 60; i++) s = advanceHarbor(s);
    expect(s.deck.length < deckBefore || s.field.length > 0).toBe(true);
    expect(s.field.every((i) => i.y - islandRadius(i) >= 0)).toBe(true);
  });

  it('пустой остров исчезает, остальные поднимаются на освободившееся место', () => {
    let s = newHarbor(6);
    const target = s.field.slice().sort((a, b) => a.y - b.y)[0]!;
    const ids = target.pets.map((p) => p.id);
    for (const id of ids) s = tapHarborPet(s, target.id, id) ?? s;
    if (!s.field.some((i) => i.id === target.id)) {
      const lowest = s.field.slice().sort((a, b) => b.y - a.y)[0]!;
      const y0 = lowest.y;
      for (let i = 0; i < 30; i++) s = advanceHarbor(s);
      const same = s.field.find((i) => i.id === lowest.id);
      expect(same === undefined || same.y < y0).toBe(true);
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
