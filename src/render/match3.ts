import { randomSeed } from '../core/rng';
import {
  M3_COLS,
  M3_ROWS,
  m3Adjacent,
  restoreM3,
  m3Swap,
  m3Tap,
  newM3,
  type M3Cells,
  type M3Piece,
  type M3Result,
  type M3Special,
  type M3State,
} from '../core/match3';
import type { Species } from '../core/types';
import { GAMES_TEXT } from '../strings';
import { el } from './dom';
import type { GameScreen, MiniGameHost } from './minigames';
import { portrait } from './petArt';
import type { BodyStage } from './species';

// Экран «Трёх в ряд»: поле из питомцев, обмен соседних пальцем или двумя нажатиями.

const SWAP_MS = 200;
const CLEAR_MS = 260;
const FALL_MS = 340;

interface Kind {
  species: Species;
  body: BodyStage;
  color: string;
}

const KINDS: readonly Kind[] = [
  { species: 'cat', body: 'teen', color: '#5aaef0' },
  { species: 'dog', body: 'teen', color: '#e8505b' },
  { species: 'blob', body: 'teen', color: '#ff9fc8' },
  { species: 'cat', body: 'baby', color: '#f4b73f' },
  { species: 'dog', body: 'baby', color: '#5fce85' },
  { species: 'blob', body: 'baby', color: '#a98af0' },
];

const T = 'style="fill:var(--tile,#5aaef0)"';
const O = 'stroke="#3b2a1e" stroke-width="3" stroke-linejoin="round"';
/** Мордочка бонуса: глазки с бликами, румянец и улыбка. */
const face = (x: number, y: number, k = 1): string =>
  `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="-7" cy="0" rx="3.2" ry="4" fill="#3b2a1e"/><ellipse cx="7" cy="0" rx="3.2" ry="4" fill="#3b2a1e"/><circle cx="-6" cy="-1.5" r="1.2" fill="#fff"/><circle cx="8" cy="-1.5" r="1.2" fill="#fff"/><ellipse cx="-12" cy="5" rx="3.2" ry="2" fill="#ff7a9c" opacity=".7"/><ellipse cx="12" cy="5" rx="3.2" ry="2" fill="#ff7a9c" opacity=".7"/><path d="M-3.5 5q3.5 4 7 0" fill="none" stroke="#3b2a1e" stroke-width="2.2" stroke-linecap="round"/></g>`;
const sparkle = (x: number, y: number, r: number): string =>
  `<path d="M${x} ${y - r}q1.2 ${r - 1.2} ${r} ${r}q-${r - 1.2} 1.2 -${r} ${r}q-1.2 -${r - 1.2} -${r} -${r}q${r - 1.2} -1.2 ${r} -${r}z" fill="#fff" stroke="#3b2a1e" stroke-width="1.2" stroke-linejoin="round"/>`;
