import type { SoundName } from '../audio/tunes';
import {
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
import type { LevelStats } from '../core/stats';
import { SLIDE_MODES, type SlideMode } from '../core/slide';
import { MOSAIC_PICTURE_NAMES, MOSAIC_REWARD, type MosaicPicture } from '../core/mosaic';
import { MosaicGame } from './mosaic';
import { HarborGame } from './harbor';
import { SlideGame } from './slide';
import { GAMES_TEXT } from '../strings';
import { el } from './dom';

// Окно мини-игр поверх экрана питомца: список игр и «Судоку с питомцем».

export interface MiniGameHost {
  petName: string;
  /** Картинка питомца (data URL) — ставится в клетки вместо кота. */
  petImage: string;
  playSound: (name: SoundName) => void;
  /** Сыграно и выиграно на уровне «Судоку» с полем size×size. */
  stats: (size: number) => LevelStats;
  /** Партия закончена: победа, награда в лакомствах и размер поля (для счётчиков). */
  onFinish: (won: boolean, reward: number, size: number) => void;
  /** «Питомцы-блоки»: сыграно и рекорд. */
  slideStats: (mode: SlideMode) => LevelStats;
  /** Лакомство собрано прямо в игре — начислить сразу. */
  earnTreats: (n: number) => void;
  /** Партия «Питомцев-блоков» окончена: счётчики и эффект игры. */
  finishSlide: (mode: SlideMode, lines: number, treats: number) => void;
  /** «Мозаика»: сыграно и выиграно на картинке. */
  mosaicStats: (picture: MosaicPicture) => LevelStats;
  /** Партия «Мозаики» окончена. */
  finishMosaic: (picture: MosaicPicture, won: boolean) => void;
  /** «Бухта питомцев»: сыграно и выиграно. */
  harborStats: () => LevelStats;
  /** Партия «Бухты питомцев» окончена. */
  finishHarbor: (won: boolean) => void;
  /** Картинка лакомства (data URL). */
  treatImage: string;
}

/** Экран одной игры внутри окна. */
export interface GameScreen {
  readonly root: HTMLElement;
  hasProgress(): boolean;
  /** Что спросить, прежде чем выйти посреди партии. */
  readonly leaveText: string;
  /** Вызывается, когда игрок всё-таки вышел посреди партии. */
  leave?(): void;
}

const DOUBLE_TAP_MS = 260;
const RULES: readonly QueensRule[] = ['region', 'line', 'touch'];

/** Модальное окно мини-игр. close() закрывает его; системная «Назад» тоже ведёт сюда. */
export class GamesOverlay {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private game: GameScreen | null = null;

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
      if (this.game.hasProgress()) {
        if (!window.confirm(this.game.leaveText)) return;
        this.game.leave?.();
      }
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
        el('span', { class: 'level-stats', text: ((st) => GAMES_TEXT.stats(st.played, st.won))(this.host.stats(level.size)) }),
      ]);
      b.addEventListener('click', () => this.startQueens(level));
      return b;
    });
    const card = this.gameCard('queens', GAMES_TEXT.queensTitle, GAMES_TEXT.queensAbout, levels);
    const slideButtons = SLIDE_MODES.map((mode) => {
      const st = this.host.slideStats(mode);
      const button = el('button', { type: 'button', class: `chunky level-button slide-play ${mode}` }, [
        el('span', { class: 'level-name', text: GAMES_TEXT.slideModeName[mode] }),
        el('span', { class: 'level-info', text: GAMES_TEXT.slideModeInfo[mode] }),
        el('span', { class: 'level-stats', text: GAMES_TEXT.slideStats(st.played, st.best ?? 0) }),
      ]);
      button.addEventListener('click', () => this.startSlide(mode));
      return button;
    });
    const slideCard = this.gameCard('slide', GAMES_TEXT.slideTitle, GAMES_TEXT.slideAbout, slideButtons);
    // Картинку не выбирают: при каждой партии она берётся случайно. Счёт общий по всем картинкам.
    const mosaicTotal = MOSAIC_PICTURE_NAMES.reduce(
      (acc, picture) => {
        const st = this.host.mosaicStats(picture);
        return { played: acc.played + st.played, won: acc.won + st.won };
      },
      { played: 0, won: 0 },
    );
    const mosaicButton = el('button', { type: 'button', class: 'chunky level-button' }, [
      el('span', { class: 'level-name', text: GAMES_TEXT.mosaicLevel }),
      el('span', { class: 'level-info', text: GAMES_TEXT.mosaicInfo(MOSAIC_REWARD) }),
      el('span', { class: 'level-stats', text: GAMES_TEXT.mosaicStats(mosaicTotal.played, mosaicTotal.won) }),
    ]);
    mosaicButton.addEventListener('click', () => this.startMosaic());
    const mosaicButtons = [mosaicButton];
    const mosaicCard = this.gameCard('mosaic', GAMES_TEXT.mosaicTitle, GAMES_TEXT.mosaicAbout, mosaicButtons);
    const harborStats = this.host.harborStats();
    const harborButton = el('button', { type: 'button', class: 'chunky level-button' }, [
      el('span', { class: 'level-name', text: GAMES_TEXT.harborLevel }),
      el('span', { class: 'level-info', text: GAMES_TEXT.harborInfo() }),
      el('span', { class: 'level-stats', text: GAMES_TEXT.harborStats(harborStats.played, harborStats.won) }),
    ]);
    harborButton.addEventListener('click', () => this.startHarbor());
    const harborCard = this.gameCard('harbor', GAMES_TEXT.harborTitle, GAMES_TEXT.harborAbout, [harborButton]);
    this.body.replaceChildren(
      this.header(GAMES_TEXT.menuTitle, () => this.close(), GAMES_TEXT.close),
      el('p', { class: 'intro overlay-intro', text: GAMES_TEXT.menuIntro }),
      card,
      slideCard,
      mosaicCard,
      harborCard,
      el('p', { class: 'game-card soon', text: GAMES_TEXT.soon }),
    );
    this.body.querySelector<HTMLElement>('.level-button')?.focus();
  }

  /** Карточка игры: описание спрятано и раскрывается кнопкой «i». */
  private gameCard(id: string, title: string, about: string, buttons: HTMLElement[]): HTMLElement {
    const aboutId = `game-about-${id}`;
    const text = el('p', { class: 'game-card-about', id: aboutId, text: about });
    text.hidden = true;
    const info = el('button', {
      type: 'button',
      class: 'info-button',
      'aria-expanded': 'false',
      'aria-controls': aboutId,
      'aria-label': GAMES_TEXT.rulesButton(title),
      text: 'i',
    });
    info.addEventListener('click', () => {
      text.hidden = !text.hidden;
      info.setAttribute('aria-expanded', String(!text.hidden));
      info.classList.toggle('open', !text.hidden);
    });
    return el('section', { class: 'game-card' }, [
      el('div', { class: 'game-card-head' }, [
        el('img', { class: 'game-card-pet', src: this.host.petImage, alt: '' }),
        el('h2', { text: title }),
        info,
      ]),
      text,
      el('div', { class: 'level-buttons' }, buttons),
    ]);
  }

  private startQueens(level: QueensLevel): void {
    this.game = new QueensGame(level, this.host, {
      header: (title) => this.header(title, () => this.back(), '←'),
      replay: () => this.startQueens(level),
      done: (won) => {
        this.host.onFinish(won, won ? level.reward : 0, level.size);
        this.close();
      },
    });
    this.body.replaceChildren(this.game.root);
  }

  private startMosaic(previous?: MosaicPicture): void {
    const others = MOSAIC_PICTURE_NAMES.filter((name) => name !== previous);
    const picture = others[Math.floor(Math.random() * others.length)] ?? MOSAIC_PICTURE_NAMES[0]!;
    this.game = new MosaicGame(this.host, picture, {
      header: (title) => this.header(title, () => this.back(), '←'),
      replay: () => this.startMosaic(picture),
      done: () => this.close(),
    });
    this.body.replaceChildren(this.game.root);
  }

  private startHarbor(): void {
    this.game = new HarborGame(this.host, {
      header: (title) => this.header(title, () => this.back(), '←'),
      replay: () => this.startHarbor(),
      done: () => this.close(),
    });
    this.body.replaceChildren(this.game.root);
  }

  private startSlide(mode: SlideMode): void {
    this.game = new SlideGame(this.host, mode, {
      header: (title) => this.header(title, () => this.back(), '←'),
      replay: () => this.startSlide(mode),
      done: () => this.close(),
    });
    this.body.replaceChildren(this.game.root);
  }
}

