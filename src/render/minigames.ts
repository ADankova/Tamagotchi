import type { SoundName } from '../audio/tunes';
import {
  blockedBy,
  brokenRule,
  generatePuzzle,
  isSolutionCell,
  QUEENS_LEVELS,
  QUEENS_LIVES,
  type Puzzle,
  type QueensLevel,
  type QueensRule,
} from '../core/queens';
import { randomSeed } from '../core/rng';
import { GAMES_TEXT } from '../strings';

// Окно мини-игр поверх экрана питомца: список игр и «Судоку с питомцем».

export interface MiniGameHost {
  petName: string;
  /** Картинка питомца (data URL) — ставится в клетки вместо кота. */
  petImage: string;
  playSound: (name: SoundName) => void;
  /** Игра закончена: победа и награда в лакомствах. */
  onFinish: (won: boolean, reward: number) => void;
}

const DOUBLE_TAP_MS = 260;
const RULES: readonly QueensRule[] = ['region', 'line', 'touch'];

type Attrs = Record<string, string>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Array<Node | string> = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

/** Модальное окно мини-игр. close() закрывает его; системная «Назад» тоже ведёт сюда. */
export class GamesOverlay {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private game: QueensGame | null = null;

  constructor(
    private readonly host: MiniGameHost,
    private readonly onClose: () => void,
  ) {
    this.body = el('div', { class: 'overlay-body' });
    this.root = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': GAMES_TEXT.menuTitle }, [this.body]);
    document.body.append(this.root);
    document.body.classList.add('overlay-open');
    this.showMenu();
  }

  /** «Назад»: из игры — в список, из списка — закрыть окно. */
  back(): void {
    if (this.game) {
      if (this.game.hasProgress() && !window.confirm(GAMES_TEXT.leaveConfirm)) return;
      this.game = null;
      this.showMenu();
    } else {
      this.close();
    }
  }

  close(): void {
    this.root.remove();
    document.body.classList.remove('overlay-open');
    this.onClose();
  }

  private header(title: string, onBack: () => void, backLabel: string): HTMLElement {
    const back = el('button', { type: 'button', class: 'chunky back', 'aria-label': backLabel, text: backLabel === GAMES_TEXT.close ? '✕' : '←' });
    back.addEventListener('click', onBack);
    return el('div', { class: 'memory-head overlay-head' }, [back, el('h1', { text: title })]);
  }

  private showMenu(): void {
    const levels = QUEENS_LEVELS.map((level, i) => {
      const b = el('button', { type: 'button', class: 'chunky level-button' }, [
        el('span', { class: 'level-name', text: GAMES_TEXT.levelNames[i] ?? '' }),
        el('span', { class: 'level-info', text: GAMES_TEXT.level(level.size, level.reward) }),
      ]);
      b.addEventListener('click', () => this.startQueens(level));
      return b;
    });
    const card = el('section', { class: 'game-card' }, [
      el('div', { class: 'game-card-head' }, [
        el('img', { class: 'game-card-pet', src: this.host.petImage, alt: '' }),
        el('h2', { text: GAMES_TEXT.queensTitle }),
      ]),
      el('p', { class: 'game-card-about', text: GAMES_TEXT.queensAbout }),
      el('div', { class: 'level-buttons' }, levels),
    ]);
    this.body.replaceChildren(
      this.header(GAMES_TEXT.menuTitle, () => this.close(), GAMES_TEXT.close),
      el('p', { class: 'intro overlay-intro', text: GAMES_TEXT.menuIntro }),
      card,
      el('p', { class: 'game-card soon', text: GAMES_TEXT.soon }),
    );
    this.body.querySelector<HTMLElement>('.level-button')?.focus();
  }

  private startQueens(level: QueensLevel): void {
    this.game = new QueensGame(level, this.host, {
      header: (title) => this.header(title, () => this.back(), '←'),
      replay: () => this.startQueens(level),
      done: (won) => {
        this.host.onFinish(won, won ? level.reward : 0);
        this.close();
      },
    });
    this.body.replaceChildren(this.game.root);
  }
}

interface QueensCallbacks {
  header: (title: string) => HTMLElement;
  replay: () => void;
  done: (won: boolean) => void;
}