/** Бонусы — отдельные милые предметы, а не значки на питомце. */
const BONUS_ART: Record<M3Special, string> = {
  row: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="14" width="58" height="36" rx="18" ${T} ${O}/><rect x="9" y="18" width="46" height="9" rx="4.5" fill="#fff" opacity=".45"/>${face(32, 36, 0.95)}<path d="M13 32l-7 0M9 28l-4 4 4 4M51 32h7M55 28l4 4-4 4" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>${sparkle(52, 14, 6)}</svg>`,
  col: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="3" width="36" height="58" rx="18" ${T} ${O}/><rect x="18" y="9" width="9" height="46" rx="4.5" fill="#fff" opacity=".45"/>${face(32, 33, 0.95)}<path d="M32 12v-6M28 9l4-4 4 4M32 52v6M28 55l4 4 4-4" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>${sparkle(52, 12, 6)}</svg>`,
  bomb: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M40 14q4-8 12-6" fill="none" stroke="#3b2a1e" stroke-width="3.5" stroke-linecap="round"/><path d="M54 3l1.8 4.4 4.4 1.8-4.4 1.8L54 15.4l-1.8-4.4-4.4-1.8 4.4-1.8z" fill="#ffd25e" stroke="#ff7a3a" stroke-width="1.6" stroke-linejoin="round"/><circle cx="31" cy="37" r="24" fill="#ff7a3a" ${O}/><rect x="24" y="10" width="16" height="9" rx="3" fill="#ffc94d" ${O}/><ellipse cx="20" cy="26" rx="7" ry="4.5" fill="#fff" opacity=".55" transform="rotate(-35 20 26)"/>${face(31, 40, 1.05)}</svg>`,
  rainbow: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="33" r="27" fill="#fff6e4"/><g stroke="#3b2a1e" stroke-width="1.5"><path d="M32 33V6a27 27 0 0 1 23.4 13.5z" fill="#ff6b6b"/><path d="M32 33l23.4-13.5a27 27 0 0 1 0 27z" fill="#ffc94d"/><path d="M32 33l23.4 13.5A27 27 0 0 1 32 60z" fill="#7bc67e"/><path d="M32 33V60a27 27 0 0 1-23.4-13.5z" fill="#5aaef0"/><path d="M32 33L8.6 46.5a27 27 0 0 1 0-27z" fill="#a98af0"/><path d="M32 33L8.6 19.5A27 27 0 0 1 32 6z" fill="#ff9fc8"/></g><circle cx="32" cy="33" r="27" fill="none" ${O}/><circle cx="32" cy="33" r="16" fill="#fff6e4" stroke="#3b2a1e" stroke-width="2.4"/>${face(32, 33, 0.85)}<path d="M15 14q6-6 14-7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>${sparkle(56, 8, 6)}${sparkle(7, 54, 4.5)}</svg>`,
};

interface Callbacks {
  header: (title: string) => HTMLElement;
  replay: () => void;
  done: () => void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

export class Match3Game implements GameScreen {
  readonly root: HTMLElement;
  readonly leaveText = GAMES_TEXT.match3LeaveConfirm;
  private state: M3State;
  private readonly board = el('div', { class: 'm3-board' });
  private readonly treatChip = el('span', {});
  private collected = loadTotal();
  private restartTimer = 0;
  private readonly help = el('div', { class: 'm3-help', hidden: '' });
  private readonly note = el('p', { class: 'm3-note', text: GAMES_TEXT.match3Hint });
  private readonly nodes = new Map<number, HTMLElement>();
  private selected: number | null = null;
  private busy = false;
  private drag: { index: number; x: number; y: number; done: boolean } | null = null;

  constructor(
    private readonly host: MiniGameHost,
    cb: Callbacks,
  ) {
    this.state = loadSaved() ?? newM3(randomSeed());
    this.board.style.aspectRatio = `${M3_COLS} / ${M3_ROWS}`;
    this.root = el('div', { class: 'q-game m3-game' }, [
      cb.header(GAMES_TEXT.match3Title),
      el('div', { class: 'q-top' }, [
        el('span', { class: 'q-chip h-treat-chip' }, [el('img', { class: 'q-chip-pet', src: host.treatImage, alt: '' }), this.treatChip]),
        this.restartButton(),
        this.helpButton(),
      ]),
      el('div', { class: 'm3-wrap' }, [this.board, this.help]),
      this.note,
    ]);
    this.board.addEventListener('pointerdown', (e) => this.down(e));
    this.board.addEventListener('pointermove', (e) => this.move(e));
    this.board.addEventListener('pointerup', (e) => this.up(e));
    this.board.addEventListener('pointercancel', () => (this.drag = null));
    this.show(this.state.cells, false);
    this.renderStats();
  }

  /** Кнопка «?»: показывает и прячет памятку поверх поля, поле при этом не двигается. */
  private helpButton(): HTMLElement {
    const button = el('button', { type: 'button', class: 'm3-help-button', 'aria-label': GAMES_TEXT.match3Legend.title, text: '?' });
    this.help.append(this.legend());
    const toggle = (): void => {
      const open = this.help.hasAttribute('hidden');
      if (open) this.help.removeAttribute('hidden');
      else this.help.setAttribute('hidden', '');
      button.classList.toggle('on', open);
      button.textContent = open ? '×' : '?';
    };
    button.addEventListener('click', toggle);
    this.help.addEventListener('click', toggle);
    return button;
  }

