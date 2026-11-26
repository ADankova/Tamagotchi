import { randomSeed } from '../core/rng';
import {
  CRUMB_SIZE,
  moveRange,
  newSlideGame,
  slide,
  SLIDE_SIZE,
  useCrumbs,
  useFreeze,
  type Block,
  type RowTemplate,
  type SlideFrame,
  type SlideState,
} from '../core/slide';
import { GAMES_TEXT } from '../strings';
import { ART } from './artData';
import { el } from './dom';
import type { GameScreen, MiniGameHost } from './minigames';

// Экран «Питомцев-блоков»: поле 10×10, блоки-питомцы двигаются пальцем по своей полосе.

const STEP_MS = 190;
const CLEAR_MS = 380;
/** Палец сдвинулся меньше — это ещё не перетаскивание. */
const DRAG_START_PX = 4;

interface SlideCallbacks {
  header: (title: string) => HTMLElement;
  replay: () => void;
  done: () => void;
}

interface Drag {
  id: number;
  node: HTMLElement;
  pointer: number;
  x0: number;
  col: number;
  min: number;
  max: number;
  cell: number;
  dx: number;
}

const pct = (n: number) => `${(n * 100) / SLIDE_SIZE}%`;

export class SlideGame implements GameScreen {
  readonly root: HTMLElement;
  readonly leaveText = GAMES_TEXT.slideLeaveConfirm;
  private state: SlideState;
  private readonly board = el('div', { class: 's-board', role: 'application', 'aria-label': GAMES_TEXT.slideHint });
  private readonly preview = el('div', { class: 's-next', 'aria-hidden': 'true' });
  private readonly nodes = new Map<number, HTMLElement>();
  private readonly lines = el('span', { class: 's-lines' });
  private readonly treats = el('span', {});
  private readonly bonusBar = el('div', { class: 's-bonuses' });
  private readonly freezeButton = this.bonusButton('freeze', GAMES_TEXT.slideFreeze, () => this.freeze());
  private readonly crumbsButton = this.bonusButton('crumbs', GAMES_TEXT.slideCrumbs, () => void this.crumble());
  private readonly frozenChip = el('span', { class: 's-frozen' });
  private readonly status = el('p', { class: 'q-status', role: 'status', 'aria-live': 'polite' });
  private drag: Drag | null = null;
  private busy = false;
  private finished = false;

  constructor(
    private readonly host: MiniGameHost,
    private readonly cb: SlideCallbacks,
  ) {
    this.state = newSlideGame(randomSeed());
    this.root = el('div', { class: 'q-game s-game' }, [
      cb.header(GAMES_TEXT.slideTitle),
      el('div', { class: 'q-top' }, [
        el('span', { class: 'q-chip' }, [el('img', { class: 'q-chip-pet', src: host.petImage, alt: '' }), this.lines]),
        el('span', { class: 'q-chip' }, [el('img', { class: 'q-chip-pet', src: host.treatImage, alt: '' }), this.treats]),
      ]),
      el('div', { class: 's-next-wrap' }, [el('span', { class: 's-next-label', text: GAMES_TEXT.slideNext }), this.preview]),
      el('div', { class: 'q-board-wrap' }, [this.board]),
      this.bonusBar,
      this.status,
      el('p', { class: 'q-hint', text: GAMES_TEXT.slideHint }),
      el('p', { class: 'q-hint', text: GAMES_TEXT.slideBonusHint }),
    ]);
    this.bonusBar.append(this.freezeButton, this.crumbsButton, this.frozenChip);
    this.sync(this.state.blocks);
    this.renderPreview(this.state.next);
    this.renderScore();
    this.bindDrag();
  }

  private bonusButton(kind: 'freeze' | 'crumbs', label: string, onClick: () => void): HTMLButtonElement {
    const icon = el('img', { class: 's-bonus-icon', src: ART[kind === 'freeze' ? 'bonus_freeze' : 'bonus_crumbs'], alt: '' });
    const button = el('button', { type: 'button', class: `s-bonus-button ${kind}`, 'aria-label': label }, [
      icon,
      el('span', { class: 's-bonus-label', text: label }),
      el('span', { class: 's-bonus-count' }),
    ]);
    button.addEventListener('click', onClick);
    return button;
  }

  hasProgress(): boolean {
    return this.state.moves > 0 && !this.finished;
  }

  /** Вышли посреди партии: партия засчитывается, лакомства уже начислены. */
  leave(): void {
    if (this.finished) return;
    this.finished = true;
    this.host.finishSlide(this.state.lines, this.state.treats);
  }

  // --- Отрисовка ---

