import { randomSeed } from '../core/rng';
import {
  advanceHarbor,
  HARBOR_H,
  islandRadius,
  HARBOR_NEED,
  HARBOR_PIER,
  newHarbor,
  restoreHarbor,
  tapHarborPet,
  useClear,
  useNet,
  useShuffle,
  type HarborBonus,
  type HarborIsland,
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

/** Восемь видов: три зверя в трёх возрастах (взрослый выглядит как подросток, его не берём). */
const KINDS: readonly Kind[] = [
  { species: 'cat', body: 'teen', ring: '#5aaef0' },
  { species: 'dog', body: 'teen', ring: '#e8505b' },
  { species: 'blob', body: 'teen', ring: '#ff9fc8' },
  { species: 'cat', body: 'baby', ring: '#ffc94d' },
  { species: 'dog', body: 'baby', ring: '#5fce85' },
  { species: 'blob', body: 'baby', ring: '#a98af0' },
  { species: 'cat', body: 'child', ring: '#ff9a52' },
  { species: 'dog', body: 'child', ring: '#43cfc4' },
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
/** Места питомцев в кучке (проценты блока), снизу вверх. */
const PILE_SPOTS: readonly (readonly [number, number])[] = [
  [24, 74],
  [50, 78],
  [76, 74],
  [37, 56],
  [63, 56],
  [24, 44],
  [50, 36],
  [76, 44],
  [37, 24],
  [63, 24],
  [50, 14],
  [26, 22],
];
/** Поперечник питомца в долях ширины поля: у всех островов одинаковый, как бы ни отличались сами острова. */
const PET_D = 0.13;
/** Остров рисуется ровно по расчётному кругу, чтобы острова не налезали друг на друга. */
const ISLAND_VISUAL = 1;

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

const BONUS_SVG: Record<HarborBonus, string> = {
  net: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M11 34 Q6 54 17 58 Q30 62 36 38 Z" fill="#f3fbff" fill-opacity="0.85" stroke="#8fb4d8" stroke-width="1.6" stroke-linejoin="round"/><circle cx="26" cy="24" r="15" fill="#eaf6ff" fill-opacity="0.8"/><path d="M11 24H41M26 9V39M15.5 13.5L36.5 34.5M36.5 13.5L15.5 34.5M12.5 17.5Q26 22 39.5 17.5M12.5 30.5Q26 26 39.5 30.5M14 38Q18 50 17 58M22 39Q24 50 22 60M30 38Q30 48 28 58" stroke="#8fb4d8" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="26" cy="24" r="15" fill="none" stroke="#e04a3a" stroke-width="5.5"/><path d="M14.5 15Q18 10 24 9.5" stroke="#ff9d8e" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M37.5 36L53 54" stroke="#2f6fd6" stroke-width="7" stroke-linecap="round"/><path d="M48.5 49L56 58" stroke="#1d4fb0" stroke-width="9" stroke-linecap="round"/></svg>',
  clear: '<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(38 32 34)"><rect x="25" y="4" width="14" height="24" rx="6" fill="#e04a3a"/><rect x="28" y="6" width="3.5" height="16" rx="1.7" fill="#ff9d8e"/><circle cx="32" cy="8" r="7" fill="#2f6fd6"/><circle cx="30" cy="6" r="2" fill="#8fb8ff"/><rect x="22" y="26" width="20" height="8" rx="3" fill="#2f6fd6"/><rect x="18" y="33" width="28" height="22" rx="4" fill="#f6e3b5" stroke="#c9a35b" stroke-width="1.5"/><path d="M24 35V53M30 35V53M36 35V53M42 35V53" stroke="#d9b970" stroke-width="1.6" stroke-linecap="round"/><rect x="17" y="31" width="30" height="6" rx="3" fill="#3a78d8"/></g></svg>',
  shuffle: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="33" r="25" fill="#2f6fd6"/><circle cx="32" cy="33" r="25" fill="none" stroke="#1d4fb0" stroke-width="2.5"/><g transform="translate(32 32)"><path d="M0 0C-16-4-17-27-2-30C10-32 14-15 0 0Z" fill="#e04a3a" stroke="#a8281f" stroke-width="2"/><path d="M0 0C-16-4-17-27-2-30C10-32 14-15 0 0Z" fill="#e04a3a" stroke="#a8281f" stroke-width="2" transform="rotate(120)"/><path d="M0 0C-16-4-17-27-2-30C10-32 14-15 0 0Z" fill="#e04a3a" stroke="#a8281f" stroke-width="2" transform="rotate(240)"/><path d="M-6-21C-4-26 2-27 5-24" stroke="#ff9d8e" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle r="7.5" fill="#f6c431" stroke="#e08a1e" stroke-width="2.5"/><circle r="3" fill="#fff0a0"/></g></svg>',
};
const BONUS_ORDER: readonly HarborBonus[] = ['net', 'clear', 'shuffle'];

const HULL_SVG =
  '<svg viewBox="0 0 80 40" aria-hidden="true"><path d="M5 12 H75 L65 36 H15 Z" fill="#b87a45" stroke="#3b2a1e" stroke-width="3" stroke-linejoin="round"/><path d="M12 19 H68" stroke="#e0b07a" stroke-width="3" stroke-linecap="round"/></svg>';

export class HarborGame implements GameScreen {
  readonly root: HTMLElement;
  readonly leaveText = GAMES_TEXT.harborLeaveConfirm;
  private state: HarborState;
  private readonly shipRow = el('div', { class: 'h-ships' });
  private readonly pierRow = el('div', { class: 'h-pier' });
  private readonly stashBox = el('div', { class: 'h-stash' });
  private readonly bonusRow = el('div', { class: 'h-bonuses' });
  private popNew = false;
  private readonly field = el('div', { class: 'h-field' });
  private readonly left = el('span', {});
  private readonly treatCount = el('span', {});
  private earned = 0;
  private readonly islandNodes = new Map<number, HTMLElement>();
  private timer = 0;
  private seen = false;
  private finished = false;

  constructor(
    private readonly host: MiniGameHost,
    private readonly cb: HarborCallbacks,
  ) {
    const saved = loadSaved();
    this.state = saved ?? newHarbor(randomSeed());
    this.root = el('div', { class: 'q-game h-game' }, [
      cb.header(GAMES_TEXT.harborTitle),
      el('div', { class: 'q-top' }, [
        el('span', { class: 'q-chip' }, [this.left]),
        el('span', { class: 'q-chip h-treat-chip' }, [el('img', { class: 'q-chip-pet', src: host.treatImage, alt: '' }), this.treatCount]),
      ]),
      this.shipRow,
      el('div', { class: 'h-dock' }, [this.pierRow, this.stashBox]),
      this.field,
      this.bonusRow,
    ]);
    this.field.style.aspectRatio = `1 / ${HARBOR_H}`;
    this.renderShips();
    this.renderPier();
    this.renderBonuses();
    this.renderField();
    this.renderLeft();
    this.treatCount.textContent = '0';
    this.timer = window.setInterval(() => this.tick(), WATER_STEP_MS);
  }

  /** Выход посреди партии ничего не теряет: игра сохранена и продолжится при следующем входе. */
  hasProgress(): boolean {
    return false;
  }

  leave(): void {
    window.clearInterval(this.timer);
    if (!this.finished) storeSaved(this.state);
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
    // Питомцы из «Удаления» лежат кучкой: каждый на своём стабильном месте, поздние сверху.
    const pile = this.state.stash.slice(-PILE_SPOTS.length).map((pet, i) => {
      const spot = PILE_SPOTS[i]!;
      const slot = el('div', { class: 'h-pile-pet', 'data-pet': String(pet.id) });
      slot.style.left = `${spot[0]}%`;
      slot.style.top = `${spot[1]}%`;
      slot.append(petFace(pet.kind, this.label()));
      return slot;
    });
    const total = this.state.stash.length;
    this.stashBox.replaceChildren(...pile, ...(total > 0 ? [el('span', { class: 'h-pile-n', text: String(total) })] : []));
  }

  private renderBonuses(): void {
    this.bonusRow.replaceChildren(
      ...BONUS_ORDER.map((kind) => {
        const count = this.state.bonuses[kind];
        const btn = el('button', { type: 'button', class: count > 0 ? 'h-bonus' : 'h-bonus off', 'data-bonus': kind, 'aria-label': GAMES_TEXT.harborBonusName[kind] }, [
          el('span', { class: 'h-bonus-icon' }),
          el('span', { class: 'h-bonus-name', text: GAMES_TEXT.harborBonusName[kind] }),
          el('span', { class: 'h-bonus-n', text: String(count) }),
        ]);
        (btn.querySelector('.h-bonus-icon') as HTMLElement).innerHTML = BONUS_SVG[kind];
        btn.addEventListener('click', () => this.useBonus(kind));
        return btn;
      }),
    );
  }

  private placeIsland(node: HTMLElement, island: HarborIsland): void {
    // Рисуем чуть крупнее, чем считает вода, чтобы острова касались краями, а не стояли с щелями.
    const r = islandRadius(island) * ISLAND_VISUAL;
    node.style.width = `${r * 200}%`;
    node.style.left = `${(island.x - r) * 100}%`;
    node.style.top = `${((island.y - r) / HARBOR_H) * 100}%`;
  }

  private islandNode(island: HarborIsland): HTMLElement {
    const node = el('div', { class: this.popNew ? 'h-island pop' : 'h-island' });
    const spots = SPOTS[island.size - 1] ?? SPOTS[0]!;
    const size = (PET_D / (islandRadius(island) * 2 * ISLAND_VISUAL)) * 100;
    island.pets.forEach((pet) => {
      const spot = spots[pet.spot] ?? spots[0]!;
      const btn = el('button', { type: 'button', class: 'h-pet', 'data-pet': String(pet.id), 'aria-label': this.label() });
      btn.style.left = `${spot[0]}%`;
      btn.style.top = `${spot[1]}%`;
      btn.style.width = `${size}%`;
      btn.append(petFace(pet.kind, this.label()));
      btn.addEventListener('click', () => this.tap(island.id, pet.id, btn));
      node.append(btn);
    });
    if (island.bonus) {
      const badge = el('span', { class: 'h-island-bonus' });
      badge.innerHTML = BONUS_SVG[island.bonus];
      node.append(badge);
    } else if (island.treat) {
      node.append(el('img', { class: 'h-island-bonus h-island-treat', src: this.host.treatImage, alt: '' }));
    }
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
      const alive = new Set(island.pets.map((p) => String(p.id)));
      node.querySelectorAll<HTMLElement>('.h-pet').forEach((btn) => {
        if (!alive.has(btn.dataset.pet ?? '')) btn.remove();
      });
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

  private blocked(): void {
    this.host.playSound('blocked');
    this.pierRow.classList.remove('shake');
    void this.pierRow.offsetWidth;
    this.pierRow.classList.add('shake');
  }

  private tap(islandId: number, petId: number, btn: HTMLElement): void {
    if (this.finished) return;
    const pet = this.state.field.find((i) => i.id === islandId)?.pets.find((p) => p.id === petId);
    const next = pet ? tapHarborPet(this.state, islandId, petId) : null;
    if (!next || !pet) {
      this.blocked();
      return;
    }
    this.host.playSound('place');
    this.apply(next, { kind: pet.kind, id: pet.id, from: btn.getBoundingClientRect(), islandId });
  }

  private useBonus(kind: HarborBonus): void {
    if (this.finished) return;
    if (kind === 'net') {
      const caught = useNet(this.state);
      if (!caught) return this.blocked();
      const island = this.state.field.find((i) => i.id === caught.islandId);
      const pet = island?.pets.find((p) => p.id === caught.petId);
      const btn = this.field.querySelector<HTMLElement>(`.h-pet[data-pet="${caught.petId}"]`);
      this.host.playSound('place');
      this.apply(caught.state, pet && btn ? { kind: pet.kind, id: pet.id, from: btn.getBoundingClientRect(), islandId: caught.islandId } : undefined);
    } else if (kind === 'clear') {
      const next = useClear(this.state);
      if (!next) return this.blocked();
      this.host.playSound('place');
      this.apply(next);
    } else {
      const next = useShuffle(this.state);
      if (!next) return this.blocked();
      this.host.playSound('place');
      // Острова собираются заново: старые лопаются, новые появляются с питомцами в другом порядке.
      this.islandNodes.forEach((node) => node.remove());
      this.islandNodes.clear();
      this.popNew = true;
      this.apply(next);
      this.popNew = false;
    }
  }

  /** Применить новое состояние и показать, что куда переехало. */
  private apply(next: HarborState, mover?: { kind: number; id: number; from: DOMRect; islandId: number }): void {
    const before = this.state;
    const oldPetRects = new Map<number, DOMRect>();
    this.root.querySelectorAll<HTMLElement>('.h-pier-slot, .h-pile-pet').forEach((slot) => {
      if (slot.dataset.pet) oldPetRects.set(Number(slot.dataset.pet), slot.getBoundingClientRect());
    });
    const oldShipNodes = [...this.shipRow.children] as HTMLElement[];
    const oldShipRects = oldShipNodes.map((n) => n.getBoundingClientRect());
    const islandRect = mover ? this.islandNodes.get(mover.islandId)?.getBoundingClientRect() : undefined;
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
    this.renderBonuses();
    this.renderField();
    this.renderLeft();
    // Куда летит питомец с острова: на пристань или на корабль его вида.
    if (mover) {
      const pierAt = next.pier.findIndex((p) => p.id === mover.id);
      if (pierAt >= 0) {
        const slot = this.pierRow.children[pierAt] as HTMLElement;
        slot.classList.add('arrive');
        this.fly(mover.kind, mover.from, slot.getBoundingClientRect());
      } else {
        const shipAt = oldShipNodes.findIndex((n) => n.dataset.kind === String(mover.kind));
        if (shipAt >= 0) this.fly(mover.kind, mover.from, oldShipRects[shipAt]!);
      }
    }
    // Питомцы с пристани и из общего блока пересаживаются на новые корабли или переезжают в блок.
    for (const old of [...before.pier, ...before.stash]) {
      const rect = oldPetRects.get(old.id);
      if (!rect) continue;
      const stashAt = next.stash.findIndex((p) => p.id === old.id);
      if (stashAt >= 0 && !before.stash.some((p) => p.id === old.id)) {
        const shown = Math.min(stashAt, PILE_SPOTS.length - 1) + (next.stash.length > PILE_SPOTS.length ? next.stash.length - PILE_SPOTS.length : 0);
        const face = this.stashBox.querySelector<HTMLElement>(`.h-pile-pet[data-pet="${old.id}"]`) ?? (this.stashBox.children[Math.min(shown, this.stashBox.children.length - 1)] as HTMLElement | undefined) ?? this.stashBox;
        this.fly(old.kind, rect, face.getBoundingClientRect());
        continue;
      }
      if (next.pier.some((p) => p.id === old.id) || next.stash.some((p) => p.id === old.id)) continue;
      const target = [...this.shipRow.children].find((n) => (n as HTMLElement).dataset.kind === String(old.kind));
      const to = (target ?? this.shipRow).getBoundingClientRect();
      const slot = target ? [...this.shipRow.children].indexOf(target) : -1;
      // На корабль, который появляется после отплытия прежнего, питомец пересаживается тогда же.
      if (sailing.some((x) => x.slot === slot)) window.setTimeout(() => this.fly(old.kind, rect, to), SAIL_MS);
      else this.fly(old.kind, rect, to);
    }
    // Бонус с опустевшего острова улетает к своей кнопке.
    for (const kind of BONUS_ORDER) {
      if (next.bonuses[kind] <= before.bonuses[kind] || !islandRect) continue;
      const button = this.bonusRow.querySelector<HTMLElement>(`[data-bonus="${kind}"]`);
      if (!button) continue;
      button.classList.add('gain');
      this.flyIcon(kind, islandRect, button.getBoundingClientRect());
    }
    // Лакомство с опустевшего острова сразу достаётся питомцу.
    if (next.treats > before.treats) {
      const n = next.treats - before.treats;
      this.earned += n;
      this.treatCount.textContent = String(this.earned);
      this.host.earnTreats(n);
      const chip = this.root.querySelector<HTMLElement>('.h-treat-chip');
      if (islandRect && chip) this.flyTreat(islandRect, chip.getBoundingClientRect());
    }
    sailing.forEach(({ node, rect }) => this.sail(node, rect));
    if (!this.state.won && !this.state.stuck) storeSaved(this.state);
    this.checkEnd();
  }

  private flyTreat(from: DOMRect, to: DOMRect): void {
    const a = this.rel(from);
    const b = this.rel(to);
    const node = el('img', { class: 'h-fly h-fly-bonus', src: this.host.treatImage, alt: '' });
    const size = 36;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    this.root.append(node);
    const x0 = a.x + from.width / 2 - size / 2;
    const y0 = a.y + from.height / 2 - size / 2;
    const anim = node.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0.2 },
        { transform: `translate(${x0}px, ${y0 - 24}px) scale(1.3)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${b.x + to.width / 2 - size / 2}px, ${b.y + to.height / 2 - size / 2}px) scale(0.7)`, opacity: 1 },
      ],
      { duration: 700, easing: 'ease-in-out', fill: 'forwards' },
    );
    anim.onfinish = () => node.remove();
    window.setTimeout(() => node.remove(), 900);
  }

  private flyIcon(kind: HarborBonus, from: DOMRect, to: DOMRect): void {
    const a = this.rel(from);
    const b = this.rel(to);
    const node = el('div', { class: 'h-fly h-fly-bonus' });
    node.innerHTML = BONUS_SVG[kind];
    const size = 40;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    this.root.append(node);
    const x0 = a.x + from.width / 2 - size / 2;
    const y0 = a.y + from.height / 2 - size / 2;
    const anim = node.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0.2 },
        { transform: `translate(${x0}px, ${y0 - 24}px) scale(1.3)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${b.x + to.width / 2 - size / 2}px, ${b.y + to.height / 2 - size / 2}px) scale(0.8)`, opacity: 1 },
      ],
      { duration: 700, easing: 'ease-in-out', fill: 'forwards' },
    );
    anim.onfinish = () => node.remove();
    window.setTimeout(() => node.remove(), 900);
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
    const shipsChanged = JSON.stringify(next.ships) !== JSON.stringify(this.state.ships);
    this.state = next;
    // Корабли перерисовываем только когда они поменялись: иначе новый корабль появился бы до ухода старого.
    if (shipsChanged) this.renderShips();
    this.renderField();
    this.checkEnd();
  }

  private checkEnd(): void {
    if (this.finished || (!this.state.won && !this.state.stuck)) return;
    this.finished = true;
    window.clearInterval(this.timer);
    clearSaved();
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
      el('p', { text: won ? GAMES_TEXT.harborWinText(this.host.petName) : GAMES_TEXT.harborStuckText(this.host.petName) }),
      el('div', { class: 'q-result-buttons' }, [retry, finish]),
    ]);
    window.setTimeout(() => this.root.append(card), won ? FLY_MS + 400 : 300);
    finish.focus();
  }
}

const SAVE_KEY = 'tamagotchi.harbor';

function storeSaved(state: HarborState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // нет места или хранилище закрыто — игра просто не сохранится
  }
}

function clearSaved(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

function loadSaved(): HarborState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? restoreHarbor(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
