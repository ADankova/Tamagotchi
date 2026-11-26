import { randomSeed } from '../core/rng';
import {
  MOSAIC_COLOR_HEX,
  MOSAIC_REWARD,
  newMosaic,
  pickCell,
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

const STEP_MS = 260;
/** Скорость бега питомца, пикселей в миллисекунду. */
const RUN_PX_PER_MS = 0.11;
/** Доступные скорости: множитель бега питомцев и темпа игры. */
const SPEEDS = [1, 2, 3] as const;
const COLOR_CSS = MOSAIC_COLOR_HEX;
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
  private linksHtml = '';
  private readonly links = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private readonly left = el('span', {});
  private readonly cubes: HTMLElement[] = [];
  /** Кубик ещё виден на поле (его уже «взяли» в расчёте, но питомец ещё не добежал): обходить нужно и такие. */
  private readonly solid: boolean[] = [];
  private timer = 0;
  private seen = false;
  private finished = false;
  /** Самая долгая пробежка: итог показывается, когда последний питомец добежит. */
  private lastRunMs = 0;
  private speed: number = SPEEDS[0];
  private readonly speedButton = el('button', { type: 'button', class: 'm-speed' });
  /** Питомцы, которые ждут, пока освободится путь к кубику. */
  private waiting = 0;

  constructor(
    private readonly host: MiniGameHost,
    private readonly picture: MosaicPicture,
    private readonly cb: MosaicCallbacks,
  ) {
    this.state = newMosaic(randomSeed(), picture);
    this.stage.style.setProperty('--ar', String(this.state.w / this.state.h));
    this.board.style.gridTemplateColumns = `repeat(${this.state.w}, 1fr)`;
    this.board.style.aspectRatio = `${this.state.w} / ${this.state.h}`;
    this.state.cells.forEach((color) => {
      const cube = el('div', { class: 'm-cube' });
      cube.style.background = COLOR_CSS[color] ?? '#ccc';
      if (color < 0) cube.classList.add('gone');
      this.solid.push(color >= 0);
      this.cubes.push(cube);
      this.board.append(cube);
    });
    this.stage.append(this.board, this.hole);
    this.root = el('div', { class: 'q-game m-game' }, [
      cb.header(GAMES_TEXT.mosaicTitle),
      el('div', { class: 'q-top' }, [el('span', { class: 'q-chip' }, [this.left]), this.speedButton]),
      this.stage,
      el('div', { class: 'm-bottom' }, [this.links, this.slotRow, this.queues]),
      el('p', { class: 'q-hint', text: GAMES_TEXT.mosaicHint }),
    ]);
    this.links.setAttribute('class', 'm-links');
    this.links.setAttribute('aria-hidden', 'true');
    this.renderJars();
    this.renderLeft();
    window.requestAnimationFrame(() => this.drawLinks());
    this.speedButton.addEventListener('click', () => this.nextSpeed());
    this.showSpeed();
    this.timer = window.setInterval(() => this.tick(), STEP_MS / this.speed);
  }

  private showSpeed(): void {
    this.speedButton.textContent = `▶▶ ×${this.speed}`;
    this.speedButton.setAttribute('aria-label', GAMES_TEXT.mosaicSpeed(this.speed));
  }

  /** Кнопка скорости: питомцы бегают и игра идёт быстрее; уже бегущие доигрывают прежним темпом. */
  private nextSpeed(): void {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]!;
    this.showSpeed();
    if (this.finished) return;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), STEP_MS / this.speed);
  }

  /** Выйти из партии посреди игры — ничего не теряется, но и не сохраняется. */
  hasProgress(): boolean {
    return !this.finished && this.state.moves > 0;
  }

  leave(): void {
    window.clearInterval(this.timer);
  }

  private jarNode(jar: Jar, front: boolean, hidden: boolean): HTMLElement {
    const node = el(front ? 'button' : 'div', { class: 'm-jar', 'aria-label': GAMES_TEXT.mosaicJar(jar.n), 'data-jar': String(jar.id) }, [
      el('span', { class: 'm-jar-lid' }),
      el('span', { class: 'm-jar-n', text: jar.n <= 0 ? '' : hidden ? '?' : String(jar.n) }),
    ]);
    node.style.setProperty('--jar', COLOR_CSS[jar.color] ?? '#ccc');
    node.classList.toggle('back', !front);
    node.classList.toggle('hidden-n', hidden);
    node.classList.toggle('spent', jar.n <= 0);
    node.classList.toggle('linked', jar.pair !== undefined);
    return node;
  }

  /** Соединения между связанными баночками: труба цвета обеих баночек. */
  private drawLinks(): void {
    if (!this.root.isConnected) return;
    const box = this.links.parentElement?.getBoundingClientRect();
    if (!box) return;
    const nodes = new Map<string, HTMLElement>();
    this.links.parentElement!.querySelectorAll<HTMLElement>('.m-jar[data-jar]').forEach((n) => nodes.set(n.dataset.jar!, n));
    const jars = [...this.state.slots, ...this.state.columns.flat()].filter((j): j is Jar => !!j);
    const parts: string[] = [];
    jars.forEach((jar, i) => {
      if (jar.pair === undefined) return;
      const a = nodes.get(String(jar.id));
      const b = nodes.get(String(jar.pair));
      const mate = jars.find((j) => j.id === jar.pair);
      if (!mate) return;
      if (a && !b) {
        // Пара лежит глубже видимых рядов очереди: короткая труба уходит вниз, чтобы связь была видна заранее.
        const ra = a.getBoundingClientRect();
        const x = ra.left + ra.width / 2 - box.left;
        const y1 = ra.top + ra.height / 2 - box.top;
        const y2 = ra.bottom - box.top + 12;
        const gid = `ls${i}`;
        parts.push(
          `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"><stop offset="0.5" stop-color="${COLOR_CSS[jar.color]}"/><stop offset="1" stop-color="${COLOR_CSS[mate.color]}"/></linearGradient>` +
            `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#3b2a1e" stroke-width="16" stroke-linecap="round"/>` +
            `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="url(#${gid})" stroke-width="10" stroke-linecap="round"/>`,
        );
        return;
      }
      if (!a || !b || jar.id > jar.pair) return;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.left + ra.width / 2 - box.left;
      const y1 = ra.top + ra.height / 2 - box.top;
      const x2 = rb.left + rb.width / 2 - box.left;
      const y2 = rb.top + rb.height / 2 - box.top;
      const gid = `lg${i}`;
      parts.push(
        `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0.3" stop-color="${COLOR_CSS[jar.color]}"/><stop offset="0.7" stop-color="${COLOR_CSS[mate.color]}"/></linearGradient>` +
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3b2a1e" stroke-width="16" stroke-linecap="round"/>` +
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#${gid})" stroke-width="10" stroke-linecap="round"/>`,
      );
    });
    const html = parts.join('');
    if (html !== this.linksHtml) {
      this.linksHtml = html;
      this.links.innerHTML = html;
    }
  }

  private renderJars(): void {
    // Запоминаем, где баночки стояли, чтобы после перерисовки плавно довести их до новых мест.
    const before = new Map<string, DOMRect>();
    this.root.querySelectorAll<HTMLElement>('.m-jar[data-jar]').forEach((n) => before.set(n.dataset.jar!, n.getBoundingClientRect()));
    this.paintJars();
    if (before.size === 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let moving = false;
    this.root.querySelectorAll<HTMLElement>('.m-jar[data-jar]').forEach((node) => {
      const old = before.get(node.dataset.jar!);
      const now = node.getBoundingClientRect();
      if (old) {
        const dx = old.left - now.left;
        const dy = old.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        moving = true;
        node.animate([{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 3 }, { transform: 'translate(0, 0)', zIndex: 3 }], { duration: 340, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' });
      } else if (node.closest('.m-queue')) {
        // Баночка, которая только что показалась в очереди, выезжает снизу.
        moving = true;
        node.animate([{ transform: `translateY(${now.height * 0.6}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 340, easing: 'ease-out' });
      }
    });
    if (moving) {
      // Трубы между баночками едут вместе с ними, а не исчезают и не перерисовываются рывком.
      const t0 = performance.now();
      const follow = (): void => {
        this.drawLinks();
        if (performance.now() - t0 < 380) window.requestAnimationFrame(follow);
      };
      follow();
    }
  }

  private paintJars(): void {
    this.slotRow.replaceChildren(
      ...this.state.slots.map((jar) => {
        const slot = el('div', { class: jar ? 'm-slot full' : 'm-slot' });
        if (jar) slot.append(this.jarNode(jar, false, false));
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
    this.drawLinks();
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
    const { state, carries } = stepMosaic(this.state, (cell) => this.hasWay(cell % this.state.w, Math.floor(cell / this.state.w)));
    if (carries.length === 0) return;
    this.state = state;
    carries.forEach((c) => this.carry(c));
    this.renderJars();
    this.checkEnd();
  }

  /** Питомец уносит кубик: выбегает из картинки к ближайшему краю, обегает её снаружи и скрывается в норке. */
  private carry(c: Carry, tries = 0): void {
    const cube = this.cubes[c.cell];
    if (!cube) return;
    const stage = this.stage.getBoundingClientRect();
    const from = cube.getBoundingClientRect();
    const to = this.hole.getBoundingClientRect();
    const size = from.width;
    const rs = Math.max(size * 0.9, 12);
    // Пока соседние кубики ещё видны на поле, свободного пути может не быть: питомец ждёт, а не бежит сквозь мозаику.
    {
      const cx = c.cell % this.state.w;
      const cy = Math.floor(c.cell / this.state.w);
      if (tries < 60 && !this.hasWay(cx, cy)) {
        this.waiting++;
        window.setTimeout(() => {
          this.waiting--;
          this.carry(c, tries + 1);
        }, 150);
        return;
      }
    }
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
    const slotEl = (this.slotRow.querySelector(`[data-jar="${c.jarId}"]`)?.parentElement ?? this.slotRow.children[c.slot]) as HTMLElement | undefined;
    const sr = (slotEl ?? this.hole).getBoundingClientRect();
    const sx = sr.left - stage.left + sr.width / 2;
    const sy = sr.top - stage.top + sr.height / 2;
    const cellX = c.cell % w;
    const cellY = Math.floor(c.cell / w);
    const clampCol = (x: number): number => Math.min(w, Math.max(-1, Math.round((x - ox) / pitchX)));
    const toGrid = (path: Array<[number, number]>): Array<[number, number]> =>
      path.map(([gx, gy]) => [ox + gx * pitchX, oy + gy * pitchY]);
    const rowY = oy + h * pitchY;
    // Туда: из баночки без груза к кубику. Обратно: с грузом от кубика сразу к норке, без боковых пробежек.
    const goPath = toGrid(this.freePath(cellX, cellY, clampCol(sx), h) ?? [[cellX, cellY], [cellX, h], [clampCol(sx), h]]);
    const backPath = toGrid(this.freePath(cellX, cellY, clampCol(hx), h) ?? [[cellX, cellY], [cellX, h], [clampCol(hx), h]]);
    const out: Array<[number, number]> = [[sx, sy], [sx, rowY], ...goPath.slice().reverse()];
    const home: Array<[number, number]> = [...backPath, [hx, rowY], [hx, hy]];
    const route = out.concat(home.slice(1));
    const turn = out.length - 1;
    let total = 0;
    const lens = route.slice(1).map((p, i) => {
      const q = route[i]!;
      const len = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
      total += len;
      return len;
    });
    const duration = Math.max(900 / this.speed, total / (RUN_PX_PER_MS * this.speed));
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
      this.solid[c.cell] = false;
      // Кубик взят: только теперь он пропадает и в расчёте, соседи открываются.
      this.state = pickCell(this.state, c.cell);
      this.lastRunMs = duration * (1 - turnOffset);
      this.renderLeft();
      this.checkEnd();
      cubeBadge.style.visibility = 'visible';
    }, duration * turnOffset);
    const anim = runner.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
    anim.onfinish = () => runner.remove();
    window.setTimeout(() => runner.remove(), duration + 200);
  }

  /** Кратчайший путь по пустым клеткам (с запасом в одну клетку вокруг доски и рядом внизу) с минимумом поворотов. */
  /** Есть ли у кубика свободный путь вниз (на строку под картинкой). */
  private hasWay(cx: number, cy: number): boolean {
    return this.freePath(cx, cy, cx, this.state.h) !== null;
  }

  private freePath(sx: number, sy: number, gx: number, gy: number): Array<[number, number]> | null {
    const { w, h } = this.state;
    const solid = this.solid;
    const X0 = -1;
    const Y0 = -1;
    const W = w + 2;
    const H = h + 3;
    const free = (x: number, y: number): boolean => {
      if (x < X0 || y < Y0 || x >= X0 + W || y >= Y0 + H) return false;
      if (x < 0 || y < 0 || x >= w || y >= h) return true;
      return !solid[y * w + x] || (x === sx && y === sy);
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
    if (end < 0) return null;
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
    const show = (): void => {
      if (this.waiting > 0) window.setTimeout(show, 150);
      else window.setTimeout(() => this.root.append(card), won ? this.lastRunMs : 0);
    };
    show();
    finish.focus();
  }
}