  private blockNode(b: Pick<Block, 'len' | 'color' | 'treat' | 'bonus'>): HTMLElement {
    const body = el('div', { class: 's-body' }, [el('img', { class: 's-pet', src: this.host.petImage, alt: '', draggable: 'false' })]);
    if (b.treat) body.append(el('img', { class: 's-treat', src: this.host.treatImage, alt: '', draggable: 'false' }));
    if (b.bonus) {
      body.append(el('img', { class: `s-treat s-bonus ${b.bonus}`, src: ART[`bonus_${b.bonus}`], alt: '', draggable: 'false' }));
    }
    const node = el('div', { class: 's-block', 'data-color': String(b.color) }, [body]);
    return node;
  }

  private place(node: HTMLElement, b: Block): void {
    node.style.left = pct(b.col);
    node.style.top = pct(b.row);
    node.style.width = pct(b.len);
    node.classList.toggle('single', b.len === 1);
    node.setAttribute('aria-label', GAMES_TEXT.slideBlock(b.row + 1, b.col + 1, b.len));
  }

  /** Привести DOM к раскладке блоков: новые создать, лишние убрать, остальные сдвинуть (с анимацией). */
  private sync(
    blocks: readonly Block[],
    clearing: readonly number[] = [],
    spawned: readonly number[] = [],
    zapped: readonly number[] = [],
    pop = false,
  ): void {
    const alive = new Set(blocks.map((b) => b.id));
    for (const [id, node] of this.nodes) {
      if (!alive.has(id)) {
        node.remove();
        this.nodes.delete(id);
      }
    }
    for (const b of blocks) {
      let node = this.nodes.get(b.id);
      if (!node) {
        node = this.blockNode(b);
        node.dataset.id = String(b.id);
        this.nodes.set(b.id, node);
        this.board.append(node);
        if (pop) {
          node.classList.add('pop');
          window.setTimeout(() => node?.classList.remove('pop'), 500);
        }
      }
      this.place(node, b);
      node.classList.toggle('spawn', spawned.includes(b.id));
      node.classList.toggle('clearing', clearing.includes(b.id));
      node.classList.toggle('zapped', zapped.includes(b.id));
    }
  }

  private renderPreview(row: RowTemplate): void {
    this.preview.replaceChildren(
      ...row.map((t) => {
        const node = this.blockNode(t);
        node.style.left = pct(t.col);
        node.style.width = pct(t.len);
        return node;
      }),
    );
  }

  private renderScore(): void {
    this.lines.textContent = GAMES_TEXT.slideLines(this.state.lines);
    this.treats.textContent = String(this.state.treats);
    this.treats.parentElement?.setAttribute('aria-label', GAMES_TEXT.slideTreats(this.state.treats));
    this.renderBonuses();
  }

  private renderBonuses(): void {
    const { freezes, crumbs, frozen } = this.state;
    this.freezeButton.hidden = freezes === 0;
    this.crumbsButton.hidden = crumbs === 0;
    this.freezeButton.querySelector('.s-bonus-count')!.textContent = `×${freezes}`;
    this.crumbsButton.querySelector('.s-bonus-count')!.textContent = `×${crumbs}`;
    this.frozenChip.hidden = frozen === 0;
    this.frozenChip.textContent = GAMES_TEXT.slideFrozen(frozen);
    this.board.classList.toggle('frozen', frozen > 0);
    this.bonusBar.hidden = freezes === 0 && crumbs === 0 && frozen === 0;
  }

  // --- Бонусы-кнопки ---

  private freeze(): void {
    if (this.busy || this.finished) return;
    const next = useFreeze(this.state);
    if (!next) return;
    this.state = next;
    this.host.playSound('place');
    this.status.textContent = GAMES_TEXT.slideFrozen(next.frozen);
    this.renderScore();
  }

  private async crumble(): Promise<void> {
    if (this.busy || this.finished) return;
    const result = useCrumbs(this.state);
    if (!result) {
      this.status.textContent = GAMES_TEXT.slideNoCrumbTarget;
      return;
    }
    this.busy = true;
    const area = result.frames[0]!.crumbArea!;
    const zone = el('div', { class: 's-crumb-area' });
    zone.style.left = pct(area.col);
    zone.style.top = pct(area.row);
    zone.style.width = pct(CRUMB_SIZE);
    zone.style.height = pct(CRUMB_SIZE);
    this.board.append(zone);
    this.host.playSound('place');
    await wait(480);
    this.state = result.state;
    this.sync(this.state.blocks, [], [], [], true);
    this.renderScore();
    await wait(420);
    zone.remove();
    this.busy = false;
  }

  // --- Перетаскивание ---