  /** Памятка: что получится из каждой комбинации, с примерами. */
  private legend(): HTMLElement {
    const L = GAMES_TEXT.match3Legend;
    // Пример комбинации: «#» — питомец одного вида, «.» — пусто.
    const shape = (rows: string): HTMLElement => {
      const lines = rows.split('/');
      const box = el('span', { class: 'm3-shape' });
      box.style.gridTemplateColumns = `repeat(${lines[0]!.length}, 1fr)`;
      for (const line of lines) {
        for (const ch of line) box.append(el('i', { class: ch === '#' ? 'on' : 'off' }));
      }
      return box;
    };
    const row = (shapes: string[], art: string | null, title: string, text: string): HTMLElement => {
      const icon = el('span', { class: 'm3-legend-icon' });
      if (art) icon.innerHTML = art;
      else icon.textContent = '✨';
      return el('div', { class: 'm3-legend-row' }, [
        el('span', { class: 'm3-legend-shapes' }, shapes.map(shape)),
        el('span', { class: 'm3-legend-arrow', text: '→' }),
        icon,
        el('span', { class: 'm3-legend-text' }, [el('b', { text: title }), el('span', { text })]),
      ]);
    };
    return el('div', { class: 'm3-legend' }, [
      el('h3', { text: L.title }),
      row(['###', '#/#/#'], null, L.threeTitle, L.threeText),
      row(['####'], BONUS_ART.row, L.rowTitle, L.rowText),
      row(['#/#/#/#'], BONUS_ART.col, L.colTitle, L.colText),
      row(['##/##', '###/.#./.#.', '#../#../###'], BONUS_ART.bomb, L.bombTitle, L.bombText),
      row(['#####', '.#./###/.#.'], BONUS_ART.rainbow, L.rainbowTitle, L.rainbowText),
      row([], '<img src="' + this.host.treatImage + '" alt="">', L.treatTitle, L.treatText),
      el('p', { class: 'm3-legend-tip', text: L.tip }),
    ]);
  }

  /** Игра сохраняется после каждого хода, поэтому выход ничего не теряет. */
  hasProgress(): boolean {
    return false;
  }

  private renderStats(): void {
    this.treatChip.textContent = GAMES_TEXT.match3Treats(this.collected);
  }

  /** «Заново»: нужно нажать дважды подряд, чтобы случайно не стереть поле. */
  private restartButton(): HTMLElement {
    const button = el('button', { type: 'button', class: 'm3-help-button m3-restart', 'aria-label': GAMES_TEXT.match3Restart, text: '↻' });
    button.addEventListener('click', () => {
      if (this.busy) return;
      if (button.classList.contains('on')) {
        window.clearTimeout(this.restartTimer);
        button.classList.remove('on');
        button.textContent = '↻';
        this.selected = null;
        this.state = newM3(randomSeed());
        storeSaved(this.state);
        for (const tile of this.nodes.values()) tile.remove();
        this.nodes.clear();
        this.show(this.state.cells, false);
        this.note.textContent = GAMES_TEXT.match3Hint;
        return;
      }
      button.classList.add('on');
      button.textContent = '?!';
      this.note.textContent = GAMES_TEXT.match3RestartSure;
      this.restartTimer = window.setTimeout(() => {
        button.classList.remove('on');
        button.textContent = '↻';
        this.note.textContent = GAMES_TEXT.match3Hint;
      }, 3000);
    });
    return button;
  }

  private faceNode(piece: M3Piece): HTMLElement {
    const tile = el('div', { class: 'm3-tile', 'data-id': String(piece.id) });
    const face = el('span', { class: 'm3-face' });
    tile.append(face);
    this.decorate(tile, piece);
    return tile;
  }