interface QueensCallbacks {
  header: (title: string) => HTMLElement;
  replay: () => void;
  done: (won: boolean) => void;
}

type Mark = 'none' | 'cross' | 'wrong' | 'pet';

/** Экран головоломки: поле, сердечки, правила, победа и поражение. */
class QueensGame implements GameScreen {
  readonly leaveText = GAMES_TEXT.leaveConfirm;
  readonly root: HTMLElement;
  private readonly puzzle: Puzzle;
  private readonly marks: Mark[][];
  private readonly cells: HTMLButtonElement[][] = [];
  private readonly placed: Array<[number, number]> = [];
  private lives = QUEENS_LIVES;
  private moves = 0;
  private finished = false;
  private pendingTap: { r: number; c: number; timer: number } | null = null;
  /** Протягивание пальцем по клеткам: ставит крестики (или стирает, если начали с крестика). */
  private drag: { start: [number, number]; erase: boolean; active: boolean; last: string } | null = null;
  private suppressClick = false;
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
        const cell = el('button', {
          type: 'button',
          class: 'q-cell',
          'data-region': String(region),
          'data-r': String(r),
          'data-c': String(c),
          role: 'gridcell',
        });
        cell.addEventListener('click', () => {
          // Клик, завершающий протягивание пальцем, — не касание.
          if (this.suppressClick) {
            this.suppressClick = false;
            return;
          }
          this.tap(r, c);
        });
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
    this.bindDrag();
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