type Mark = 'none' | 'cross' | 'auto' | 'wrong' | 'pet';

/** Экран головоломки: поле, сердечки, правила, победа и поражение. */
class QueensGame {
  readonly root: HTMLElement;
  private readonly puzzle: Puzzle;
  private readonly marks: Mark[][];
  private readonly cells: HTMLButtonElement[][] = [];
  private readonly placed: Array<[number, number]> = [];
  private lives = QUEENS_LIVES;
  private moves = 0;
  private finished = false;
  private pendingTap: { r: number; c: number; timer: number } | null = null;
  private readonly progress = el('span', { class: 'q-progress' });
  private readonly hearts = el('span', { class: 'q-hearts', role: 'img' });
  private readonly ruleChips = new Map<QueensRule, HTMLElement>();
  private readonly status = el('p', { class: 'q-status', role: 'status', 'aria-live': 'polite' });
  private readonly board: HTMLElement;

  constructor(
    private readonly level: QueensLevel,
    private readonly host: MiniGameHost,
    private readonly cb: QueensCallbacks,
  ) {
    this.puzzle = generatePuzzle(level.size, randomSeed());
    const n = level.size;
    this.marks = Array.from({ length: n }, () => Array<Mark>(n).fill('none'));

    this.board = el('div', { class: 'q-board', role: 'grid', style: `--n: ${n}` });
    for (let r = 0; r < n; r++) {
      const row: HTMLButtonElement[] = [];
      for (let c = 0; c < n; c++) {
        const region = this.puzzle.regions[r]![c]!;
        const cell = el('button', { type: 'button', class: 'q-cell', 'data-region': String(region), role: 'gridcell' });
        cell.addEventListener('click', () => this.tap(r, c));
        this.board.append(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }

    const chips = el('div', { class: 'q-rules' });
    for (const rule of RULES) {
      const chip = el('span', { class: 'q-rule', text: GAMES_TEXT.rules[rule] });
      chips.append(chip);
      this.ruleChips.set(rule, chip);
    }

    this.root = el('div', { class: 'q-game' }, [
      cb.header(GAMES_TEXT.queensTitle),
      el('div', { class: 'q-top' }, [
        el('span', { class: 'q-chip' }, [el('img', { class: 'q-chip-pet', src: host.petImage, alt: '' }), this.progress]),
        el('span', { class: 'q-chip' }, [this.hearts]),
      ]),
      chips,
      el('div', { class: 'q-board-wrap' }, [this.board]),
      this.status,
      el('p', { class: 'q-hint', text: GAMES_TEXT.hint }),
    ]);
    this.renderAll();
  }

  hasProgress(): boolean {
    return this.moves > 0 && !this.finished;
  }

  // --- Ввод: одно касание — крестик, двойное — питомец ---

  private tap(r: number, c: number): void {
    if (this.finished) return;
    const pending = this.pendingTap;
    if (pending && pending.r === r && pending.c === c) {
      window.clearTimeout(pending.timer);
      this.pendingTap = null;
      this.placePet(r, c);
      return;
    }
    if (pending) {
      window.clearTimeout(pending.timer);
      this.toggleCross(pending.r, pending.c);
    }
    const timer = window.setTimeout(() => {
      this.pendingTap = null;
      this.toggleCross(r, c);
    }, DOUBLE_TAP_MS);
    this.pendingTap = { r, c, timer };
  }

  private toggleCross(r: number, c: number): void {
    const m = this.marks[r]![c]!;
    if (m === 'pet' || m === 'wrong') return;
    this.marks[r]![c] = m === 'none' ? 'cross' : 'none';
    this.moves++;
    this.host.playSound('mark');
    this.renderCell(r, c);
  }

  private placePet(r: number, c: number): void {
    const m = this.marks[r]![c]!;
    if (m === 'pet' || m === 'wrong') return;
    this.moves++;
    if (isSolutionCell(this.puzzle, r, c)) {
      this.marks[r]![c] = 'pet';
      this.placed.push([r, c]);
      for (const [y, x] of blockedBy(this.puzzle, r, c)) {
        if (this.marks[y]![x] === 'none') this.marks[y]![x] = 'auto';
      }
      this.host.playSound('place');
      this.status.textContent = '';
      this.renderAll();
      this.pop(this.cells[r]![c]!);
      if (this.placed.length === this.puzzle.size) this.win();
      return;
    }
    // Ошибка: минус сердечко, клетка зачёркивается, нарушенное правило подсвечивается.
    const rule = brokenRule(this.puzzle, this.placed, r, c);
    this.marks[r]![c] = 'wrong';
    this.lives--;
    this.host.playSound('miss');
    this.status.textContent = GAMES_TEXT.wrong;
    this.renderAll();
    this.shake(this.cells[r]![c]!);
    if (rule) this.flashRule(rule);
    if (this.lives <= 0) this.lose();
  }

  // --- Отрисовка ---

  private renderAll(): void {
    for (let r = 0; r < this.puzzle.size; r++) for (let c = 0; c < this.puzzle.size; c++) this.renderCell(r, c);
    this.progress.textContent = GAMES_TEXT.progress(this.placed.length, this.puzzle.size);
    this.hearts.replaceChildren(
      ...Array.from({ length: QUEENS_LIVES }, (_, i) => el('span', { class: i < this.lives ? 'q-heart' : 'q-heart lost', text: '♥' })),
    );
    this.hearts.setAttribute('aria-label', GAMES_TEXT.livesLabel(this.lives));
  }

  private renderCell(r: number, c: number): void {
    const cell = this.cells[r]![c]!;
    const mark = this.marks[r]![c]!;
    cell.dataset.mark = mark;
    const region = this.puzzle.regions[r]![c]!;
    const what = mark === 'pet' ? `, ${GAMES_TEXT.cellPet}` : mark === 'none' ? '' : `, ${GAMES_TEXT.cellCross}`;
    cell.setAttribute('aria-label', GAMES_TEXT.cell(r + 1, c + 1, GAMES_TEXT.regionColors[region] ?? '') + what);
    if (mark === 'pet') {
      if (!cell.querySelector('img')) cell.replaceChildren(el('img', { class: 'q-pet', src: this.host.petImage, alt: '' }));
    } else if (mark === 'none') {
      cell.replaceChildren();
    } else if (!cell.querySelector('.q-x')) {
      cell.replaceChildren(el('span', { class: 'q-x', 'aria-hidden': 'true' }));
    }
  }

  private flashRule(rule: QueensRule): void {
    const chip = this.ruleChips.get(rule);
    if (!chip) return;
    chip.classList.remove('broken');
    void chip.offsetWidth;
    chip.classList.add('broken');
  }

  private shake(node: HTMLElement): void {
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
  }

  private pop(node: HTMLElement): void {
    node.classList.remove('pop');
    void node.offsetWidth;
    node.classList.add('pop');
  }

  // --- Итог ---

  private win(): void {
    this.finished = true;
    this.host.playSound('win');
    this.showResult(true);
  }

  private lose(): void {
    this.finished = true;
    this.host.playSound('lose');
    this.showResult(false);
  }

  private showResult(won: boolean): void {
    const primary = el('button', { type: 'button', class: 'chunky primary', text: won ? GAMES_TEXT.winButton : GAMES_TEXT.finish });
    primary.addEventListener('click', () => this.cb.done(won));
    const buttons = [primary];
    if (!won) {
      const retry = el('button', { type: 'button', class: 'chunky', text: GAMES_TEXT.retry });
      retry.addEventListener('click', () => this.cb.replay());
      buttons.unshift(retry);
    }
    const card = el('div', { class: won ? 'q-result won' : 'q-result' }, [
      el('img', { class: 'q-result-pet', src: this.host.petImage, alt: '' }),
      el('h2', { text: won ? GAMES_TEXT.winTitle : GAMES_TEXT.loseTitle }),
      el('p', { text: won ? GAMES_TEXT.winText(this.host.petName, this.level.reward) : GAMES_TEXT.loseText(this.host.petName) }),
      el('div', { class: 'q-result-buttons' }, buttons),
    ]);
    this.root.append(card);
    primary.focus();
  }
}
