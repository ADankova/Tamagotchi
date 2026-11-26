import { randomSeed } from '../core/rng';
import {
  advanceHarbor,
  HARBOR_H,
  islandRadius,
  HARBOR_NEED,
  HARBOR_PIER,
  HARBOR_REWARD,
  newHarbor,
  tapHarborPet,
  type HarborIsland,
  type HarborPet,
  type HarborShip,
  type HarborState,
} from '../core/harbor';
import type { Species } from '../core/types';
import { GAMES_TEXT } from '../strings';
import { el } from './dom';
import type { GameScreen, MiniGameHost } from './minigames';
import { portrait } from './petArt';
import type { BodyStage } from './species';

// Экран «Бухты питомцев»: корабли сверху, пристань, острова, которые всплывают снизу.

const WATER_STEP_MS = 450;
const FLY_MS = 480;
/** Корабль уплывает вверх; новый появляется, когда он уже пропал. */
const SAIL_MS = 800;

interface Kind {
  species: Species;
  body: BodyStage;
  /** Цветная окантовка: по ней вид виден даже мельком. */
  ring: string;
}

/** Девять видов: три зверя в трёх возрастах (взрослый выглядит как подросток, его не берём). */
const KINDS: readonly Kind[] = [
  { species: 'cat', body: 'teen', ring: '#5aaef0' },
  { species: 'dog', body: 'teen', ring: '#e8505b' },
  { species: 'blob', body: 'teen', ring: '#ff9fc8' },
  { species: 'cat', body: 'baby', ring: '#ffc94d' },
  { species: 'dog', body: 'baby', ring: '#5fce85' },
  { species: 'blob', body: 'baby', ring: '#a98af0' },
  { species: 'cat', body: 'child', ring: '#ff9a52' },
  { species: 'dog', body: 'child', ring: '#43cfc4' },
  { species: 'blob', body: 'child', ring: '#b5d94a' },
];

/** Где стоят питомцы в пузыре (в процентах пузыря) и какой доли пузыря размером питомец, по числу питомцев. */
const SPOTS: readonly (readonly [number, number][])[] = [
  [[50, 52]],
  [
    [30, 52],
    [70, 52],
  ],
  [
    [50, 32],
    [29, 67],
    [71, 67],
  ],
  [
    [31, 32],
    [69, 32],
    [31, 68],
    [69, 68],
  ],
];
const PET_SIZE = [58, 44, 40, 38] as const;

interface HarborCallbacks {
  header: (title: string) => HTMLElement;
  replay: () => void;
  done: () => void;
}

function petFace(kind: number, label: string): HTMLElement {
  const k = KINDS[kind % KINDS.length]!;
  const face = el('span', { class: 'h-face', role: 'img', 'aria-label': label });
  face.style.setProperty('--ring', k.ring);
  face.append(portrait(k.species, k.body, 'h-face-img'));
  return face;
}

const HULL_SVG =
  '<svg viewBox="0 0 80 40" aria-hidden="true"><path d="M5 12 H75 L65 36 H15 Z" fill="#b87a45" stroke="#3b2a1e" stroke-width="3" stroke-linejoin="round"/><path d="M12 19 H68" stroke="#e0b07a" stroke-width="3" stroke-linecap="round"/></svg>';

export class HarborGame implements GameScreen {
  readonly root: HTMLElement;
  readonly leaveText = GAMES_TEXT.harborLeaveConfirm;
  private state: HarborState;
  private readonly shipRow = el('div', { class: 'h-ships' });
  private readonly pierRow = el('div', { class: 'h-pier' });
  private readonly field = el('div', { class: 'h-field' });
  private readonly left = el('span', {});
  private readonly islandNodes = new Map<number, HTMLElement>();
  private timer = 0;
  private seen = false;
  private finished = false;

  constructor(
    private readonly host: MiniGameHost,
    private readonly cb: HarborCallbacks,
  ) {
    this.state = newHarbor(randomSeed());
    this.root = el('div', { class: 'q-game h-game' }, [
      cb.header(GAMES_TEXT.harborTitle),
      el('div', { class: 'q-top' }, [el('span', { class: 'q-chip' }, [this.left])]),
      this.shipRow,
      this.pierRow,
      this.field,
      el('p', { class: 'q-hint', text: GAMES_TEXT.harborHint }),
    ]);
    this.field.style.aspectRatio = `1 / ${HARBOR_H}`;
    this.renderShips();
    this.renderPier();
    this.renderField();
    this.renderLeft();
    this.timer = window.setInterval(() => this.tick(), WATER_STEP_MS);
  }

  hasProgress(): boolean {
    return !this.finished && this.state.moves > 0;
  }

  leave(): void {
    window.clearInterval(this.timer);
  }

  private label(): string {
    return GAMES_TEXT.harborPet;
  }

  private renderLeft(): void {
    this.left.textContent = GAMES_TEXT.harborLeft(this.state.total - this.state.delivered);
  }