  // --- Протягивание: крестики вслед за пальцем ---

  private bindDrag(): void {
    this.board.addEventListener('pointerdown', (e) => {
      if (this.finished || !e.isPrimary) return;
      this.suppressClick = false; // новый жест
      const pos = this.cellAt(e.clientX, e.clientY);
      if (!pos) return;
      const [r, c] = pos;
      this.drag = { start: pos, erase: this.marks[r]![c] === 'cross', active: false, last: `${r},${c}` };
    });
    this.board.addEventListener('pointermove', (e) => {
      const drag = this.drag;
      if (!drag || this.finished) return;
      const pos = this.cellAt(e.clientX, e.clientY);
      if (!pos) return;
      const key = `${pos[0]},${pos[1]}`;
      if (key === drag.last) return;
      drag.last = key;
      if (!drag.active) {
        // Палец ушёл с первой клетки — это протягивание, а не касание.
        drag.active = true;
        if (this.pendingTap) {
          window.clearTimeout(this.pendingTap.timer);
          this.pendingTap = null;
        }
        this.paint(drag.start[0], drag.start[1], drag.erase);
      }
      this.paint(pos[0], pos[1], drag.erase);
    });
    const end = () => {
      if (this.drag?.active) this.suppressClick = true;
      this.drag = null;
    };
    this.board.addEventListener('pointerup', end);
    this.board.addEventListener('pointercancel', () => {
      this.drag = null;
    });
  }

  private cellAt(x: number, y: number): [number, number] | null {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('.q-cell');
    if (!target || !this.board.contains(target)) return null;
    return [Number(target.dataset.r), Number(target.dataset.c)];
  }

  /** Поставить (или стереть) крестик протягиванием; питомцев и ошибки не трогает. */
  private paint(r: number, c: number, erase: boolean): void {
    const m = this.marks[r]![c]!;
    if (m === 'pet' || m === 'wrong') return;
    const next: Mark = erase ? 'none' : 'cross';
    if (m === next) return;
    this.marks[r]![c] = next;
    this.moves++;
    this.host.playSound('mark');
    this.renderCell(r, c);
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
      // Крестики вокруг игрок ставит сам — так интереснее.
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
