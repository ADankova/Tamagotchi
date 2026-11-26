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
/** Скорость бега питомца, пикселей в миллисекунду. */
const RUN_PX_PER_MS = 0.32;
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
  /** Самая долгая пробежка: итог показывается, когда последний питомец добежит. */
  private lastRunMs = 0;

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

  /** Питомец уносит кубик: выбегает из картинки к ближайшему краю, обегает её снаружи и скрывается в норке. */
  private carry(c: Carry): void {
    const cube = this.cubes[c.cell];
    if (!cube) return;
    const stage = this.stage.getBoundingClientRect();
    const from = cube.getBoundingClientRect();
    const to = this.hole.getBoundingClientRect();
    const size = from.width;
    const rs = size * 0.8;
    const runner = el('div', { class: 'm-runner' }, [
      el('img', { class: 'm-runner-pet', src: this.host.petImage, alt: '' }),
      el('span', { class: 'm-runner-cube' }),
    ]);
    runner.style.width = `${rs}px`;
    runner.style.height = `${rs}px`;
    (runner.querySelector('.m-runner-cube') as HTMLElement).style.background = COLOR_CSS[c.color] ?? '#ccc';
    this.stage.append(runner);

    // Путь только по прямым и только по свободным местам: клетки мозаики питомец обходит.
    const c0 = this.cubes[0]!.getBoundingClientRect();
    const pitchX = this.state.w > 1 ? this.cubes[1]!.getBoundingClientRect().left - c0.left : size;
    const pitchY = this.state.h > 1 ? this.cubes[this.state.w]!.getBoundingClientRect().top - c0.top : size;
    const ox = c0.left - stage.left + c0.width / 2;
    const oy = c0.top - stage.top + c0.height / 2;
    const hx = to.left - stage.left + to.width / 2;
    const hy = to.top - stage.top + to.height / 2;
    const w = this.state.w;
    const h = this.state.h;
    const slotEl = this.slotRow.children[c.slot] as HTMLElement | undefined;
    const sr = (slotEl ?? this.hole).getBoundingClientRect();
    const sx = sr.left - stage.left + sr.width / 2;
    const sy = sr.top - stage.top + sr.height / 2;
    const goalCol = Math.min(w, Math.max(-1, Math.round((sx - ox) / pitchX)));
    const gridPath = this.freePath(c.cell % w, Math.floor(c.cell / w), goalCol, h);
    const grid: Array<[number, number]> = gridPath.map(([gx, gy]) => [ox + gx * pitchX, oy + gy * pitchY]);
    const rowY = oy + h * pitchY;
    // Питомец выбегает из своей баночки, без груза бежит к кубику по свободным местам, берёт его и несёт в норку.
    const out: Array<[number, number]> = [[sx, sy], [sx, rowY], ...grid.slice().reverse()];
    const home: Array<[number, number]> = [...grid, [hx, rowY], [hx, hy]];
    const route = out.concat(home.slice(1));
    const turn = out.length - 1;
    let total = 0;
    const lens = route.slice(1).map((p, i) => {
      const q = route[i]!;
      const len = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
      total += len;
      return len;
    });
    const duration = Math.max(900, total / RUN_PX_PER_MS);
    this.lastRunMs = Math.max(this.lastRunMs, duration);
    let acc = 0;
    let turnOffset = 0.5;
    const at = (p: [number, number]): string => `translate(${p[0] - rs / 2}px, ${p[1] - rs / 2}px)`;
    const frames: Keyframe[] = [{ offset: 0, transform: at(route[0]!), opacity: 0.2 }];
    route.slice(1).forEach((p, i) => {
      acc += lens[i]!;
      if (i + 1 === turn) turnOffset = acc / total;
      const last = i === route.length - 2;
      frames.push({ offset: acc / total, transform: at(p), opacity: last ? 0.2 : 1 });
    });
    const cubeBadge = runner.querySelector('.m-runner-cube') as HTMLElement;
    cubeBadge.style.visibility = 'hidden';
    window.setTimeout(() => {
      cube.classList.add('gone');
      cubeBadge.style.visibility = 'visible';
    }, duration * turnOffset);
    const anim = runner.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
    anim.onfinish = () => runner.remove();
    window.setTimeout(() => runner.remove(), duration + 200);
  }

  /** Кратчайший путь по пустым клеткам (с запасом в одну клетку вокруг доски и рядом внизу) с минимумом поворотов. */
  private freePath(sx: number, sy: number, gx: number, gy: number): Array<[number, number]> {
    const { w, h, cells } = this.state;
    const X0 = -1;
    const Y0 = -1;
    const W = w + 2;
    const H = h + 3;
    const free = (x: number, y: number): boolean => {
      if (x < X0 || y < Y0 || x >= X0 + W || y >= Y0 + H) return false;
      if (x < 0 || y < 0 || x >= w || y >= h) return true;
      return (cells[y * w + x] ?? -1) < 0 || (x === sx && y === sy);
    };
    const dirs: Array<[number, number]> = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    const key = (x: number, y: number, d: number): number => ((y - Y0) * W + (x - X0)) * 4 + d;
    const dist = new Map<number, number>();
    const prev = new Map<number, number>();
    const open: Array<[number, number, number, number]> = [];
    for (let d = 0; d < 4; d++) {
      dist.set(key(sx, sy, d), 0);
      open.push([0, sx, sy, d]);
    }
    let end = -1;
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i]![0] < open[bi]![0]) bi = i;
      const [cost, x, y, d] = open.splice(bi, 1)[0]!;
      const k = key(x, y, d);
      if (cost > (dist.get(k) ?? Infinity)) continue;
      if (x === gx && y === gy) {
        end = k;
        break;
      }
      dirs.forEach(([dx, dy], nd) => {
        const nx = x + dx;
        const ny = y + dy;
        if (!free(nx, ny)) return;
        const nc = cost + 1 + (nd === d ? 0 : 0.6);
        const nk = key(nx, ny, nd);
        if (nc < (dist.get(nk) ?? Infinity)) {
          dist.set(nk, nc);
          prev.set(nk, k);
          open.push([nc, nx, ny, nd]);
        }
      });
    }
    if (end < 0) return [[sx, sy], [sx, gy], [gx, gy]];
    const out: Array<[number, number]> = [];
    let k: number | undefined = end;
    while (k !== undefined) {
      const d = k % 4;
      const cell = (k - d) / 4;
      out.push([(cell % W) + X0, Math.floor(cell / W) + Y0]);
      k = prev.get(k);
    }
    out.reverse();
    // оставляем только углы
    return out.filter((p, i) => {
      if (i === 0 || i === out.length - 1) return true;
      const a = out[i - 1]!;
      const b = out[i + 1]!;
      return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
    });
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
    window.setTimeout(() => this.root.append(card), won ? this.lastRunMs : 0);
    finish.focus();
  }
}