  private bindDrag(): void {
    this.board.addEventListener('pointerdown', (e) => {
      if (this.busy || this.finished || this.drag || !e.isPrimary) return;
      const node = (e.target as HTMLElement).closest<HTMLElement>('.s-block');
      if (!node || !this.board.contains(node)) return;
      const id = Number(node.dataset.id);
      const block = this.state.blocks.find((b) => b.id === id);
      if (!block) return;
      const [min, max] = moveRange(this.state, id);
      e.preventDefault();
      node.setPointerCapture?.(e.pointerId);
      node.classList.add('dragging');
      this.drag = { id, node, pointer: e.pointerId, x0: e.clientX, col: block.col, min, max, cell: this.board.clientWidth / SLIDE_SIZE, dx: 0 };
      if (max === min) this.wiggle(node);
    });
    this.board.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.pointer) return;
      const raw = e.clientX - d.x0;
      d.dx = Math.max((d.min - d.col) * d.cell, Math.min((d.max - d.col) * d.cell, raw));
      if (Math.abs(raw) >= DRAG_START_PX) d.node.style.transform = `translateX(${d.dx}px)`;
    });
    const end = (e: PointerEvent, cancel: boolean) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.pointer) return;
      this.drag = null;
      const target = cancel ? d.col : d.col + Math.round(d.dx / d.cell);
      const block = this.state.blocks.find((b) => b.id === d.id);
      if (target !== d.col && block) {
        // Ставим блок в новую клетку без анимации — он уже там, под пальцем.
        d.node.style.left = pct(target);
        d.node.style.transform = '';
        void d.node.offsetWidth;
        d.node.classList.remove('dragging');
        void this.move(d.id, target);
      } else {
        d.node.classList.remove('dragging');
        d.node.style.transform = '';
      }
    };
    this.board.addEventListener('pointerup', (e) => end(e, false));
    this.board.addEventListener('pointercancel', (e) => end(e, true));
  }

  private wiggle(node: HTMLElement): void {
    node.classList.remove('stuck');
    void node.offsetWidth;
    node.classList.add('stuck');
  }

  // --- Ход ---

  private async move(id: number, col: number): Promise<void> {
    const result = slide(this.state, id, col);
    if (!result) {
      this.sync(this.state.blocks);
      return;
    }
    this.busy = true;
    this.host.playSound('mark');
    this.status.textContent = '';
    await this.play(result.frames);
    this.state = result.state;
    this.sync(this.state.blocks);
    this.renderPreview(this.state.next);
    this.renderScore();
    this.busy = false;
    if (this.state.over) this.gameOver();
  }

  private async play(frames: readonly SlideFrame[]): Promise<void> {
    let lines = this.state.lines;
    let treats = this.state.treats;
    for (const f of frames) {
      this.sync(f.blocks, f.clearing, f.spawned, f.zapped);
      if (f.spawned.length > 0) this.preview.replaceChildren();
      if (f.clearing.length > 0) {
        this.host.playSound('place');
        lines += f.lines;
        this.lines.textContent = GAMES_TEXT.slideLines(lines);
        const notes: string[] = [];
        if (f.treatsEarned > 0) {
          treats += f.treatsEarned;
          this.treats.textContent = String(treats);
          this.host.earnTreats(f.treatsEarned);
          notes.push(GAMES_TEXT.earned(f.treatsEarned));
        }
        if (f.bolts.length > 0) notes.push(GAMES_TEXT.slideBonusGot.lightning);
        for (const kind of new Set(f.bonusesEarned)) notes.push(GAMES_TEXT.slideBonusGot[kind]);
        if (notes.length > 0) this.status.textContent = notes.join(' ');
      }
      await wait(f.clearing.length > 0 ? CLEAR_MS : STEP_MS);
    }
  }

  // --- Итог ---

  private gameOver(): void {
    this.finished = true;
    const before = this.host.slideStats().best ?? 0;
    const { lines, treats } = this.state;
    this.host.finishSlide(lines, treats);
    this.host.playSound(treats > 0 ? 'win' : 'lose');
    const retry = el('button', { type: 'button', class: 'chunky', text: GAMES_TEXT.retry });
    retry.addEventListener('click', () => this.cb.replay());
    const finish = el('button', { type: 'button', class: 'chunky primary', text: GAMES_TEXT.finish });
    finish.addEventListener('click', () => this.cb.done());
    const card = el('div', { class: treats > 0 ? 'q-result won' : 'q-result' }, [
      el('img', { class: 'q-result-pet', src: this.host.petImage, alt: '' }),
      el('h2', { text: GAMES_TEXT.slideOverTitle }),
      el('p', { text: GAMES_TEXT.slideOverText(this.host.petName, lines, treats) }),
    ]);
    if (lines > before && lines > 0) card.append(el('p', { class: 's-record', text: GAMES_TEXT.slideRecord }));
    card.append(el('div', { class: 'q-result-buttons' }, [retry, finish]));
    this.root.append(card);
    finish.focus();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