  /** Рисуем питомца (или радугу) и значок бонуса; повторно — только если вид или бонус изменился. */
  private decorate(tile: HTMLElement, piece: M3Piece): void {
    const key = `${piece.kind}/${piece.special ?? ''}/${piece.treat ? 't' : ''}`;
    if (tile.dataset.key === key) return;
    tile.dataset.key = key;
    const face = tile.querySelector<HTMLElement>('.m3-face')!;
    face.replaceChildren();
    tile.classList.toggle('special', !!piece.special);
    tile.classList.toggle('rainbow', piece.special === 'rainbow');
    tile.classList.toggle('bomb', piece.special === 'bomb');
    tile.classList.toggle('line', piece.special === 'row' || piece.special === 'col');
    tile.setAttribute('aria-label', piece.special ? GAMES_TEXT.match3Special[piece.special] : GAMES_TEXT.match3Tile);
    tile.classList.toggle('treat', !!piece.treat);
    if (piece.treat) {
      face.append(el('img', { class: 'm3-treat-img', src: this.host.treatImage, alt: '' }));
      tile.setAttribute('aria-label', GAMES_TEXT.match3TreatLabel);
    } else if (piece.special) {
      if (piece.kind >= 0) tile.style.setProperty('--tile', KINDS[piece.kind % KINDS.length]!.color);
      face.innerHTML = BONUS_ART[piece.special];
    } else if (piece.kind >= 0) {
      const kind = KINDS[piece.kind % KINDS.length]!;
      tile.style.setProperty('--tile', kind.color);
      face.append(portrait(kind.species, kind.body, 'm3-face-img'));
    }
  }

  private place(tile: HTMLElement, index: number, row = Math.floor(index / M3_COLS)): void {
    tile.style.transform = `translate(${(index % M3_COLS) * 100}%, ${row * 100}%)`;
  }

  /** Привести картинку к полю: новые питомцы въезжают сверху, исчезнувшие лопаются. */
  private show(cells: M3Cells, animate = true): void {
    const alive = new Set<number>();
    const fresh: HTMLElement[] = [];
    const spawned = new Array<number>(M3_COLS).fill(0);
    cells.forEach((piece, index) => {
      if (!piece) return;
      alive.add(piece.id);
      let tile = this.nodes.get(piece.id);
      if (!tile) {
        tile = this.faceNode(piece);
        this.nodes.set(piece.id, tile);
        this.board.append(tile);
        if (animate) {
          const col = index % M3_COLS;
          this.place(tile, index, -1 - spawned[col]!++);
          fresh.push(tile);
          tile.dataset.target = String(index);
        } else this.place(tile, index);
      } else {
        this.decorate(tile, piece);
        this.place(tile, index);
      }
      tile.classList.toggle('selected', index === this.selected);
    });
    if (fresh.length > 0) {
      void this.board.offsetWidth;
      for (const tile of fresh) this.place(tile, Number(tile.dataset.target));
    }
    for (const [id, tile] of [...this.nodes]) {
      if (alive.has(id)) continue;
      this.nodes.delete(id);
      tile.classList.add('pop');
      window.setTimeout(() => tile.remove(), CLEAR_MS);
    }
  }