  private shipNode(ship: HarborShip | null, count = ship?.count ?? 0): HTMLElement {
    if (!ship) return el('div', { class: 'h-ship empty' });
    const node = el('div', { class: 'h-ship', 'data-kind': String(ship.kind) }, [
      petFace(ship.kind, this.label()),
      el('span', { class: 'h-hull' }),
      el('span', { class: 'h-ship-n', text: `${count}/${HARBOR_NEED}` }),
    ]);
    (node.querySelector('.h-hull') as HTMLElement).innerHTML = HULL_SVG;
    node.style.setProperty('--ring', KINDS[ship.kind % KINDS.length]!.ring);
    return node;
  }

  private renderShips(): void {
    this.shipRow.replaceChildren(...this.state.ships.map((ship) => this.shipNode(ship)));
  }

  private renderPier(): void {
    const slots: HTMLElement[] = [];
    for (let i = 0; i < HARBOR_PIER; i++) {
      const pet = this.state.pier[i];
      const slot = el('div', { class: 'h-pier-slot', 'data-pet': pet ? String(pet.id) : '' });
      if (pet) slot.append(petFace(pet.kind, this.label()));
      slots.push(slot);
    }
    this.pierRow.replaceChildren(...slots);
  }

  private placeIsland(node: HTMLElement, island: HarborIsland): void {
    const r = islandRadius(island);
    node.style.width = `${r * 200}%`;
    node.style.left = `${(island.x - r) * 100}%`;
    node.style.top = `${((island.y - r) / HARBOR_H) * 100}%`;
  }

  private islandNode(island: HarborIsland): HTMLElement {
    const node = el('div', { class: 'h-island' });
    const spots = SPOTS[island.pets.length - 1] ?? SPOTS[0]!;
    const size = PET_SIZE[island.pets.length - 1] ?? PET_SIZE[0];
    island.pets.forEach((pet, i) => {
      const btn = el('button', { type: 'button', class: 'h-pet', 'data-pet': String(pet.id), 'aria-label': this.label() });
      btn.style.left = `${spots[i]![0]}%`;
      btn.style.top = `${spots[i]![1]}%`;
      btn.style.width = `${size}%`;
      btn.append(petFace(pet.kind, this.label()));
      btn.addEventListener('click', () => this.tap(island.id, pet, btn));
      node.append(btn);
    });
    return node;
  }

  private renderField(): void {
    const present = new Set<number>();
    this.state.field.forEach((island) => {
      present.add(island.id);
      let node = this.islandNodes.get(island.id);
      if (!node) {
        node = this.islandNode(island);
        this.islandNodes.set(island.id, node);
        this.field.append(node);
      }
      this.placeIsland(node, island);
      // Пузырь с меньшим числом питомцев сжимается: расставляем оставшихся по-новому.
      const alive = island.pets.map((p) => String(p.id));
      const buttons = [...node.querySelectorAll<HTMLElement>('.h-pet')];
      buttons.forEach((btn) => {
        if (!alive.includes(btn.dataset.pet ?? '')) btn.remove();
      });
      const left = [...node.querySelectorAll<HTMLElement>('.h-pet')];
      const spots = SPOTS[left.length - 1];
      const size = PET_SIZE[left.length - 1];
      if (spots && size !== undefined) {
        left.forEach((btn, i) => {
          btn.style.left = `${spots[i]![0]}%`;
          btn.style.top = `${spots[i]![1]}%`;
          btn.style.width = `${size}%`;
        });
      }
    });
    for (const [id, node] of [...this.islandNodes]) {
      if (present.has(id)) continue;
      this.islandNodes.delete(id);
      node.classList.add('gone');
      window.setTimeout(() => node.remove(), 400);
    }
  }

  private rel(rect: DOMRect): { x: number; y: number; w: number } {
    const base = this.root.getBoundingClientRect();
    return { x: rect.left - base.left, y: rect.top - base.top, w: rect.width };
  }

