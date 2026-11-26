import { randomSeed } from '../core/rng';
import {
  MOSAIC_REWARD,
  newMosaic,
  stepMosaic,
  tapJar,
  type Carry,
  type Jar,
  type MosaicPicture,
  type MosaicState,
} from '../core/mosaic';
import { GAMES_TEXT } from '../strings';
import { el } from './dom';
import type { GameScreen, MiniGameHost } from './minigames';

// Экран «Мозаики»: картинка из кубиков, норка, ячейки и очереди баночек.

const STEP_MS = 340;
const FLY_MS = 650;
/** Цвета кубиков и баночек: тот же порядок, что в MOSAIC_COLORS (B, R, P, W). */
const COLOR_CSS = ['#5aaef0', '#e8505b', '#ffa6c9', '#fff6e6'] as const;
const VISIBLE_IN_QUEUE = 3;

interface MosaicCallbacks {
  header: (title: string) => HTMLElement;
  replay: () => void;
  done: () => void;
}

export class MosaicGame implements GameScreen {
  readonly root: HTMLElement;
  readonly leaveText = GAMES_TEXT.mosaicLeaveConfirm;
  private state: MosaicState;
  private readonly stage = el('div', { class: 'm-stage' });
  private readonly board = el('div', { class: 'm-board' });
  private readonly hole = el('div', { class: 'm-hole' });
  private readonly slotRow = el('div', { class: 'm-slots' });
  private readonly queues = el('div', { class: 'm-queues' });
  private readonly left = el('span', {});
  private readonly cubes: HTMLElement[] = [];
  private timer = 0;
  private seen = false;
  private finished = false;

  constructor(
    private readonly host: MiniGameHost,
    private readonly picture: MosaicPicture,
    private readonly cb: MosaicCallbacks,
  ) {
    this.state = newMosaic(randomSeed(), picture);
    this.board.style.gridTemplateColumns = `repeat(${this.state.w}, 1fr)`;
    this.board.style.aspectRatio = `${this.state.w} / ${this.state.h}`;
    this.state.cells.forEach((color) => {
      const cube = el('div', { class: 'm-cube' });
      cube.style.background = COLOR_CSS[color] ?? '#ccc';
      this.cubes.push(cube);
      this.board.append(cube);
    });
    this.stage.append(this.board, this.hole);
    this.root = el('div', { class: 'q-game m-game' }, [
      cb.header(GAMES_TEXT.mosaicTitle),
      el('div', { class: 'q-top' }, [el('span', { class: 'q-chip' }, [this.left])]),
      this.stage,
      this.slotRow,
      this.queues,
      el('p', { class: 'q-hint', text: GAMES_TEXT.mosaicHint }),
    ]);
    this.renderJars();
    this.renderLeft();
    this.timer = window.setInterval(() => this.tick(), STEP_MS);
  }

  /** Выйти из партии посреди игры — ничего не теряется, но и не сохраняется. */
  hasProgress(): boolean {
    return !this.finished && this.state.moves > 0;
  }

  leave(): void {
    window.clearInterval(this.timer);
  }

  private jarNode(jar: Jar, front: boolean, hidden: boolean): HTMLElement {
    const node = el(front ? 'button' : 'div', { class: 'm-jar', 'aria-label': GAMES_TEXT.mosaicJar(jar.n) }, [
      el('span', { class: 'm-jar-lid' }),
      el('span', { class: 'm-jar-n', text: hidden ? '?' : String(jar.n) }),
    ]);
    node.style.setProperty('--jar', COLOR_CSS[jar.color] ?? '#ccc');
    node.classList.toggle('back', !front);
    node.classList.toggle('hidden-n', hidden);
    return node;
  }

  private renderJars(): void {
    this.slotRow.replaceChildren(
      ...this.state.slots.map((jar) => {
        const slot = el('div', { class: jar ? 'm-slot full' : 'm-slot' });
        if (jar) slot.append(this.jarNode(jar, false, false), el('img', { class: 'm-slot-pet', src: this.host.petImage, alt: '' }));
        return slot;
      }),
    );
    this.queues.replaceChildren(
      ...this.state.columns.map((queue, col) => {
        const column = el('div', { class: 'm-queue' });
        queue.slice(0, VISIBLE_IN_QUEUE).forEach((jar, i) => {
          const node = this.jarNode(jar, i === 0, i >= 2);
          if (i === 0) node.addEventListener('click', () => this.tap(col));
          column.append(node);
        });
        return column;
      }),
    );
  }

