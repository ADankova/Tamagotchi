import { randomSeed } from '../core/rng';
import {
  M3_COLS,
  M3_REWARD,
  M3_ROWS,
  m3Adjacent,
  m3Outcome,
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

const BADGES: Record<M3Special, string> = {
  row: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 7l-5 5 5 5M17 7l5 5-5 5" fill="none" stroke="#3b2a1e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12h18M7 7l-5 5 5 5M17 7l5 5-5 5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  col: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 7l5-5 5 5M7 17l5 5 5-5" fill="none" stroke="#3b2a1e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3v18M7 7l5-5 5 5M7 17l5 5 5-5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bomb: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="14" r="8" fill="#3b2a1e"/><circle cx="8" cy="11" r="2.2" fill="#8a7a6a"/><path d="M15 6l3-3" stroke="#3b2a1e" stroke-width="2.4" stroke-linecap="round"/><path d="M19 1v4M17 3h4" stroke="#ffd25e" stroke-width="2" stroke-linecap="round"/></svg>',
  rainbow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="#fff" stroke="#3b2a1e" stroke-width="1.8" stroke-linejoin="round"/></svg>',
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
  private readonly movesChip = el('span', {});
  private readonly scoreChip = el('span', {});
  private readonly bar = el('span', { class: 'm3-bar-fill' });
  private readonly note = el('p', { class: 'm3-note', text: GAMES_TEXT.match3Hint });
  private readonly nodes = new Map<number, HTMLElement>();
  private selected: number | null = null;
  private busy = false;
  private finished = false;
  private moved = false;
  private drag: { index: number; x: number; y: number; done: boolean } | null = null;

  constructor(
    private readonly host: MiniGameHost,
    private readonly cb: Callbacks,
  ) {
    this.state = newM3(randomSeed());
    this.board.style.aspectRatio = `${M3_COLS} / ${M3_ROWS}`;
    this.root = el('div', { class: 'q-game m3-game' }, [
      cb.header(GAMES_TEXT.match3Title),
      el('div', { class: 'q-top' }, [el('span', { class: 'q-chip' }, [this.movesChip]), el('span', { class: 'q-chip' }, [this.scoreChip])]),
      el('div', { class: 'm3-bar' }, [this.bar]),
      this.board,
      this.note,
    ]);
    this.board.addEventListener('pointerdown', (e) => this.down(e));
    this.board.addEventListener('pointermove', (e) => this.move(e));
    this.board.addEventListener('pointerup', (e) => this.up(e));
    this.board.addEventListener('pointercancel', () => (this.drag = null));
    this.show(this.state.cells, false);
    this.renderStats();
  }

  hasProgress(): boolean {
    return this.moved && !this.finished;
  }

  private renderStats(): void {
    this.movesChip.textContent = GAMES_TEXT.match3Moves(this.state.moves);
    this.scoreChip.textContent = GAMES_TEXT.match3Score(this.state.score, this.state.goal);
    this.bar.style.width = `${Math.min(100, (this.state.score / this.state.goal) * 100)}%`;
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
    const key = `${piece.kind}/${piece.special ?? ''}`;
    if (tile.dataset.key === key) return;
    tile.dataset.key = key;
    const face = tile.querySelector<HTMLElement>('.m3-face')!;
    face.replaceChildren();
    tile.classList.toggle('special', !!piece.special);
    tile.classList.toggle('rainbow', piece.special === 'rainbow');
    tile.classList.toggle('bomb', piece.special === 'bomb');
    tile.classList.toggle('line', piece.special === 'row' || piece.special === 'col');
    tile.setAttribute('aria-label', piece.special ? GAMES_TEXT.match3Special[piece.special] : GAMES_TEXT.match3Tile);
    if (piece.kind >= 0) {
      const kind = KINDS[piece.kind % KINDS.length]!;
      tile.style.setProperty('--tile', kind.color);
      face.append(portrait(kind.species, kind.body, 'm3-face-img'));
    }
    if (piece.special) {
      const badge = el('span', { class: `m3-badge ${piece.special}` });
      badge.innerHTML = BADGES[piece.special];
      face.append(badge);
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
    if (this.busy || this.finished) return;
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
    if (!d || d.done || this.busy || this.finished) return;
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
    if (this.busy || this.finished) return;
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
    this.moved = true;
    for (const step of result.steps) {
      this.host.playSound(step.chain > 1 ? 'snack' : 'place');
      this.show(step.afterClear);
      this.state = { ...this.state, score: this.state.score + step.gain };
      this.renderStats();
      await sleep(CLEAR_MS);
      this.show(step.afterFall);
      await sleep(FALL_MS);
    }
    this.state = result.state;
    if (result.reshuffled) {
      this.note.textContent = GAMES_TEXT.match3Shuffle;
      this.show(this.state.cells, false);
      await sleep(400);
    } else {
      this.note.textContent = GAMES_TEXT.match3Hint;
    }
    this.renderStats();
    this.busy = false;
    this.checkEnd();
  }

  private checkEnd(): void {
    const outcome = m3Outcome(this.state);
    if (this.finished || outcome === 'playing') return;
    this.finished = true;
    const won = outcome === 'won';
    this.host.finishMatch3(won, this.state.score);
    this.host.playSound(won ? 'win' : 'lose');
    const retry = el('button', { type: 'button', class: 'chunky', text: GAMES_TEXT.retry });
    retry.addEventListener('click', () => this.cb.replay());
    const finish = el('button', { type: 'button', class: 'chunky primary', text: GAMES_TEXT.finish });
    finish.addEventListener('click', () => this.cb.done());
    const card = el('div', { class: won ? 'q-result won' : 'q-result' }, [
      el('img', { class: 'q-result-pet', src: this.host.petImage, alt: '' }),
      el('h2', { text: won ? GAMES_TEXT.match3WinTitle : GAMES_TEXT.match3LoseTitle }),
      el('p', {
        text: won
          ? GAMES_TEXT.match3WinText(this.host.petName, this.state.score, M3_REWARD)
          : GAMES_TEXT.match3LoseText(this.host.petName, this.state.score, this.state.goal),
      }),
      el('div', { class: 'q-result-buttons' }, [retry, finish]),
    ]);
    window.setTimeout(() => this.root.append(card), 400);
    finish.focus();
  }
}