  /** Питомец перелетает с одного места на другое. */
  private fly(kind: number, from: DOMRect, to: DOMRect): void {
    const a = this.rel(from);
    const b = this.rel(to);
    const node = el('div', { class: 'h-fly' }, [petFace(kind, this.label())]);
    node.style.width = `${a.w}px`;
    node.style.height = `${a.w}px`;
    this.root.append(node);
    const dx = b.x + to.width / 2 - a.w / 2;
    const dy = b.y + to.height / 2 - a.w / 2;
    const anim = node.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px) scale(1)` },
        { transform: `translate(${a.x}px, ${a.y - 18}px) scale(1.15)`, offset: 0.25 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.8)` },
      ],
      { duration: FLY_MS, easing: 'ease-in-out', fill: 'forwards' },
    );
    anim.onfinish = () => node.remove();
    window.setTimeout(() => node.remove(), FLY_MS + 200);
  }

  private tap(islandId: number, pet: HarborPet, btn: HTMLElement): void {
    if (this.finished) return;
    const before = this.state;
    const next = tapHarborPet(before, islandId, pet.id);
    if (!next) {
      this.host.playSound('blocked');
      this.pierRow.classList.remove('shake');
      void this.pierRow.offsetWidth;
      this.pierRow.classList.add('shake');
      return;
    }
    this.host.playSound('place');
    const from = btn.getBoundingClientRect();
    const oldPierRects = new Map<number, DOMRect>();
    this.pierRow.querySelectorAll<HTMLElement>('.h-pier-slot').forEach((slot) => {
      if (slot.dataset.pet) oldPierRects.set(Number(slot.dataset.pet), slot.getBoundingClientRect());
    });
    const oldShipNodes = [...this.shipRow.children] as HTMLElement[];
    const oldShipRects = oldShipNodes.map((n) => n.getBoundingClientRect());
    this.state = next;
    // Корабли, которые отплыли: прежний корабль в этом месте исчез или сменился.
    const sailing: Array<{ node: HTMLElement; rect: DOMRect; slot: number }> = [];
    before.ships.forEach((ship, i) => {
      const now = next.ships[i];
      const gone = ship && (!now || now.kind !== ship.kind || now.count < ship.count);
      if (gone && oldShipNodes[i]) sailing.push({ node: oldShipNodes[i]!, rect: oldShipRects[i]!, slot: i });
    });
    this.renderShips();
    sailing.forEach(({ slot }) => (this.shipRow.children[slot] as HTMLElement | undefined)?.classList.add('late'));
    this.renderPier();
    this.renderField();
    this.renderLeft();
    // Куда летит нажатый питомец: на пристань или на корабль его вида.
    const pierAt = next.pier.findIndex((p) => p.id === pet.id);
    if (pierAt >= 0) {
      const slot = this.pierRow.children[pierAt] as HTMLElement;
      slot.classList.add('arrive');
      this.fly(pet.kind, from, slot.getBoundingClientRect());
    } else {
      const shipAt = oldShipNodes.findIndex((n) => n.dataset.kind === String(pet.kind));
      if (shipAt >= 0) this.fly(pet.kind, from, oldShipRects[shipAt]!);
    }
    // Питомцы с пристани пересаживаются на новые корабли.
    for (const old of before.pier) {
      if (next.pier.some((p) => p.id === old.id)) continue;
      const rect = oldPierRects.get(old.id);
      const target = [...this.shipRow.children].find((n) => (n as HTMLElement).dataset.kind === String(old.kind));
      const to = (target ?? this.shipRow).getBoundingClientRect();
      if (!rect) continue;
      const slot = target ? [...this.shipRow.children].indexOf(target) : -1;
      // На корабль, который появляется после отплытия прежнего, питомец пересаживается тогда же.
      if (sailing.some((x) => x.slot === slot)) window.setTimeout(() => this.fly(old.kind, rect, to), SAIL_MS);
      else this.fly(old.kind, rect, to);
    }
    sailing.forEach(({ node, rect }) => this.sail(node, rect));
    this.checkEnd();
  }

  /** Полный корабль уплывает. */
  private sail(node: HTMLElement, rect: DOMRect): void {
    const pos = this.rel(rect);
    node.classList.add('sailing');
    const count = node.querySelector('.h-ship-n');
    if (count) count.textContent = `${HARBOR_NEED}/${HARBOR_NEED}`;
    node.style.left = `${pos.x}px`;
    node.style.top = `${pos.y}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    this.root.append(node);
    const anim = node.animate(
      [
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(8px)', opacity: 1, offset: 0.2 },
        { transform: 'translateY(-90px)', opacity: 0 },
      ],
      { duration: SAIL_MS, easing: 'ease-in', fill: 'forwards' },
    );
    anim.onfinish = () => node.remove();
    window.setTimeout(() => node.remove(), SAIL_MS + 200);
  }

  private tick(): void {
    if (!this.root.isConnected) {
      if (this.seen) window.clearInterval(this.timer);
      return;
    }
    this.seen = true;
    if (this.finished) return;
    const next = advanceHarbor(this.state);
    if (next === this.state) return;
    this.state = next;
    this.renderShips();
    this.renderField();
    this.checkEnd();
  }

  private checkEnd(): void {
    if (this.finished || (!this.state.won && !this.state.stuck)) return;
    this.finished = true;
    window.clearInterval(this.timer);
    const won = this.state.won;
    this.host.finishHarbor(won);
    this.host.playSound(won ? 'win' : 'lose');
    const retry = el('button', { type: 'button', class: 'chunky', text: GAMES_TEXT.retry });
    retry.addEventListener('click', () => this.cb.replay());
    const finish = el('button', { type: 'button', class: 'chunky primary', text: GAMES_TEXT.finish });
    finish.addEventListener('click', () => this.cb.done());
    const card = el('div', { class: won ? 'q-result won' : 'q-result' }, [
      el('img', { class: 'q-result-pet', src: this.host.petImage, alt: '' }),
      el('h2', { text: won ? GAMES_TEXT.harborWinTitle : GAMES_TEXT.harborStuckTitle }),
      el('p', { text: won ? GAMES_TEXT.harborWinText(this.host.petName, HARBOR_REWARD) : GAMES_TEXT.harborStuckText(this.host.petName) }),
      el('div', { class: 'q-result-buttons' }, [retry, finish]),
    ]);
    window.setTimeout(() => this.root.append(card), won ? FLY_MS + 400 : 300);
    finish.focus();
  }
}
