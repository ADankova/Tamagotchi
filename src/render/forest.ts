import { randomSeed } from '../core/rng';
import {
  FR_FIRE_RADIUS,
  FR_FOOD,
  FR_H,
  FR_SLOTS,
  FR_W,
  frActions,
  frDo,
  frTargetAt,
  frThrow,
  frCenter,
  frDarkness,
  frEat,
  frIndex,
  frIsNight,
  frSleep,
  frSlotsUsed,
  frTick,
  newForest,
  restoreForest,
  type FrAction,
  type FrEvent,
  type FrItem,
  type FrStat,
  type FrState,
} from '../core/forest';
import type { SoundName } from '../audio/tunes';
import { GAMES_TEXT } from '../strings';
import { el } from './dom';
import type { GameScreen, MiniGameHost } from './minigames';
import { drawPet } from './petArt';
import { animFrame, type AnimRow } from './scene';

// Экран «Дикого леса»: карта на холсте, питомец ходит по нажатию, шкалы и рюкзак — обычные элементы.

/** Сколько клеток видно по ширине; по высоте — в 4/3 раза больше. */
const VIEW_W = 9;
const SAVE_KEY = 'tamagotchi.forest';
const BEST_KEY = 'tamagotchi.forest.best';
const SAVE_EVERY_MS = 2000;
const MESSAGE_MS = 3200;
/** Подписи показываются у предметов не дальше стольких клеток от питомца. */
const LABEL_RADIUS = 2.3;
const INK = '#3b2a1e';
const STATS: readonly FrStat[] = ['food', 'water', 'warmth', 'health'];
const STAT_COLORS: Readonly<Record<FrStat, string>> = { food: '#ffb05c', water: '#5aaef0', warmth: '#ff7a59', health: '#5fce85' };
const ITEM_ORDER: readonly FrItem[] = ['branch', 'flint', 'stone', 'grass', 'berries', 'mushroom', 'cooked'];
const ACT_ICONS: Readonly<Record<FrAction, string>> = {
  pick: '✋',
  chop: '🪓',
  drink: '💧',
  light: '🔥',
  feed: '🪵',
  cook: '🍳',
  sleep: '💤',
};

interface Callbacks {
  header: (title: string) => HTMLElement;
  replay: () => void;
  done: () => void;
}