  private cellAt(e: PointerEvent): number | null {
    const rect = this.board.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * M3_COLS);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * M3_ROWS);
    if (col < 0 || row < 0 || col >= M3_COLS || row >= M3_ROWS) return null;
    return row * M3_COLS + col;
  }

  private down(e: PointerEvent): void {
    if (this.busy) return;
    const index = this.cellAt(e);
    if (index === null) return;
    this.drag = { index, x: e.clientX, y: e.clientY, done: false };
    this.board.setPointerCapture?.(e.pointerId);
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.done || this.busy) return;
    const rect = this.board.getBoundingClientRect();
    const size = rect.width / M3_COLS;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < size * 0.4) return;
    d.done = true;
    const col = d.index % M3_COLS;
    const row = Math.floor(d.index / M3_COLS);
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const nc = col + (horizontal ? Math.sign(dx) : 0);
    const nr = row + (horizontal ? 0 : Math.sign(dy));
    if (nc < 0 || nr < 0 || nc >= M3_COLS || nr >= M3_ROWS) return;
    void this.trySwap(d.index, nr * M3_COLS + nc);
  }

  private up(e: PointerEvent): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.done || this.busy) return;
    const index = this.cellAt(e);
    if (index === null || index !== d.index) return;
    this.tap(index);
  }

  private tap(index: number): void {
    const piece = this.state.cells[index];
    if (!piece) return;
    if (this.selected !== null && this.selected !== index && m3Adjacent(this.selected, index)) {
      const from = this.selected;
      this.selected = null;
      void this.trySwap(from, index);
      return;
    }
    if (this.selected === index) {
      this.selected = null;
      this.show(this.state.cells, false);
      return;
    }
    if (piece.special && piece.special !== 'rainbow') {
      this.selected = null;
      const result = m3Tap(this.state, index);
      if (result) void this.play(result);
      return;
    }
    this.selected = index;
    this.host.playSound('mark');
    this.show(this.state.cells, false);
  }

  private async trySwap(a: number, b: number): Promise<void> {
    if (this.busy) return;
    this.selected = null;
    const result = m3Swap(this.state, a, b);
    this.busy = true;
    const swapped = this.state.cells.slice();
    [swapped[a], swapped[b]] = [swapped[b] ?? null, swapped[a] ?? null];
    this.show(swapped, false);
    await sleep(SWAP_MS);
    if (!result) {
      this.host.playSound('blocked');
      this.show(this.state.cells, false);
      await sleep(SWAP_MS);
      this.busy = false;
      this.shake(a, b);
      return;
    }
    this.busy = false;
    await this.play(result);
  }

  private shake(a: number, b: number): void {
    for (const i of [a, b]) {
      const id = this.state.cells[i]?.id;
      const tile = id === undefined ? undefined : this.nodes.get(id);
      if (!tile) continue;
      tile.classList.remove('shake');
      void tile.offsetWidth;
      tile.classList.add('shake');
    }
  }

  private async play(result: M3Result): Promise<void> {
    this.busy = true;
    // Результат хода известен сразу: сохраняем его до анимации, чтобы выход посреди неё ничего не терял.
    this.state = result.state;
    storeSaved(this.state);
    for (const step of result.steps) {
      this.host.playSound(step.treats > 0 ? 'snack' : step.chain > 1 ? 'mark' : 'place');
      this.show(step.afterClear);
      if (step.treats > 0) this.gain(step.treats);
      await sleep(CLEAR_MS);
      this.show(step.afterFall);
      await sleep(FALL_MS);
    }
    if (result.reshuffled) {
      this.note.textContent = GAMES_TEXT.match3Shuffle;
      this.show(this.state.cells, false);
      await sleep(400);
    } else {
      this.note.textContent = GAMES_TEXT.match3Hint;
    }
    this.busy = false;
  }

  /** Лакомства сразу попадают питомцу. */
  private gain(n: number): void {
    this.collected += n;
    storeTotal(this.collected);
    this.host.earnTreats(n);
    this.renderStats();
    const chip = this.treatChip.parentElement;
    chip?.classList.remove('bump');
    void chip?.offsetWidth;
    chip?.classList.add('bump');
  }
}

const SAVE_KEY = 'tamagotchi.match3';
const TOTAL_KEY = 'tamagotchi.match3.treats';

function storeSaved(state: M3State): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // хранилище закрыто — поле просто не сохранится
  }
}

function loadSaved(): M3State | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? restoreM3(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function storeTotal(n: number): void {
  try {
    localStorage.setItem(TOTAL_KEY, String(n));
  } catch {
    // ignore
  }
}

function loadTotal(): number {
  try {
    const n = Number(localStorage.getItem(TOTAL_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Сколько лакомств собрано в «Трёх в ряд» за всё время (для списка игр). */
export function match3Collected(): number {
  return loadTotal();
}