  private renderLeft(): void {
    this.left.textContent = GAMES_TEXT.mosaicLeft(this.state.left);
  }

  private tap(col: number): void {
    if (this.finished) return;
    const next = tapJar(this.state, col);
    if (!next) {
      this.host.playSound('blocked');
      return;
    }
    this.host.playSound('place');
    this.state = next;
    this.renderJars();
    this.checkEnd();
  }

  private tick(): void {
    if (!this.root.isConnected) {
      // Окно игры закрыли — таймер больше не нужен.
      if (this.seen) window.clearInterval(this.timer);
      return;
    }
    this.seen = true;
    if (this.finished) return;
    const { state, carries } = stepMosaic(this.state);
    if (carries.length === 0) return;
    this.state = state;
    carries.forEach((c) => this.carry(c));
    this.renderJars();
    this.renderLeft();
    this.checkEnd();
  }

  /** Питомец уносит кубик из картинки в норку. */
  private carry(c: Carry): void {
    const cube = this.cubes[c.cell];
    if (!cube) return;
    cube.classList.add('gone');
    const stage = this.stage.getBoundingClientRect();
    const from = cube.getBoundingClientRect();
    const to = this.hole.getBoundingClientRect();
    const size = from.width;
    const runner = el('div', { class: 'm-runner' }, [
      el('img', { class: 'm-runner-pet', src: this.host.petImage, alt: '' }),
      el('span', { class: 'm-runner-cube' }),
    ]);
    runner.style.width = `${size * 1.6}px`;
    runner.style.height = `${size * 1.6}px`;
    const x0 = from.left - stage.left + size / 2 - (size * 1.6) / 2;
    const y0 = from.top - stage.top + size / 2 - (size * 1.6) / 2;
    runner.style.transform = `translate(${x0}px, ${y0}px)`;
    (runner.querySelector('.m-runner-cube') as HTMLElement).style.background = COLOR_CSS[c.color] ?? '#ccc';
    this.stage.append(runner);
    const x1 = to.left - stage.left + to.width / 2 - (size * 1.6) / 2;
    const y1 = to.top - stage.top + to.height / 2 - (size * 1.6) / 2;
    window.requestAnimationFrame(() => {
      runner.style.transition = `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`;
      runner.style.transform = `translate(${x1}px, ${y1}px) scale(0.5)`;
      runner.style.opacity = '0.2';
    });
    window.setTimeout(() => runner.remove(), FLY_MS + 60);
  }

  private checkEnd(): void {
    if (this.finished || (!this.state.won && !this.state.stuck)) return;
    this.finished = true;
    window.clearInterval(this.timer);
    const won = this.state.won;
    this.host.finishMosaic(this.picture, won);
    this.host.playSound(won ? 'win' : 'lose');
    const retry = el('button', { type: 'button', class: 'chunky', text: GAMES_TEXT.retry });
    retry.addEventListener('click', () => this.cb.replay());
    const finish = el('button', { type: 'button', class: 'chunky primary', text: GAMES_TEXT.finish });
    finish.addEventListener('click', () => this.cb.done());
    const card = el('div', { class: won ? 'q-result won' : 'q-result' }, [
      el('img', { class: 'q-result-pet', src: this.host.petImage, alt: '' }),
      el('h2', { text: won ? GAMES_TEXT.mosaicWinTitle : GAMES_TEXT.mosaicStuckTitle }),
      el('p', { text: won ? GAMES_TEXT.mosaicWinText(this.host.petName, MOSAIC_REWARD) : GAMES_TEXT.mosaicStuckText(this.host.petName) }),
      el('div', { class: 'q-result-buttons' }, [retry, finish]),
    ]);
    // Победа ждёт, пока улетят последние кубики.
    window.setTimeout(() => this.root.append(card), won ? FLY_MS : 0);
    finish.focus();
  }
}