export class ForestGame implements GameScreen {
  readonly root: HTMLElement;
  readonly leaveText = GAMES_TEXT.forestLeaveConfirm;
  private state: FrState;
  private readonly canvas = el('canvas', { class: 'fr-canvas' }) as HTMLCanvasElement;
  private readonly shade = document.createElement('canvas');
  private readonly bag = el('div', { class: 'm3-help fr-panel', hidden: '' });
  private readonly overPanel = el('div', { class: 'm3-help fr-panel fr-over', hidden: '' });
  private readonly note = el('p', { class: 'm3-note fr-note', text: GAMES_TEXT.forestHint });
  private readonly dayChip = el('span', { class: 'q-chip fr-day' });
  private readonly treatText = el('span', {});
  private readonly sleepButton = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestWake });
  private readonly menu = el('div', { class: 'fr-menu', hidden: '' });
  private menuAt: { x: number; y: number } | null = null;
  private readonly bars = new Map<FrStat, { fill: HTMLElement; value: number }>();
  private last = 0;
  private sinceSave = 0;
  private messageLeft = 0;
  private started = false;
  private stopped = false;
  private restartTimer = 0;
  private best = loadBest();

  constructor(
    private readonly host: MiniGameHost,
    cb: Callbacks,
  ) {
    this.state = loadSaved() ?? newForest(randomSeed());
    const bagButton = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestBag });
    bagButton.addEventListener('click', () => this.toggleBag());
    this.sleepButton.addEventListener('click', () => this.toggleSleep());
    this.sleepButton.hidden = !this.state.sleeping;
    this.root = el('div', { class: 'q-game fr-game' }, [
      cb.header(GAMES_TEXT.forestTitle),
      el('div', { class: 'q-top' }, [
        this.dayChip,
        el('span', { class: 'q-chip h-treat-chip' }, [el('img', { class: 'q-chip-pet', src: host.treatImage, alt: '' }), this.treatText]),
        this.restartButton(),
      ]),
      this.statBars(),
      el('div', { class: 'm3-wrap fr-wrap' }, [this.canvas, this.menu, this.bag, this.overPanel]),
      this.note,
      el('div', { class: 'fr-actions' }, [bagButton, this.sleepButton]),
    ]);
    this.canvas.addEventListener('click', (e) => this.tap(e));
    this.bag.addEventListener('click', (e) => {
      if (e.target === this.bag) this.toggleBag();
    });
    if (this.state.over) this.showOver();
    this.updateHud();
    window.requestAnimationFrame((t) => this.frame(t));
  }

  hasProgress(): boolean {
    // Поход сохраняется сам, выходить можно без вопросов.
    return false;
  }

  // --- Цикл ---

  private frame(now: number): void {
    if (this.root.isConnected) this.started = true;
    else if (this.started) {
      this.stop();
      return;
    }
    if (this.stopped) return;
    const dt = this.last ? Math.min(100, now - this.last) : 0;
    this.last = now;
    if (dt > 0 && !this.state.over) this.handle(frTick(this.state, dt));
    this.sinceSave += dt;
    if (this.sinceSave >= SAVE_EVERY_MS) {
      this.sinceSave = 0;
      storeSaved(this.state);
    }
    if (this.messageLeft > 0) {
      this.messageLeft -= dt;
      if (this.messageLeft <= 0) this.note.classList.remove('on');
    }
    this.resize();
    this.placeMenu();
    this.draw(now);
    this.updateHud();
    window.requestAnimationFrame((t) => this.frame(t));
  }

  private stop(): void {
    this.stopped = true;
    storeSaved(this.state);
  }

  private tap(e: MouseEvent): void {
    if (this.state.over) return;
    const rect = this.canvas.getBoundingClientRect();
    const view = this.view();
    const x = Math.floor(view.camX + ((e.clientX - rect.left) / rect.width) * VIEW_W);
    const y = Math.floor(view.camY + ((e.clientY - rect.top) / rect.height) * view.rows);
    const hadMenu = this.menuAt !== null;
    this.closeMenu();
    const target = frTargetAt(this.state, x, y);
    if (!target) return;
    const actions = frActions(this.state, target);
    if (!actions.length) {
      // Нажатие на пустую землю при открытом меню только закрывает его.
      if (!hadMenu) this.handle(frDo(this.state, x, y, null));
      return;
    }
    this.openMenu(x, y, actions);
  }

  /** Круглые кнопки над предметом: «Собрать», «Срубить», «Зажечь»… и крестик. */
  private openMenu(x: number, y: number, actions: FrAction[]): void {
    const buttons = actions.map((a) => {
      const b = el('button', { type: 'button', class: 'fr-act', 'aria-label': GAMES_TEXT.forestActs[a] ?? a }, [
        el('span', { class: 'fr-act-icon', text: ACT_ICONS[a] }),
        el('span', { class: 'fr-act-name', text: GAMES_TEXT.forestActs[a] ?? a }),
      ]);
      b.addEventListener('click', () => {
        this.closeMenu();
        this.handle(frDo(this.state, x, y, a));
      });
      return b;
    });
    const close = el('button', { type: 'button', class: 'fr-act fr-act-close', 'aria-label': GAMES_TEXT.forestClose }, [
      el('span', { class: 'fr-act-icon', text: '✕' }),
    ]);
    close.addEventListener('click', () => this.closeMenu());
    this.menu.replaceChildren(...buttons, close);
    this.menuAt = { x, y };
    this.menu.removeAttribute('hidden');
    this.placeMenu();
  }

  private closeMenu(): void {
    this.menuAt = null;
    this.menu.setAttribute('hidden', '');
  }

  private placeMenu(): void {
    if (!this.menuAt) return;
    const { camX, camY, rows } = this.view();
    this.menu.style.left = `${((this.menuAt.x + 0.5 - camX) / VIEW_W) * 100}%`;
    this.menu.style.top = `${((this.menuAt.y - camY) / rows) * 100}%`;
  }

  private handle(events: FrEvent[]): void {
    const M = GAMES_TEXT.forestMsg;
    const item = (i: FrItem): string => GAMES_TEXT.forestItems[i] ?? i;
    for (const ev of events) {
      switch (ev.type) {
        case 'picked':
          this.say(ev.item === 'berries' ? M.berries : M.picked(item(ev.item)), 'place');
          break;
        case 'full':
          this.say(M.full, 'blocked');
          break;
        case 'drank':
          this.say(M.drank, 'feed');
          break;
        case 'ate':
          this.say(M.ate(item(ev.item)), 'feed');
          break;
        case 'empty':
          this.say(M.empty, 'blocked');
          break;
        case 'fireLit':
          this.say(M.fireLit, 'win');
          break;
        case 'fireFed':
          this.say(M.fireFed, 'place');
          break;
        case 'needForFire':
          this.say(M.needForFire, 'blocked');
          break;
        case 'needBranch':
          this.say(M.needBranch, 'blocked');
          break;
        case 'fireOut':
          this.say(M.fireOut, 'miss');
          break;
        case 'needAxe':
          this.say(M.needAxe, 'blocked');
          break;
        case 'evening':
          this.say(M.evening, 'alert');
          break;
        case 'morning':
          this.host.earnTreats(ev.reward);
          this.best = Math.max(this.best, ev.day - 1);
          storeBest(this.best);
          this.say(M.morning(ev.day, ev.reward), 'snack');
          storeSaved(this.state);
          break;
        case 'cooked':
          this.say(M.cooked, 'win');
          break;
        case 'nothingToCook':
          this.say(M.nothingToCook, 'blocked');
          break;
        case 'sleepNo':
          this.say(M.sleepNo, 'blocked');
          break;
        case 'fellAsleep':
          this.say(M.fellAsleep, 'sleep');
          break;
        case 'thrown':
          this.say(M.thrown(item(ev.item)), 'place');
          break;
        case 'woke':
          this.say(M.woke, 'wake');
          break;
        case 'low':
          this.say(M.low[ev.stat] ?? '', 'sick');
          break;
        case 'over':
          this.host.playSound('lose');
          storeSaved(this.state);
          this.showOver();
          break;
      }
    }
  }

  private say(text: string, sound?: SoundName): void {
    this.note.textContent = text;
    this.note.classList.add('on');
    this.messageLeft = MESSAGE_MS;
    if (sound) this.host.playSound(sound);
  }

  // --- Кнопки и панели ---

  private toggleSleep(): void {
    const s = this.state;
    if (s.over) return;
    if (s.sleeping) {
      frSleep(s, false);
      this.host.playSound('wake');
    }
    this.updateHud();
  }

  private toggleBag(): void {
    if (this.bag.hasAttribute('hidden')) {
      this.renderBag();
      this.bag.removeAttribute('hidden');
    } else this.bag.setAttribute('hidden', '');
  }

  /** Рюкзак — сетка 4×3 ячеек; нажатие на ячейку открывает карточку предмета. */
  private renderBag(): void {
    const s = this.state;
    const stacks: Array<{ item: FrItem; n: number }> = [];
    for (const item of ITEM_ORDER) {
      let n = s.inv[item] ?? 0;
      while (n > 0) {
        stacks.push({ item, n: Math.min(10, n) });
        n -= 10;
      }
    }
    const cells: HTMLElement[] = [];
    for (let k = 0; k < FR_SLOTS; k++) {
      const st = stacks[k];
      if (!st) {
        cells.push(el('span', { class: 'fr-slot empty' }));
        continue;
      }
      const icon = el('canvas', { class: 'fr-slot-icon', width: '64', height: '64' }) as HTMLCanvasElement;
      const ictx = icon.getContext('2d');
      if (ictx) drawItem(ictx, st.item, 32, 34, 52, 0);
      const slot = el('button', { type: 'button', class: 'fr-slot', 'aria-label': GAMES_TEXT.forestItems[st.item] ?? st.item }, [
        icon,
        ...(st.n > 1 ? [el('span', { class: 'fr-slot-count', text: String(st.n) })] : []),
      ]);
      slot.addEventListener('click', () => this.renderItem(st.item));
      cells.push(slot);
    }
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.toggleBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestBagTitle(frSlotsUsed(s.inv), FR_SLOTS) }), close]),
        el('div', { class: 'fr-grid' }, cells),
      ]),
    );
  }

  /** Карточка предмета: картинка, что даёт, описание, «Съесть» и «Выбросить». */
  private renderItem(item: FrItem): void {
    const s = this.state;
    if (!(s.inv[item] ?? 0)) {
      this.renderBag();
      return;
    }
    const icon = el('canvas', { class: 'fr-card-icon', width: '96', height: '96' }) as HTMLCanvasElement;
    const ictx = icon.getContext('2d');
    if (ictx) drawItem(ictx, item, 48, 50, 78, 0);
    const food = FR_FOOD[item];
    const buttons: HTMLElement[] = [];
    if (food) {
      const eat = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestEat });
      eat.addEventListener('click', () => {
        this.handle(frEat(s, item));
        this.renderItem(item);
      });
      buttons.push(eat);
    }
    const toss = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestThrow });
    toss.addEventListener('click', () => {
      this.handle(frThrow(s, item));
      this.renderItem(item);
    });
    buttons.push(toss);
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.renderBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: `${GAMES_TEXT.forestItems[item] ?? item} ×${s.inv[item]}` }), close]),
        el('div', { class: 'fr-card-top' }, [
          icon,
          el('div', { class: 'fr-card-lines' }, food ? [el('span', { text: GAMES_TEXT.forestFoodLine(food) })] : []),
        ]),
        el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestDesc[item] ?? '' }),
        el('div', { class: 'fr-actions' }, buttons),
      ]),
    );
  }

  private showOver(): void {
    const s = this.state;
    const again = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestNew });
    again.addEventListener('click', () => this.restart());
    this.overPanel.replaceChildren(
      el('div', { class: 'fr-bag' }, [
        el('h3', { text: GAMES_TEXT.forestOverTitle }),
        el('p', { text: GAMES_TEXT.forestOverText(this.host.petName, s.day - 1, s.treats) }),
        again,
      ]),
    );
    this.overPanel.removeAttribute('hidden');
  }

  private restart(): void {
    this.state = newForest(randomSeed());
    storeSaved(this.state);
    this.overPanel.setAttribute('hidden', '');
    this.bag.setAttribute('hidden', '');
    this.closeMenu();
    this.say(GAMES_TEXT.forestHint);
  }

  private restartButton(): HTMLElement {
    const button = el('button', { type: 'button', class: 'm3-help-button m3-restart', 'aria-label': GAMES_TEXT.forestRestart, text: '↻' });
    button.addEventListener('click', () => {
      if (button.classList.contains('on')) {
        window.clearTimeout(this.restartTimer);
        button.classList.remove('on');
        this.restart();
        return;
      }
      button.classList.add('on');
      this.say(GAMES_TEXT.forestRestartSure);
      this.restartTimer = window.setTimeout(() => button.classList.remove('on'), 2500);
    });
    return button;
  }

  private statBars(): HTMLElement {
    return el(
      'div',
      { class: 'fr-stats' },
      STATS.map((k) => {
        const fill = el('span', { class: 'fr-bar-fill' });
        fill.style.background = STAT_COLORS[k];
        this.bars.set(k, { fill, value: -1 });
        return el('div', { class: 'fr-stat' }, [
          el('span', { class: 'fr-stat-name', text: GAMES_TEXT.forestStatNames[k] ?? k }),
          el('span', { class: 'fr-bar' }, [fill]),
        ]);
      }),
    );
  }

  private updateHud(): void {
    const s = this.state;
    const day = `${GAMES_TEXT.forestDay(s.day)} ${frIsNight(s) ? '☾' : '☀'}`;
    if (this.dayChip.textContent !== day) this.dayChip.textContent = day;
    const treats = GAMES_TEXT.forestTreats(s.treats);
    if (this.treatText.textContent !== treats) this.treatText.textContent = treats;
    for (const [k, bar] of this.bars) {
      const v = Math.round(s.stats[k]);
      if (v !== bar.value) {
        bar.value = v;
        bar.fill.style.width = `${v}%`;
        bar.fill.parentElement?.classList.toggle('low', v < 25);
      }
    }
    // «Проснуться» видна только во сне; лечь спать можно кнопкой у горящего костра.
    if (this.sleepButton.hidden === s.sleeping) this.sleepButton.hidden = !s.sleeping;
  }

  // --- Рисование ---

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round((w * 4) / 3);
    if (w > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.shade.width = w;
      this.shade.height = h;
    }
  }

  private view(): { tile: number; rows: number; camX: number; camY: number } {
    const s = this.state;
    const tile = this.canvas.width / VIEW_W || 1;
    const rows = (VIEW_W * 4) / 3;
    const camX = clamp(s.x - VIEW_W / 2, 0, FR_W - VIEW_W);
    const camY = clamp(s.y - rows / 2, 0, FR_H - rows);
    return { tile, rows, camX, camY };
  }

  private draw(t: number): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || !this.canvas.width) return;
    const s = this.state;
    const { tile, rows, camX, camY } = this.view();
    const sx = (x: number): number => (x - camX) * tile;
    const sy = (y: number): number => (y - camY) * tile;
    ctx.imageSmoothingEnabled = false;
    const x0 = Math.max(0, Math.floor(camX));
    const x1 = Math.min(FR_W - 1, Math.ceil(camX + VIEW_W));
    const y0 = Math.max(0, Math.floor(camY));
    const y1 = Math.min(FR_H - 1, Math.ceil(camY + rows) + 1);

    // Земля и вода.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tileKind = s.tiles[frIndex(x, y)];
        const px = Math.floor(sx(x));
        const py = Math.floor(sy(y));
        const size = Math.ceil(tile) + 1;
        if (tileKind === 'water') {
          ctx.fillStyle = '#5aaef0';
          ctx.fillRect(px, py, size, size);
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = Math.max(1, tile * 0.06);
          const wave = Math.sin(t / 600 + x * 1.3 + y * 0.7) * tile * 0.1;
          ctx.beginPath();
          ctx.moveTo(px + tile * 0.2 + wave, py + tile * 0.4);
          ctx.lineTo(px + tile * 0.5 + wave, py + tile * 0.4);
          ctx.stroke();
        } else {
          ctx.fillStyle = (x + y) % 2 ? '#7cc56b' : '#76bd65';
          ctx.fillRect(px, py, size, size);
        }
      }
    }

    // Предметы, кусты, деревья и питомец — сверху вниз, чтобы нижние перекрывали верхние.
    const items: Array<{ y: number; draw: () => void }> = [];
    const drops = new Map(s.drops.map((d) => [frIndex(d.x, d.y), d]));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = frIndex(x, y);
        const cx = sx(x + 0.5);
        const cy = sy(y + 0.5);
        const kind = s.tiles[i];
        if (kind === 'tree') items.push({ y: y + 0.9, draw: () => drawTree(ctx, cx, sy(y + 1), tile) });
        else if (kind === 'bush') items.push({ y: y + 0.8, draw: () => drawBush(ctx, cx, cy, tile, s.berries.includes(i)) });
        else if (kind === 'pit') items.push({ y: y + 0.7, draw: () => drawPit(ctx, cx, cy, tile, s.fire > 0, t) });
        const d = drops.get(i);
        if (d) items.push({ y: y + 0.4, draw: () => drawItem(ctx, d.kind, cx, cy, tile * 0.7, t) });
      }
    }
    items.push({ y: s.y + 0.2, draw: () => this.drawPetAt(ctx, sx(s.x), sy(s.y) + tile * 0.35, tile, t) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    this.drawDarkness(ctx, sx, sy, tile, t);
    this.drawLabels(ctx, sx, sy, tile, drops);
  }

  private drawPetAt(ctx: CanvasRenderingContext2D, cx: number, feet: number, tile: number, t: number): void {
    const s = this.state;
    let anim: AnimRow = 'idle_smooth';
    if (s.over) anim = 'tired';
    else if (s.sleeping) anim = 'sleep_twitch';
    else if (s.busy) anim = 'eat_side';
    else if (s.path.length) anim = 'walk';
    else if (s.stats.food < 25 || s.stats.water < 25 || s.stats.warmth < 25) anim = 'hungry';
    const scale = (tile * 1.45) / 64;
    // Тень под питомцем.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, feet - tile * 0.05, tile * 0.38, tile * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPet(ctx, this.host.petSpecies, this.host.petBody, anim, animFrame(anim, t, 1), cx, feet, scale, s.facing < 0);
    if (s.sleeping) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, tile * 0.05);
      ctx.font = `900 ${Math.round(tile * 0.32)}px Nunito, sans-serif`;
      const bob = Math.sin(t / 400) * tile * 0.08;
      ctx.strokeText('z', cx + tile * 0.4, feet - tile * 1.3 + bob);
      ctx.fillText('z', cx + tile * 0.4, feet - tile * 1.3 + bob);
    }
  }

  private drawDarkness(
    ctx: CanvasRenderingContext2D,
    sx: (x: number) => number,
    sy: (y: number) => number,
    tile: number,
    t: number,
  ): void {
    const s = this.state;
    const dark = frDarkness(s);
    const c = frCenter();
    const fx = sx(c.x + 0.5);
    const fy = sy(c.y + 0.5);
    if (s.fire > 0) {
      // Тёплый отсвет огня.
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, FR_FIRE_RADIUS * tile);
      glow.addColorStop(0, `rgba(255,170,70,${0.25 * Math.max(0.3, dark)})`);
      glow.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (dark <= 0) return;
    const sh = this.shade.getContext('2d');
    if (!sh) return;
    sh.globalCompositeOperation = 'source-over';
    sh.clearRect(0, 0, this.shade.width, this.shade.height);
    sh.fillStyle = `rgba(10,12,34,${0.9 * dark})`;
    sh.fillRect(0, 0, this.shade.width, this.shade.height);
    sh.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, power: number): void => {
      const g = sh.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${power})`);
      g.addColorStop(0.55, `rgba(0,0,0,${power})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sh.fillStyle = g;
      sh.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (s.fire > 0) hole(fx, fy, FR_FIRE_RADIUS * tile * (1 + Math.sin(t / 130) * 0.03), 1);
    // Немного видно вокруг самого питомца.
    hole(sx(s.x), sy(s.y), tile * 1.4, 0.55);
    sh.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.shade, 0, 0);
    // Глаза в темноте — для настроения.
    if (dark > 0.8) {
      ctx.fillStyle = 'rgba(255,240,150,0.8)';
      for (const [ex, ey] of [
        [3, 4],
        [FR_W - 5, 7],
        [6, FR_H - 6],
      ] as const) {
        if (Math.sin(t / 900 + ex) < 0.6) continue;
        const px = sx(ex);
        const py = sy(ey);
        ctx.fillRect(px, py, tile * 0.08, tile * 0.08);
        ctx.fillRect(px + tile * 0.2, py, tile * 0.08, tile * 0.08);
      }
    }
  }

  private drawLabels(
    ctx: CanvasRenderingContext2D,
    sx: (x: number) => number,
    sy: (y: number) => number,
    tile: number,
    drops: Map<number, FrState['drops'][number]>,
  ): void {
    const s = this.state;
    if (s.sleeping || s.over) return;
    const labels: Array<{ x: number; y: number; text: string }> = [];
    const near = (x: number, y: number): boolean => Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) <= LABEL_RADIUS;
    let water: { x: number; y: number; d: number } | null = null;
    for (let y = Math.floor(s.y - 3); y <= s.y + 3; y++) {
      for (let x = Math.floor(s.x - 3); x <= s.x + 3; x++) {
        if (x < 0 || y < 0 || x >= FR_W || y >= FR_H || !near(x, y)) continue;
        const i = frIndex(x, y);
        const kind = s.tiles[i];
        const d = drops.get(i);
        if (d) labels.push({ x, y, text: GAMES_TEXT.forestItems[d.kind] ?? d.kind });
        else if (kind === 'bush' && s.berries.includes(i)) labels.push({ x, y, text: GAMES_TEXT.forestPlaces.bush ?? '' });
        else if (kind === 'pit') labels.push({ x, y, text: GAMES_TEXT.forestPlaces[s.fire > 0 ? 'fire' : 'pit'] ?? '' });
        else if (kind === 'water') {
          const dist = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
          if (!water || dist < water.d) water = { x, y, d: dist };
        }
      }
    }
    if (water) labels.push({ x: water.x, y: water.y, text: GAMES_TEXT.forestPlaces.water ?? '' });
    ctx.font = `800 ${Math.round(tile * 0.27)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, tile * 0.08);
    ctx.strokeStyle = 'rgba(40,28,20,0.85)';
    ctx.fillStyle = '#fff';
    for (const l of labels) {
      const x = sx(l.x + 0.5);
      const y = sy(l.y) - tile * 0.05;
      ctx.strokeText(l.text, x, y);
      ctx.fillText(l.text, x, y);
    }
    ctx.textAlign = 'start';
  }
}

// --- Рисунки предметов (простые фигуры, пока нет картинок) ---

function outline(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawTree(ctx: CanvasRenderingContext2D, cx: number, bottom: number, tile: number): void {
  outline(ctx, tile);
  ctx.fillStyle = '#8a5a35';
  ctx.fillRect(cx - tile * 0.09, bottom - tile * 0.45, tile * 0.18, tile * 0.4);
  ctx.strokeRect(cx - tile * 0.09, bottom - tile * 0.45, tile * 0.18, tile * 0.4);
  const layers = [
    [0.42, 0.95, 0.4],
    [0.36, 1.25, 0.35],
    [0.28, 1.5, 0.3],
  ] as const;
  for (const [half, top, height] of layers) {
    ctx.fillStyle = '#2f8a57';
    ctx.beginPath();
    ctx.moveTo(cx, bottom - tile * (top + height * 0.6));
    ctx.lineTo(cx + tile * half, bottom - tile * (top - height));
    ctx.lineTo(cx - tile * half, bottom - tile * (top - height));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawBush(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, berries: boolean): void {
  outline(ctx, tile);
  ctx.fillStyle = '#4caf50';
  ctx.beginPath();
  ctx.arc(cx - tile * 0.15, cy + tile * 0.05, tile * 0.26, 0, Math.PI * 2);
  ctx.arc(cx + tile * 0.17, cy + tile * 0.08, tile * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - tile * 0.12, tile * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!berries) return;
  ctx.fillStyle = '#e8505b';
  for (const [dx, dy] of [
    [-0.18, -0.05],
    [0.1, -0.2],
    [0.2, 0.08],
    [-0.05, 0.12],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * tile, cy + dy * tile, tile * 0.065, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPit(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, lit: boolean, t: number): void {
  outline(ctx, tile);
  ctx.fillStyle = '#6b5d52';
  ctx.beginPath();
  ctx.ellipse(cx, cy + tile * 0.1, tile * 0.32, tile * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a7a39c';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * tile * 0.36, cy + tile * 0.1 + Math.sin(a) * tile * 0.22, tile * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (!lit) return;
  ctx.strokeStyle = '#6b3f22';
  ctx.lineWidth = tile * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx - tile * 0.2, cy + tile * 0.18);
  ctx.lineTo(cx + tile * 0.2, cy + tile * 0.02);
  ctx.moveTo(cx + tile * 0.2, cy + tile * 0.18);
  ctx.lineTo(cx - tile * 0.2, cy + tile * 0.02);
  ctx.stroke();
  const flames: ReadonlyArray<readonly [number, number, string]> = [
    [0.22, 0.62, '#ff7a2f'],
    [0.15, 0.48, '#ffc23d'],
    [0.07, 0.3, '#fff4b0'],
  ];
  for (const [w, h, color] of flames) {
    const flick = 1 + Math.sin(t / 90 + h * 10) * 0.08;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - w * tile, cy + tile * 0.1);
    ctx.quadraticCurveTo(cx - w * tile, cy - h * tile * 0.5 * flick, cx, cy - h * tile * flick);
    ctx.quadraticCurveTo(cx + w * tile, cy - h * tile * 0.5 * flick, cx + w * tile, cy + tile * 0.1);
    ctx.closePath();
    ctx.fill();
  }
}

/** Предмет на земле или в рюкзаке: центр (cx, cy), size — примерная ширина. */
function drawItem(ctx: CanvasRenderingContext2D, kind: FrItem, cx: number, cy: number, size: number, t: number): void {
  outline(ctx, size);
  const bob = Math.sin(t / 500 + cx) * size * 0.03;
  cy += bob;
  switch (kind) {
    case 'branch':
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.4, cy + size * 0.2);
      ctx.lineTo(cx + size * 0.4, cy - size * 0.15);
      ctx.stroke();
      ctx.strokeStyle = '#a0683b';
      ctx.lineWidth = size * 0.11;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + size * 0.05, cy + size * 0.02);
      ctx.lineTo(cx + size * 0.12, cy - size * 0.22);
      ctx.stroke();
      break;
    case 'stone':
      ctx.fillStyle = '#9aa0a6';
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.36, size * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'flint':
      ctx.fillStyle = '#efe3cf';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.35, cy + size * 0.12);
      ctx.lineTo(cx - size * 0.1, cy - size * 0.25);
      ctx.lineTo(cx + size * 0.32, cy - size * 0.1);
      ctx.lineTo(cx + size * 0.2, cy + size * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - size * 0.05, cy - size * 0.12, size * 0.12, size * 0.06);
      break;
    case 'grass':
      ctx.strokeStyle = '#2f7a3a';
      ctx.lineWidth = size * 0.1;
      ctx.beginPath();
      for (const dx of [-0.2, 0, 0.2]) {
        ctx.moveTo(cx + dx * size, cy + size * 0.3);
        ctx.quadraticCurveTo(cx + dx * size * 1.6, cy - size * 0.05, cx + dx * size * 2, cy - size * 0.35);
      }
      ctx.stroke();
      break;
    case 'mushroom':
      ctx.fillStyle = '#fff6e4';
      ctx.fillRect(cx - size * 0.08, cy - size * 0.05, size * 0.16, size * 0.3);
      ctx.strokeRect(cx - size * 0.08, cy - size * 0.05, size * 0.16, size * 0.3);
      ctx.fillStyle = '#e8505b';
      ctx.beginPath();
      ctx.arc(cx, cy - size * 0.02, size * 0.3, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - size * 0.15, cy - size * 0.17, size * 0.07, size * 0.07);
      ctx.fillRect(cx + size * 0.06, cy - size * 0.22, size * 0.07, size * 0.07);
      break;
    case 'cooked':
      ctx.fillStyle = '#f0d9b0';
      ctx.fillRect(cx - size * 0.08, cy - size * 0.05, size * 0.16, size * 0.3);
      ctx.strokeRect(cx - size * 0.08, cy - size * 0.05, size * 0.16, size * 0.3);
      ctx.fillStyle = '#9a5a2c';
      ctx.beginPath();
      ctx.arc(cx, cy - size * 0.02, size * 0.3, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = size * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.1, cy - size * 0.38);
      ctx.quadraticCurveTo(cx - size * 0.18, cy - size * 0.48, cx - size * 0.08, cy - size * 0.56);
      ctx.moveTo(cx + size * 0.1, cy - size * 0.38);
      ctx.quadraticCurveTo(cx + size * 0.02, cy - size * 0.48, cx + size * 0.12, cy - size * 0.56);
      ctx.stroke();
      break;
    case 'berries':
      ctx.fillStyle = '#e8505b';
      for (const [dx, dy] of [
        [-0.15, 0.05],
        [0.12, 0.08],
        [0, -0.15],
      ] as const) {
        ctx.beginPath();
        ctx.arc(cx + dx * size, cy + dy * size, size * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function storeSaved(state: FrState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // хранилище закрыто — поход просто не сохранится
  }
}

function loadSaved(): FrState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? restoreForest(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function storeBest(n: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // ignore
  }
}

function loadBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Рекорд «Дикого леса» — больше всего прожитых ночей (для списка игр). */
export function forestBest(): number {
  return loadBest();
}
