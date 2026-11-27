import { randomSeed } from '../core/rng';
import {
  FR_DAY_MS,
  FR_EVENING_AT,
  frFireRadius,
  frRainHere,
  frTravel,
  frSmelt,
  frDry,
  frCanDry,
  FR_DRY,
  frCanSmelt,
  FR_SMELT_ORE,
  frHasPit,
  type FrPlace,
  FR_NIGHT_AT,
  FR_EFFECTS,
  FR_H,
  FR_W,
  frActions,
  frDo,
  frTargetAt,
  frThrow,
  frCenter,
  frDarkness,
  frCookable,
  frCanCraft,
  frCraft,
  frChestPut,
  frPlaceSpots,
  frAttack,
  frExitAt,
  frMobAt,
  FR_MOBS,
  type FrMob,
  frPartCost,
  frRainSoon,
  FR_TORCH_MS,
  frBedCell,
  frLoomDone,
  FR_SHELTER_RAINS,
  frDurability,
  type FrTool,
  frWeave,
  frCanWeave,
  frWear,
  frUnwear,
  frEquip,
  frDestroy,
  frWeaponDmg,
  frWeaponStats,
  frHeld,
  frBagSize,
  frBagUsed,
  FR_WEAPONS,
  FR_BUILDINGS,
  FR_LOOM,
  type FrLoomId,
  frBuilt,
  frRecipeShown,
  FR_GEAR_SLOTS,
  type FrCraftId,
  frChestTake,
  frClaim,
  frCounter,
  frQuestState,
  FR_CRAFT,
  FR_QUESTS,
  type FrQuest,
  frEat,
  frTorch,
  frLantern,
  frIsNight,
  frLightBeacon,
  frCanLightBeacon,
  frStoryActive,
  frUpgrade,
  frCanUpgrade,
  frToolMax,
  frPotAdd,
  frRecipeAvailable,
  frRecipeFill,
  FR_RECIPES,
  frPotCook,
  frPotRemove,
  frPotReturn,
  frRecipe,
  FR_POT_SLOTS,
  FR_STACK,
  frIndex,
  frSleep,
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
import { cellHash, drawIcon, drawSprite, groundTile, natureCount } from './nature';
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
function torchIcon(): HTMLCanvasElement {
  const c = el('canvas', { width: '24', height: '24' }) as HTMLCanvasElement;
  const g = c.getContext('2d');
  if (g && !drawIcon(g, 'item-torch', 12, 12, 22)) {
    g.font = '18px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🔥', 12, 12);
  }
  return c;
}
/** Вкладки крафта: огонь, инструменты, изготовление, хранилище и жильё, оружие. */
const CRAFT_TABS: ReadonlyArray<{ id: string; icon: string; emoji: string; items: readonly string[] }> = [
  { id: 'fire', icon: 'act-flame', emoji: '🔥', items: ['torch', 'lantern', 'campfire'] },
  { id: 'tools', icon: 'item-pickaxe', emoji: '⛏️', items: ['knife', 'axe', 'pickaxe', 'rod', 'ironknife', 'ironaxe', 'ironpick', 'trap', 'flask', 'purse'] },
  { id: 'make', icon: 'loom', emoji: '🧶', items: ['foundry', 'dryer', 'loom'] },
  { id: 'home', icon: 'chest', emoji: '📦', items: ['chest', 'shelter', 'bed', 'lighthouse'] },
  { id: 'weapon', icon: 'item-spear', emoji: '🗡️', items: ['spear'] },
];
const isLoomId = (id: string): id is FrLoomId => FR_LOOM.some((r) => r.id === id);
const BUILD_ICON: Record<string, string> = { chest: '📦', loom: '🧶', trap: '🪤', foundry: '🧱', dryer: '🥩', lighthouse: '🗼', campfire: '🔥' };
const TOOLS: FrItem[] = ['knife', 'axe', 'pickaxe', 'rod', 'ironaxe', 'ironpick', 'ironknife', 'spear'];
const ITEM_ORDER: readonly FrItem[] = ['branch', 'flint', 'stone', 'grass', 'berries', 'mushroom', 'cooked', 'axe', 'knife', 'pickaxe', 'flask', 'torch', 'fullflask', 'egg', 'seeds', 'friedegg', 'tea', 'compote', 'porridge', 'berryporridge', 'cloth', 'purse', 'meat', 'steak', 'broth', 'meatporridge', 'reed', 'fish', 'friedfish', 'fishsoup', 'rod', 'ore', 'ingot', 'ironknife', 'ironaxe', 'ironpick', 'fishporridge', 'salt', 'jerky', 'driedfish', 'glowcap', 'glowsoup', 'crystal', 'lantern', 'fang', 'spear'];
const ACT_SPRITE: Readonly<Partial<Record<FrAction, string>>> = { pick: 'act-hand', chop: 'item-axe', drink: 'act-drop', light: 'act-flame', feed: 'branch', cook: 'item-friedegg', open: 'chest', fill: 'item-flask', mine: 'item-pickaxe', cut: 'item-knife', fish: 'item-rod', travel: 'act-door', sleep: 'item-bed' };
function actIcon(a: FrAction): HTMLCanvasElement {
  const c = el('canvas', { width: '56', height: '56' }) as HTMLCanvasElement;
  c.style.cssText = 'width:28px;height:28px;display:block;margin:auto';
  const g = c.getContext('2d');
  const kind = ACT_SPRITE[a];
  if (g && !(kind && drawIcon(g, kind, 28, 28, 52))) {
    g.font = '40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ACT_ICONS[a], 28, 28);
  }
  return c;
}
const ACT_ICONS: Readonly<Record<FrAction, string>> = {
  pick: '✋',
  chop: '🪓',
  drink: '💧',
  light: '🔥',
  feed: '🪵',
  cook: '🍳',
  open: '📦',
  fill: '🫗',
  mine: '⛏️',
  cut: '✂️',
  sleep: '💤',
  fish: '🎣',
  travel: '🚪',
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
  private readonly questLine = el('button', { type: 'button', class: 'fr-quest' });
  private questKey = '';
  private readonly torchFill = el('i', {});
  private readonly torchBox = el('div', { class: 'fr-torch', hidden: '' }, [el('span', { class: 'fr-torch-ico' }, [torchIcon()]), el('span', { class: 'fr-torch-bar' }, [this.torchFill])]);
  private readonly rainIcon = el('div', { class: 'fr-rain', hidden: '', text: '🌧️' });
  private readonly note = el('p', { class: 'm3-note fr-note', text: GAMES_TEXT.forestHint });
  private readonly dayChip = el('span', { class: 'q-chip fr-day' });
  private readonly clockHand: SVGElement;
  private readonly clock: SVGSVGElement;
  private readonly treatText = el('span', {});
  private hutAlpha = 1;
  /** Последний удар питомца: когда и куда (в клетках от питомца) — для замаха оружием. */
  private swing: { at: number; dx: number; dy: number } | null = null;
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
    // Конфеты уже выданы питомцу в момент получения; при новом входе счётчик начинается с нуля, как в других играх.
    this.state.treats = 0;
    this.clock = clockFace();
    this.clockHand = this.clock.querySelector('.fr-hand') as SVGElement;
    const bagButton = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestBag });
    bagButton.addEventListener('click', () => this.toggleBag());
    const craftButton = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestCraft });
    craftButton.addEventListener('click', () => {
      this.closeMenu();
      this.renderCraft();
      this.bag.removeAttribute('hidden');
    });
    this.sleepButton.addEventListener('click', () => this.toggleSleep());
    this.sleepButton.hidden = !this.state.sleeping;
    this.root = el('div', { class: 'q-game fr-game' }, [
      cb.header(GAMES_TEXT.forestTitle),
      el('div', { class: 'q-top' }, [
        this.clock as unknown as HTMLElement,
        this.dayChip,
        el('span', { class: 'q-chip h-treat-chip' }, [el('img', { class: 'q-chip-pet', src: host.treatImage, alt: '' }), this.treatText]),
        this.restartButton(),
      ]),
      this.statBars(),
      this.questLine,
      el('div', { class: 'm3-wrap fr-wrap' }, [this.canvas, el('div', { class: 'fr-status' }, [this.torchBox, this.rainIcon]), this.menu, this.bag, this.overPanel]),
      this.note,
      el('div', { class: 'fr-actions' }, [bagButton, craftButton, this.sleepButton]),
    ]);
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('click', (e) => {
      if (this.dragMoved) {
        this.dragMoved = false;
        return;
      }
      this.tap(e);
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      this.drag = { px: e.clientX, py: e.clientY, ox: this.pan.x, oy: this.pan.y };
      this.dragMoved = false;
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      const dx = e.clientX - d.px;
      const dy = e.clientY - d.py;
      if (!this.dragMoved && Math.hypot(dx, dy) < 10) return;
      this.dragMoved = true;
      this.following = false;
      const tile = this.canvas.getBoundingClientRect().width / VIEW_W || 1;
      this.pan = { x: d.ox - dx / tile, y: d.oy - dy / tile };
      this.closeMenu();
    });
    const endDrag = (): void => {
      this.drag = null;
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
    this.canvas.addEventListener('pointerleave', endDrag);
    this.bag.addEventListener('click', (e) => {
      if (e.target === this.bag) this.closeBag();
    });
    if (this.state.over) this.showOver();
    this.questLine.addEventListener('click', () => this.openQuests());
    this.introTip();
    this.shelterTip();
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
    if (this.following && !this.drag) {
      const k = Math.exp(-dt / 160);
      this.pan = { x: this.pan.x * k, y: this.pan.y * k };
      if (Math.hypot(this.pan.x, this.pan.y) < 0.02) {
        this.pan = { x: 0, y: 0 };
        this.following = false;
      }
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
    const fx = view.camX + ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const fy = view.camY + ((e.clientY - rect.top) / rect.height) * view.rows;
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    if (this.placing) {
      this.tapPlacing(x, y);
      return;
    }
    const mob = frMobAt(this.state, fx, fy);
    if (mob) {
      this.closeMenu();
      this.handle(frAttack(this.state, mob.id));
      return;
    }
    const hadMenu = this.menuAt !== null;
    this.closeMenu();
    const target = frTargetAt(this.state, x, y);
    if (!target) return;
    const actions = frActions(this.state, target);
    if (!actions.length) {
      // Нажатие на пустую землю при открытом меню только закрывает его.
      if (!hadMenu) this.handle(frDo(this.state, x, y, null, [fx, fy]));
      return;
    }
    this.openMenu(x, y, actions);
  }

  /** Круглые кнопки над предметом: «Собрать», «Срубить», «Зажечь»… и крестик. */
  private openMenu(x: number, y: number, actions: FrAction[]): void {
    const buttons = actions.map((a) => {
      const b = el('button', { type: 'button', class: 'fr-act', 'aria-label': GAMES_TEXT.forestActs[a] ?? a }, [
        el('span', { class: 'fr-act-icon' }, [actIcon(a)]),
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

  /** Выбор места для сундука: зелёные клетки у костра, нажатие ставит «призрак» с ✔ и ✕. */
  private placing: { id: FrCraftId; cell: number | null } | null = null;

  private startPlacing(id: FrCraftId): void {
    this.bag.setAttribute('hidden', '');
    this.closeMenu();
    this.placing = { id, cell: null };
    this.say(GAMES_TEXT.forestPlaceHint);
    this.messageLeft = 60_000;
  }

  private stopPlacing(): void {
    this.placing = null;
    this.closeMenu();
    this.messageLeft = 1;
  }

  private tapPlacing(x: number, y: number): void {
    const i = frIndex(x, y);
    this.closeMenu();
    if (!frPlaceSpots(this.state, this.placing?.id ?? 'chest').includes(i)) {
      this.stopPlacing();
      return;
    }
    this.placing = { id: this.placing?.id ?? 'chest', cell: i };
    const ok = el('button', { type: 'button', class: 'fr-act', 'aria-label': GAMES_TEXT.forestPlaceOk }, [
      el('span', { class: 'fr-act-icon', text: '✔' }),
      el('span', { class: 'fr-act-name', text: GAMES_TEXT.forestPlaceOk }),
    ]);
    ok.addEventListener('click', () => {
      const cell = this.placing?.cell;
      const id = this.placing?.id ?? 'chest';
      this.stopPlacing();
      if (cell !== null && cell !== undefined) {
        const before = new Set(this.craftRecipes().map((r) => r.id));
        this.handle(frCraft(this.state, id, cell));
        if (id === 'loom' || id === 'foundry') this.showNewRecipes(before);
      }
    });
    const no = el('button', { type: 'button', class: 'fr-act fr-act-close', 'aria-label': GAMES_TEXT.forestClose }, [
      el('span', { class: 'fr-act-icon', text: '✕' }),
    ]);
    no.addEventListener('click', () => this.stopPlacing());
    this.menu.replaceChildren(ok, no);
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
    const box = this.menu.parentElement;
    const W = box?.clientWidth || 1;
    const H = box?.clientHeight || 1;
    const topPx = ((this.menuAt.y - camY) / rows) * H;
    const mh = this.menu.offsetHeight || 80;
    const mw = this.menu.offsetWidth || 120;
    // У верхнего края карты меню показывается под клеткой, у боковых краёв сдвигается внутрь.
    const below = topPx < mh + 4;
    const cx = ((this.menuAt.x + 0.5 - camX) / VIEW_W) * W;
    const left = Math.min(Math.max(cx, mw / 2 + 4), Math.max(mw / 2 + 4, W - mw / 2 - 4));
    this.menu.style.left = `${(left / W) * 100}%`;
    this.menu.style.top = below ? `${((this.menuAt.y + 1 - camY) / rows) * 100}%` : `${(topPx / H) * 100}%`;
    this.menu.style.transform = below ? 'translate(-50%, 0)' : '';
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
          if (ev.reward > 0) this.host.earnTreats(ev.reward);
          this.best = Math.max(this.best, ev.day - 1);
          storeBest(this.best);
          this.say(M.morning(ev.day, ev.reward), 'snack');
          storeSaved(this.state);
          break;
        case 'cooked':
          this.say(M.cooked, 'win');
          break;
        case 'openChest':
          this.openChest();
          break;
        case 'needKnife':
          this.say(M.needKnife, 'blocked');
          break;
        case 'needPickaxe':
          this.say(M.needPickaxe, 'blocked');
          break;
        case 'mined':
          this.say(M.mined, 'place');
          break;
        case 'cut':
          this.say(M.cut, 'place');
          break;
        case 'needFlask':
          this.say(M.needFlask, 'blocked');
          break;
        case 'filled':
          this.say(M.filled, 'place');
          break;
        case 'found':
          this.say(M.found(item(ev.item)), 'snack');
          break;
        case 'torchLit':
          this.say(M.torchLit, 'win');
          break;
        case 'upgraded':
          this.say(M.upgraded, 'win');
          break;
        case 'torchOut':
          this.say(M.torchOut, 'miss');
          break;
        case 'openFoundry':
          this.renderFoundry();
          this.bag.removeAttribute('hidden');
          break;
        case 'openDryer':
          this.renderDryer();
          this.bag.removeAttribute('hidden');
          break;
        case 'openLighthouse':
          this.renderLighthouse();
          this.bag.removeAttribute('hidden');
          break;
        case 'beaconLit':
          this.say(M.beaconLit, 'win');
          break;
        case 'storyDone':
          this.renderStoryNext();
          this.bag.removeAttribute('hidden');
          break;
        case 'dried':
          this.say(M.dried, 'win');
          break;
        case 'smelted':
          this.say(M.smelted, 'win');
          break;
        case 'campGone':
          this.say(M.campGone, 'blocked');
          break;
        case 'openLoom':
          this.renderLoom();
          this.bag.removeAttribute('hidden');
          break;
        case 'spilled':
          this.say(M.spilled, 'blocked');
          break;
        case 'cookDropped':
          this.say(M.cookDropped, 'win');
          break;
        case 'broke':
          this.say(M.broke.replace('{item}', (GAMES_TEXT.forestItems[ev.item] ?? ev.item).toLowerCase()), 'blocked');
          this.renderBag();
          break;
        case 'rainStart':
          this.say(this.state.shelter > 0 ? M.rainShelter : M.rainStart, 'blocked');
          break;
        case 'rainEnd':
          this.say(M.rainEnd, 'win');
          break;
        case 'fireDoused':
          this.say(M.fireDoused, 'blocked');
          break;
        case 'shelterBroke':
          this.say(M.shelterBroke, 'blocked');
          break;
        case 'tooWet':
          this.say(M.tooWet, 'blocked');
          break;
        case 'petHit': {
          const st = this.state;
          const near = st.mobs.filter((x) => Math.hypot(x.x - st.x, x.y - st.y) < 2.5).sort((a, b) => Math.hypot(a.x - st.x, a.y - st.y) - Math.hypot(b.x - st.x, b.y - st.y))[0];
          this.swing = { at: performance.now(), dx: near ? near.x - st.x : st.facing, dy: near ? near.y - st.y : 0 };
          break;
        }
        case 'traveled':
          this.closeMenu();
          this.closeBag();
          this.say(GAMES_TEXT.forestTraveled[ev.to] ?? '', 'win');
          this.messageLeft = 7000;
          break;
        case 'travelAsk':
          this.renderTravel(ev.to);
          this.bag.removeAttribute('hidden');
          break;
        case 'needRod':
          this.say(M.needRod, 'blocked');
          break;
        case 'fished':
          this.say(M.fished, 'win');
          break;
        case 'noBite':
          this.say(M.noBite, 'blocked');
          break;
        case 'treasure':
          if (ev.treat) this.host.earnTreats(1);
          this.say(ev.treat ? M.treasureTreat : M.treasure.replace('{item}', `${GAMES_TEXT.forestItems[ev.item ?? 'stone'] ?? ''} ×${ev.n ?? 0}`), 'snack');
          break;
        case 'tooDark':
          this.say(M.tooDark, 'blocked');
          break;
        case 'hurt':
          this.say(M.hurt.replace('{mob}', GAMES_TEXT.forestMobs[ev.kind] ?? ev.kind).replace('{n}', String(ev.dmg)), 'blocked');
          break;
        case 'mobKilled':
          this.say(M.mobKilled.replace('{mob}', GAMES_TEXT.forestMobs[ev.kind] ?? ev.kind), 'win');
          break;
        case 'mobAppeared':
          this.say(M.wolfNear, 'blocked');
          break;
        case 'trapped':
          this.say(M.trapped.replace('{mob}', (GAMES_TEXT.forestMobs[ev.kind] ?? ev.kind).toLowerCase()), 'win');
          break;
        case 'trapEmptied':
          this.say(M.trapEmptied, 'win');
          break;
        case 'worn':
          this.say(M.worn, 'win');
          break;
        case 'noRoom':
          this.say(M.noRoom, 'blocked');
          break;
        case 'chopped':
          this.say(M.chopped, 'place');
          break;
        case 'crafted':
          this.say(M.crafted((GAMES_TEXT.forestItems[ev.item] ?? ev.item)), 'win');
          break;
        case 'needMaterials':
          this.say(M.needMaterials, 'blocked');
          break;
        case 'haveIt':
          this.say(M.haveIt, 'blocked');
          break;
        case 'noPlace':
          this.say(M.noPlace, 'blocked');
          break;
        case 'questReady':
          if (/^ch\d+$/.test(ev.id)) {
            this.renderStoryReady(ev.id);
            this.bag.removeAttribute('hidden');
          } else this.say(GAMES_TEXT.forestQuestReady, 'snack');
          break;
        case 'openRuins':
          if (this.state.claimed.includes('ch1')) this.say(M.ruins, 'blocked');
          break;
        case 'questDone':
          if (ev.reward > 0) this.host.earnTreats(ev.reward);
          this.say(M.questDone(ev.reward), 'snack');
          break;
        case 'openCook':
          this.openCook();
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
        case 'destroyed':
          this.say(M.destroyed(item(ev.item), ev.n), 'blocked');
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
    } else this.closeBag();
  }

  /** Закрыть рюкзак или окошко готовки; всё, что лежало в окошке, возвращается в рюкзак. */
  private closeBag(): void {
    frPotReturn(this.state);
    this.bag.setAttribute('hidden', '');
  }

  private iconCanvas(item: FrItem, size = 64): HTMLCanvasElement {
    const icon = el('canvas', { class: 'fr-slot-icon', width: String(size), height: String(size) }) as HTMLCanvasElement;
    const ictx = icon.getContext('2d');
    if (ictx && !(item in BUILD_ICON && drawIcon(ictx, item as string, size / 2, size / 2, size * 0.92))) {
      if (ictx && item in BUILD_ICON) {
        ictx.font = `${Math.round(size * 0.7)}px sans-serif`;
        ictx.textAlign = 'center';
        ictx.textBaseline = 'middle';
        ictx.fillText(BUILD_ICON[item] ?? '📦', size / 2, size / 2);
      } else if (ictx) drawItem(ictx, item, size / 2, size / 2 + 2, size * 0.8, 0);
    }
    return icon;
  }

  private partText(p: { key: string; need: number }, value: number): string {
    const tpl = GAMES_TEXT.forestPart[p.key] ?? p.key;
    const base = `${tpl.replace('{n}', String(p.need))} (${Math.min(value, p.need)}/${p.need})`;
    const cost = value >= p.need ? null : frPartCost(p.key);
    if (!cost) return base;
    const names = cost.map(([it, n]) => `${GAMES_TEXT.forestItems[it] ?? it} (${Math.min(this.state.inv[it] ?? 0, n)}/${n})`).join(', ');
    return `${base}\n${GAMES_TEXT.forestNeeds}: ${names}`;
  }

  /** Строки пунктов задания с прогрессом. */
  private questLines(q: FrQuest): HTMLElement[] {
    return q.parts.map((p) => {
      const v = frCounter(this.state, p.key, q);
      return el('div', { class: v >= p.need ? 'fr-qline done' : 'fr-qline', text: this.partText(p, v) });
    });
  }

  /** Плашка слева над полем: ближайшее невыполненное задание, нажатие открывает список. */
  private updateQuestCard(): void {
    const s = this.state;
    const ready = FR_QUESTS.find((q) => frQuestState(s, q) === 'ready');
    const next = ready ?? FR_QUESTS.find((q) => q.kind === 'regular' && frQuestState(s, q) === 'progress') ?? FR_QUESTS.find((q) => q.kind === 'story' && frQuestState(s, q) === 'progress');
    const key = next ? `${next.id}:${next.parts.map((p) => Math.min(frCounter(s, p.key, next), p.need)).join(',')}:${ready ? 1 : 0}` : 'done';
    if (this.questKey === key) return;
    this.questKey = key;
    this.questLine.classList.toggle('ready', !!ready);
    this.questLine.replaceChildren(
      el('span', { class: 'fr-quest-icon', text: '📜' }),
      el('span', { class: 'fr-quest-text' }, next ? (ready ? [el('b', { text: GAMES_TEXT.forestQuestReady })] : this.questLines(next)) : [el('b', { text: GAMES_TEXT.forestQuestsDone })]),
    );
  }

  /** Окно заданий: «по умолчанию» и обычные, у каждого награда и кнопка. */
  private openQuests(): void {
    this.closeMenu();
    this.renderQuests();
    this.bag.removeAttribute('hidden');
  }

  /** Сюжетный раздел: пройденные главы, текущая с текстом и закрытые «???». */
  private storySection(): HTMLElement {
    const s = this.state;
    const chapters = FR_QUESTS.filter((q) => q.kind === 'story');
    const rows = chapters.map((q) => {
      const st = frQuestState(s, q);
      const text = GAMES_TEXT.forestStory[q.id];
      if (st === 'locked') return el('div', { class: 'fr-qrow locked' }, [el('div', { class: 'fr-qlines' }, [el('b', { text: `🔒 ${GAMES_TEXT.forestLocked}` })])]);
      const btn = el('button', {
        type: 'button',
        class: st === 'ready' ? 'chunky fr-qbtn ready' : 'chunky fr-qbtn',
        text: st === 'ready' ? GAMES_TEXT.forestQClaim : st === 'claimed' ? GAMES_TEXT.forestQDone : GAMES_TEXT.forestQPending,
      });
      if (st !== 'ready') btn.setAttribute('disabled', '');
      btn.addEventListener('click', () => {
        this.handle(frClaim(s, q.id));
        if (!this.bag.hasAttribute('hidden') && !this.bag.querySelector('.fr-quests')) return;
        this.renderQuests();
      });
      return el('div', { class: st === 'claimed' ? 'fr-qrow story claimed' : st === 'ready' || st === 'progress' ? 'fr-qrow story active' : 'fr-qrow story' }, [
        el('div', { class: 'fr-qlines' }, [
          el('b', { text: text?.title ?? q.id }),
          ...(st === 'claimed' ? [] : [el('div', { class: 'fr-qintro', text: text?.text ?? '' }), ...this.questLines(q)]),
        ]),
        el('div', { class: 'fr-qreward' }, q.items
          ? (Object.entries(q.items) as Array<[FrItem, number]>).map(([it, n]) => el('span', { class: 'fr-qitem' }, [this.iconCanvas(it, 28), el('b', { text: String(n) })]))
          : [el('img', { src: this.host.treatImage, alt: '' }), el('b', { text: String(q.reward) })]),
        btn,
      ]);
    });
    return el('div', { class: 'fr-qsection' }, [el('h4', { text: GAMES_TEXT.forestStoryTitle }), ...rows]);
  }

  /** Сюжетный раздел свёрнут (по нажатию на заголовок). */
  private questTab: FrQuest['kind'] = 'story';

  private renderQuests(): void {
    const s = this.state;
    const order: Record<string, number> = { ready: 0, progress: 1, claimed: 2, locked: 3 };
    const section = (kind: FrQuest['kind']): HTMLElement => {
      const list = FR_QUESTS.filter((q) => q.kind === kind).sort((a, b) => order[frQuestState(s, a)]! - order[frQuestState(s, b)]!);
      const rows = list.map((q) => {
        const st = frQuestState(s, q);
        const btn = el('button', {
          type: 'button',
          class: st === 'ready' ? 'chunky fr-qbtn ready' : 'chunky fr-qbtn',
          text: st === 'ready' ? GAMES_TEXT.forestQClaim : st === 'claimed' ? GAMES_TEXT.forestQDone : GAMES_TEXT.forestQPending,
        });
        if (st !== 'ready') btn.setAttribute('disabled', '');
        btn.addEventListener('click', () => {
          this.handle(frClaim(s, q.id));
          this.renderQuests();
        });
        return el('div', { class: st === 'claimed' ? 'fr-qrow claimed' : 'fr-qrow' }, [
          el('div', { class: 'fr-qlines' }, this.questLines(q)),
          el('div', { class: 'fr-qreward' }, q.items
            ? (Object.entries(q.items) as Array<[FrItem, number]>).map(([it, n]) => el('span', { class: 'fr-qitem' }, [this.iconCanvas(it, 28), el('b', { text: String(n) })]))
            : [el('img', { src: this.host.treatImage, alt: '' }), el('b', { text: String(q.reward) })]),
          btn,
        ]);
      });
      return el('div', { class: 'fr-qsection' }, rows);
    };
    const tabs = (['story', 'regular', 'default'] as const).map((kind) => {
      const ready = FR_QUESTS.some((q) => q.kind === kind && frQuestState(s, q) === 'ready');
      const tab = el('button', { type: 'button', class: `fr-tab${this.questTab === kind ? ' on' : ''}${ready ? ' dot' : ''}`, text: GAMES_TEXT.forestQTabs[kind] ?? kind });
      tab.addEventListener('click', () => {
        this.questTab = kind;
        this.renderQuests();
      });
      return tab;
    });
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    // Список перерисовывается целиком — запоминаем прокрутку, чтобы окно не прыгало к началу.
    const oldPanel = this.bag.querySelector<HTMLElement>('.fr-bag');
    const keepPanel = oldPanel?.scrollTop ?? 0;
    const keepBag = this.bag.scrollTop;
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-cook fr-quests' }, [
        el('div', { class: 'fr-bag-head' }, [el('div', { class: 'fr-tabs' }, tabs), close]),
        this.questTab === 'story' ? this.storySection() : section(this.questTab),
      ]),
    );
    this.bag.scrollTop = keepBag;
    const panel = this.bag.querySelector<HTMLElement>('.fr-bag');
    if (panel) panel.scrollTop = keepPanel;
    // Сюжет: прокручиваем список до текущей главы (после показа окна, когда есть размеры).
    if (this.questTab === 'story') {
      const row = this.bag.querySelector<HTMLElement>('.fr-qrow.active');
      if (row) {
        requestAnimationFrame(() => {
          // Прокручиваем так, чтобы заголовок главы оказался сразу под закреплённой шапкой.
          const head = this.bag.querySelector<HTMLElement>('.fr-bag-head');
          for (const box of [panel, this.bag]) {
            if (!box || box.scrollHeight <= box.clientHeight) continue;
            const shift = row.getBoundingClientRect().top - box.getBoundingClientRect().top - (head?.offsetHeight ?? 0) - 8;
            box.scrollTop += shift;
            break;
          }
        });
      }
    }
  }

  private craftTab: string = 'fire';

  /** Рецепты, которые сейчас показываются в крафте (ткань остаётся в окне станка). */
  private craftRecipes(): ReadonlyArray<{ id: string; cost: ReadonlyArray<readonly [FrItem, number]> }> {
    const s = this.state;
    return [...FR_CRAFT, ...FR_LOOM.filter((r) => r.id !== 'cloth')].filter((r) => frRecipeShown(s, r.id));
  }

  /** Окошко после постройки станка или литейной: какие рецепты добавились в крафт. */
  private showNewRecipes(before: ReadonlySet<string>): void {
    const fresh = this.craftRecipes().filter((r) => !before.has(r.id));
    if (!fresh.length) return;
    const rows = fresh.map((r) =>
      el('div', { class: 'fr-newrow' }, [el('span', { class: 'fr-slot' }, [this.iconCanvas(r.id as FrItem, 48)]), el('b', { text: GAMES_TEXT.forestItems[r.id] ?? r.id })]),
    );
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    const ok = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestGotIt });
    ok.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestNewRecipes }), close]),
        ...rows,
        ok,
      ]),
    );
    this.bag.removeAttribute('hidden');
  }

  /** Значок вкладки крафта: картинка по центру, иначе эмодзи. */
  private tabIcon(kind: string, fallback: string): HTMLCanvasElement {
    const c = el('canvas', { width: '64', height: '64' }) as HTMLCanvasElement;
    c.style.cssText = 'width:32px;height:32px;display:block';
    const g = c.getContext('2d');
    if (g && !drawIcon(g, kind, 32, 32, 60)) {
      g.font = '44px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(fallback, 32, 32);
    }
    return c;
  }

  /** Окно крафта: вкладки сверху (только значки), плитки предметов с материалами; нажатие открывает подробности. */
  private renderCraft(): void {
    const s = this.state;
    const all = this.craftRecipes();
    const groups = CRAFT_TABS.map((t) => ({ ...t, recipes: all.filter((r) => t.items.includes(r.id)) })).filter((t) => t.recipes.length > 0);
    if (!groups.some((t) => t.id === this.craftTab)) this.craftTab = groups[0]?.id ?? 'fire';
    const tabs = groups.map((t) => {
      const b = el('button', { type: 'button', class: this.craftTab === t.id ? 'fr-tab on' : 'fr-tab', 'aria-label': GAMES_TEXT.forestCraftTabs[t.id] ?? t.id, title: GAMES_TEXT.forestCraftTabs[t.id] ?? t.id }, [this.tabIcon(t.icon, t.emoji)]);
      b.addEventListener('click', () => {
        this.craftTab = t.id;
        this.renderCraft();
      });
      return b;
    });
    const recipes = groups.find((t) => t.id === this.craftTab)?.recipes ?? [];
    const tiles = recipes.map((r) => {
      const can = isLoomId(r.id) ? frCanWeave(s, r.id) && frBuilt(s, 'loom') : frCanCraft(s, r.id as FrCraftId);
      const mats = r.cost.map(([it, n]) =>
        el('span', { class: (s.inv[it] ?? 0) >= n ? 'fr-mat ok' : 'fr-mat bad' }, [this.iconCanvas(it, 24), el('b', { text: String(n) })]),
      );
      const tile = el('button', { type: 'button', class: can ? 'fr-ctile can' : 'fr-ctile', 'aria-label': GAMES_TEXT.forestItems[r.id] ?? r.id }, [
        this.iconCanvas(r.id as FrItem, 72),
      ]);
      tile.addEventListener('click', () => (isLoomId(r.id) ? this.renderLoomDetail(r.id) : this.renderCraftDetail(r.id as FrCraftId)));
      return el('div', { class: 'fr-citem' }, [
        el('div', { class: 'fr-crow' }, [tile, el('div', { class: 'fr-cmats' }, mats)]),
        el('div', { class: 'fr-cname', text: GAMES_TEXT.forestItems[r.id] ?? r.id }),
      ]);
    });
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-craft' }, [
        el('div', { class: 'fr-bag-head' }, [el('div', { class: 'fr-tabs' }, tabs), close]),
        el('div', { class: 'fr-cgrid' }, tiles),
      ]),
    );
  }

  /** Подробности предмета: картинка, описание, «Владение», материалы «есть/нужно» и «Изготовление». */
  private renderCraftDetail(id: (typeof FR_CRAFT)[number]['id']): void {
    const s = this.state;
    const r = FR_CRAFT.find((x) => x.id === id)!;
    const owned = id === 'campfire' ? (frHasPit(s) && s.loc !== 'home' ? 1 : 0) : FR_BUILDINGS.includes(id) ? s.tiles.filter((k) => k === id).length : s.inv[id as FrItem] ?? 0;
    const mats = r.cost.map(([it, n]) =>
      el('div', { class: 'fr-dmat' }, [
        el('span', { class: 'fr-slot' }, [this.iconCanvas(it)]),
        el('b', { class: (s.inv[it] ?? 0) >= n ? 'ok' : 'bad', text: `${Math.min(s.inv[it] ?? 0, 99)}/${n}` }),
      ]),
    );
    const make = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestMake });
    if (!frCanCraft(s, id) || (owned > 0 && id !== 'torch' && id !== 'lantern' && id !== 'flask' && id !== 'trap')) make.setAttribute('disabled', '');
    const homeOnly = (id === 'chest' || id === 'loom' || id === 'foundry' || id === 'dryer' || id === 'lighthouse') && s.loc !== 'home';
    const campOnly = id === 'campfire' && s.loc === 'home';
    if (homeOnly || campOnly) make.setAttribute('disabled', '');
    const why =
      homeOnly
        ? GAMES_TEXT.forestHomeOnly
        : campOnly
          ? GAMES_TEXT.forestCampOnly
          : owned > 0 && id !== 'torch' && id !== 'lantern' && id !== 'flask' && id !== 'trap'
        ? GAMES_TEXT.forestAlreadyBuilt
        : !frCanCraft(s, id)
          ? GAMES_TEXT.forestNeedMats
          : '';
    make.addEventListener('click', () => {
      if (FR_BUILDINGS.includes(id)) {
        this.startPlacing(id);
        return;
      }
      this.handle(frCraft(s, id));
      this.renderCraftDetail(id);
    });
    const back = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    back.addEventListener('click', () => this.renderCraft());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card fr-nopan' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestItems[id] ?? id }), back]),
        el('div', { class: 'fr-detail-top' }, [
          el('div', { class: 'fr-detail-icon' }, [this.iconCanvas(id as FrItem, 96)]),
          el('div', { class: 'fr-detail-text' }, [
            el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestDesc[id] ?? '' }),
            el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestOwned(owned) }),
          ]),
        ]),
        el('div', { class: 'fr-dmats' }, mats),
        make,
        ...(why ? [el('p', { class: 'fr-card-desc fr-why', text: why })] : []),
      ]),
    );
  }

  /** Сундук: сверху то, что в нём, снизу рюкзак; нажатие переносит одну штуку. */
  private openChest(): void {
    this.renderChest();
    this.bag.removeAttribute('hidden');
  }

  /** Переложить предмет: одну штуку сразу, а если их больше — окошко «сколько». */
  private moveItems(item: FrItem, have: number, toChest: boolean): void {
    const s = this.state;
    const run = (n: number): void => {
      if (toChest) frChestPut(s, item, n);
      else frChestTake(s, item, n);
      this.renderChest();
    };
    if (have <= 1) {
      run(have);
      return;
    }
    let n = Math.min(have, 1);
    const num = el('span', { class: 'fr-qty-num', text: String(n) });
    const set = (v: number): void => {
      n = Math.max(1, Math.min(have, v));
      num.textContent = String(n);
    };
    const btn = (label: string, fn: () => void): HTMLElement => {
      const b = el('button', { type: 'button', class: 'chunky fr-qty-btn', text: label });
      b.addEventListener('click', fn);
      return b;
    };
    const ok = el('button', { type: 'button', class: 'chunky fr-action', text: 'OK' });
    ok.addEventListener('click', () => run(n));
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.renderChest());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestItems[item] ?? item }), close]),
        el('div', { class: 'fr-detail-icon' }, [this.iconCanvas(item, 96)]),
        el('div', { class: 'fr-qty' }, [
          btn('«', () => set(1)),
          btn('−', () => set(n - 1)),
          num,
          btn('+', () => set(n + 1)),
          btn('»', () => set(have)),
        ]),
        ok,
      ]),
    );
  }

  /** Окошко «сколько»: выбор количества из пачки. */
  private askCount(item: FrItem, have: number, title: string, run: (n: number) => void, back: () => void): void {
    let n = 1;
    const num = el('span', { class: 'fr-qty-num', text: '1' });
    const set = (v: number): void => {
      n = Math.max(1, Math.min(have, v));
      num.textContent = String(n);
    };
    const btn = (label: string, fn: () => void): HTMLElement => {
      const b = el('button', { type: 'button', class: 'chunky fr-qty-btn', text: label });
      b.addEventListener('click', fn);
      return b;
    };
    const ok = el('button', { type: 'button', class: 'chunky fr-action', text: title });
    ok.addEventListener('click', () => run(n));
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', back);
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: `${GAMES_TEXT.forestItems[item] ?? item} ×${have}` }), close]),
        el('div', { class: 'fr-detail-icon' }, [this.iconCanvas(item, 96)]),
        el('div', { class: 'fr-qty' }, [btn('«', () => set(1)), btn('−', () => set(n - 1)), num, btn('+', () => set(n + 1)), btn('»', () => set(have))]),
        ok,
      ]),
    );
  }

  /** Верхние слоты рюкзака: надетые кошельки (+4 ячейки каждый). */
  private gearRow(): HTMLElement {
    const s = this.state;
    const slots: HTMLElement[] = [];
    for (let k = 0; k < FR_GEAR_SLOTS; k++) {
      const item = s.worn[k];
      if (!item) {
        slots.push(el('span', { class: 'fr-slot empty fr-gear-slot', 'aria-label': GAMES_TEXT.forestGear }, [el('span', { class: 'fr-gear-hint', text: '👝' })]));
        continue;
      }
      const slot = el('button', { type: 'button', class: 'fr-slot fr-gear-slot', 'aria-label': GAMES_TEXT.forestItems[item] ?? item }, [this.iconCanvas(item)]);
      slot.addEventListener('click', () => {
        this.handle(frUnwear(s, k));
        this.renderBag();
      });
      slots.push(slot);
    }
    // Оружие в руках: нажатие открывает его карточку (там «Убрать из рук» и усиление камнем).
    const held = s.weapon && (s.inv[s.weapon] ?? 0) > 0 ? s.weapon : null;
    if (held) {
      const w = el('button', { type: 'button', class: 'fr-slot fr-gear-slot fr-weapon-slot', 'aria-label': GAMES_TEXT.forestItems[held] ?? held }, [this.iconCanvas(held)]);
      w.addEventListener('click', () => this.renderItem(held));
      slots.push(w);
    } else {
      slots.push(el('span', { class: 'fr-slot empty fr-gear-slot fr-weapon-slot', 'aria-label': GAMES_TEXT.forestWeapon }, [el('span', { class: 'fr-gear-hint', text: '⚔️' })]));
    }
    return el('div', { class: 'fr-gear' }, [el('span', { class: 'fr-gear-title', text: GAMES_TEXT.forestGear }), ...slots]);
  }

  /** Карточка предмета со станка: ткань, кошелёк, палатка, лежак. */
  private renderLoomDetail(id: FrLoomId): void {
    const s = this.state;
    const r = FR_LOOM.find((x) => x.id === id)!;
    const owned = id === 'shelter' ? (s.shelter > 0 ? 1 : 0) : id === 'bed' ? (s.bed ? 1 : 0) : s.inv[id as FrItem] ?? 0;
    const mats = r.cost.map(([it, n]) =>
      el('div', { class: 'fr-dmat' }, [
        el('span', { class: 'fr-slot' }, [this.iconCanvas(it)]),
        el('b', { class: (s.inv[it] ?? 0) >= n ? 'ok' : 'bad', text: `${Math.min(s.inv[it] ?? 0, 99)}/${n}` }),
      ]),
    );
    const noLoom = !frBuilt(s, 'loom');
    const done = frLoomDone(s, id);
    const make = el('button', { type: 'button', class: 'chunky fr-action', text: done ? (id === 'shelter' ? `${s.shelter}/${FR_SHELTER_RAINS}` : GAMES_TEXT.forestHave) : GAMES_TEXT.forestMake });
    if (noLoom || !frCanWeave(s, id)) make.setAttribute('disabled', '');
    const why = noLoom ? GAMES_TEXT.forestNeedLoom : done ? GAMES_TEXT.forestAlreadyBuilt : !frCanWeave(s, id) ? GAMES_TEXT.forestNeedMats : '';
    make.addEventListener('click', () => {
      this.handle(frWeave(s, id));
      this.renderLoomDetail(id);
    });
    const back = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    back.addEventListener('click', () => this.renderCraft());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card fr-nopan' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestItems[id] ?? id }), back]),
        el('div', { class: 'fr-detail-top' }, [
          el('div', { class: 'fr-detail-icon' }, [this.iconCanvas(id as FrItem, 96)]),
          el('div', { class: 'fr-detail-text' }, [
            el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestDesc[id] ?? '' }),
            el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestOwned(owned) }),
          ]),
        ]),
        el('div', { class: 'fr-dmats' }, mats),
        make,
        ...(why ? [el('p', { class: 'fr-card-desc fr-why', text: why })] : []),
      ]),
    );
  }

  /** Ткацкий станок: здесь ткётся только ткань (кошелёк, палатка и лежак — в общем крафте). */
  private renderLoom(): void {
    const s = this.state;
    const rows = FR_LOOM.filter((r) => r.id === 'cloth').map((r) => {
      const mats = r.cost.map(([it, n]) =>
        el('span', { class: (s.inv[it] ?? 0) >= n ? 'fr-mat ok' : 'fr-mat bad' }, [this.iconCanvas(it, 24), el('b', { text: `${Math.min(s.inv[it] ?? 0, n)}/${n}` })]),
      );
      const make = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestMake });
      if (!frCanWeave(s, r.id)) make.setAttribute('disabled', '');
      const done = frLoomDone(s, r.id);
      if (done) make.textContent = r.id === 'shelter' ? `${s.shelter}/${FR_SHELTER_RAINS}` : GAMES_TEXT.forestHave;
      make.addEventListener('click', () => {
        this.handle(frWeave(s, r.id));
        this.renderLoom();
      });
      return el('div', { class: 'fr-recipe' }, [
        el('span', { class: 'fr-slot' }, [r.id === 'shelter' || r.id === 'bed' ? el('span', { class: 'fr-chest-ico', text: r.id === 'shelter' ? '⛺' : '🛏️' }) : this.iconCanvas(r.id)]),
        el('div', { class: 'fr-recipe-info' }, [el('b', { text: GAMES_TEXT.forestItems[r.id] ?? r.id }), el('div', { class: 'fr-mats' }, mats), el('small', { text: GAMES_TEXT.forestDesc[r.id] ?? '' })]),
        make,
      ]);
    });
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-craft' }, [el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestPlaces.loom ?? '' }), close]), ...rows]),
    );
  }

  /** Литейная: 2 руды переплавляются в один железный слиток. */
  private renderFoundry(): void {
    const s = this.state;
    const ore = s.inv.ore ?? 0;
    const make = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestSmelt });
    if (!frCanSmelt(s)) make.setAttribute('disabled', '');
    make.addEventListener('click', () => {
      this.handle(frSmelt(s));
      this.renderFoundry();
    });
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-craft' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestPlaces.foundry ?? '' }), close]),
        el('div', { class: 'fr-recipe' }, [
          el('span', { class: 'fr-slot' }, [this.iconCanvas('ingot')]),
          el('div', { class: 'fr-recipe-info' }, [
            el('b', { text: GAMES_TEXT.forestItems.ingot ?? '' }),
            el('div', { class: 'fr-mats' }, [el('span', { class: ore >= FR_SMELT_ORE ? 'fr-mat ok' : 'fr-mat bad' }, [this.iconCanvas('ore', 24), el('b', { text: `${Math.min(ore, FR_SMELT_ORE)}/${FR_SMELT_ORE}` })])]),
            el('small', { text: `${GAMES_TEXT.forestItems.ingot}: ${s.inv.ingot ?? 0}` }),
          ]),
          make,
        ]),
      ]),
    );
  }

  /** Маяк: ночью его можно зажечь один раз. */
  private renderLighthouse(): void {
    const s = this.state;
    const lit = (s.count.beacon ?? 0) > 0;
    const light = el('button', { type: 'button', class: 'chunky fr-action', text: lit ? GAMES_TEXT.forestBeaconLit : GAMES_TEXT.forestBeaconLight });
    if (!frCanLightBeacon(s)) light.setAttribute('disabled', '');
    light.addEventListener('click', () => {
      this.handle(frLightBeacon(s));
      this.renderLighthouse();
    });
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestPlaces.lighthouse ?? '' }), close]),
        el('p', { class: 'fr-card-desc', text: lit ? GAMES_TEXT.forestBeaconOn : GAMES_TEXT.forestBeaconHint }),
        el('div', { class: 'fr-actions' }, [light]),
      ]),
    );
  }

  private chapterTitle(id: string): string {
    return `${GAMES_TEXT.forestChapter(Number(id.slice(2)))} ${GAMES_TEXT.forestStory[id]?.title ?? ''}`;
  }

  private rewardRow(id: string): HTMLElement {
    const q = FR_QUESTS.find((x) => x.id === id);
    return el('div', { class: 'fr-qreward fr-story-reward' }, q?.items
      ? (Object.entries(q.items) as Array<[FrItem, number]>).map(([it, n]) => el('span', { class: 'fr-qitem' }, [this.iconCanvas(it, 32), el('b', { text: String(n) })]))
      : [el('img', { src: this.host.treatImage, alt: '' }), el('b', { text: String(q?.reward ?? 0) })]);
  }

  /** Окошко с текстом: прокручивается только текст, кнопки закреплены внизу. */
  private splitCard(title: string, body: Array<HTMLElement | null>, actions: HTMLElement[]): HTMLElement {
    return el('div', { class: 'fr-bag fr-card fr-split' }, [
      el('div', { class: 'fr-bag-head' }, [el('h3', { text: title })]),
      el('div', { class: 'fr-scroll' }, body.filter((x): x is HTMLElement => !!x)),
      el('div', { class: 'fr-actions' }, actions),
    ]);
  }

  /** Начало главы: рассказ, задание и награда. */
  private renderStoryStart(id: string): void {
    const q = FR_QUESTS.find((x) => x.id === id);
    if (!q) return;
    // Глава уже выполнена (записка смотрителя): сразу «Забрать».
    if (frQuestState(this.state, q) === 'ready') {
      this.renderStoryReady(id);
      return;
    }
    const go = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestStoryGo });
    go.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      this.splitCard(
        this.chapterTitle(id),
        [el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestStory[id]?.text ?? '' }), el('h4', { text: GAMES_TEXT.forestTaskLabel }), ...this.questLines(q), this.rewardRow(id)],
        [go],
      ),
    );
  }

  /** Конец главы: награда и кнопка «Забрать», после неё откроется следующая глава. */
  private renderStoryReady(id: string): void {
    const s = this.state;
    const take = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestStoryTake });
    take.addEventListener('click', () => this.handle(frClaim(s, id)));
    this.bag.replaceChildren(
      this.splitCard(
        this.chapterTitle(id),
        [el('p', { class: 'fr-card-desc', text: id === 'ch1' ? GAMES_TEXT.forestStory.ch1?.text ?? '' : GAMES_TEXT.forestStoryDone[id] ?? GAMES_TEXT.forestTaskDone }), this.rewardRow(id)],
        [take],
      ),
    );
  }

  /** После награды: следующая глава или финал. */
  private renderStoryNext(): void {
    const next = frStoryActive(this.state);
    if (next) {
      this.renderStoryStart(next.id);
      return;
    }
    const ok = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestStoryOk });
    ok.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      this.splitCard(GAMES_TEXT.forestFinalTitle, [el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestFinal })], [ok]),
    );
  }

  /** Вступление при создании новой карты. */
  private introTip(): void {
    const s = this.state;
    if (s.over || !s.count.introPending) return;
    s.count.introPending = 0;
    const go = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestIntroGo });
    go.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      this.splitCard(GAMES_TEXT.forestTitle, [el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestIntro })], [go]),
    );
    this.bag.removeAttribute('hidden');
  }

  /** Сушилка: мясо или рыба + соль → вяленое. */
  private renderDryer(): void {
    const s = this.state;
    const salt = s.inv.salt ?? 0;
    const rows = FR_DRY.map((d) => {
      const have = s.inv[d.from] ?? 0;
      const make = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestDry });
      if (!frCanDry(s, d.from)) make.setAttribute('disabled', '');
      make.addEventListener('click', () => {
        this.handle(frDry(s, d.from));
        this.renderDryer();
      });
      return el('div', { class: 'fr-recipe' }, [
        el('span', { class: 'fr-slot' }, [this.iconCanvas(d.to)]),
        el('div', { class: 'fr-recipe-info' }, [
          el('b', { text: GAMES_TEXT.forestItems[d.to] ?? '' }),
          el('div', { class: 'fr-mats' }, [
            el('span', { class: have >= 1 ? 'fr-mat ok' : 'fr-mat bad' }, [this.iconCanvas(d.from, 24), el('b', { text: `${Math.min(have, 1)}/1` })]),
            el('span', { class: salt >= 1 ? 'fr-mat ok' : 'fr-mat bad' }, [this.iconCanvas('salt', 24), el('b', { text: `${Math.min(salt, 1)}/1` })]),
          ]),
          el('small', { text: `${GAMES_TEXT.forestItems[d.to]}: ${s.inv[d.to] ?? 0}` }),
        ]),
        make,
      ]);
    });
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-craft' }, [el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestPlaces.dryer ?? '' }), close]), ...rows]),
    );
  }

  /** Подтверждение выхода из дома: про костёр, дождь и факелы. */
  private renderTravel(to: FrPlace): void {
    const go = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestGo });
    go.addEventListener('click', () => {
      this.closeBag();
      this.handle(frTravel(this.state, to));
    });
    const stay = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestStay });
    stay.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      this.splitCard(
        GAMES_TEXT.forestLocs[to] ?? '',
        [el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestTravelWarn[to] ?? '' }), el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestTravelCommon })],
        [go, stay],
      ),
    );
  }

  private renderChest(): void {
    const s = this.state;
    const stacks: Array<{ item: FrItem; n: number }> = [];
    for (const item of ITEM_ORDER) {
      let n = s.chest[item] ?? 0;
      while (n > 0) {
        stacks.push({ item, n: Math.min(FR_STACK, n) });
        n -= FR_STACK;
      }
    }
    const cells: HTMLElement[] = [];
    for (let k = 0; k < frBagSize(s); k++) {
      const st = stacks[k];
      if (!st) {
        cells.push(el('span', { class: 'fr-slot empty' }));
        continue;
      }
      const slot = el('button', { type: 'button', class: 'fr-slot', 'aria-label': GAMES_TEXT.forestItems[st.item] ?? st.item }, [
        this.iconCanvas(st.item),
        ...(st.n > 1 ? [el('span', { class: 'fr-slot-count', text: String(st.n) })] : []),
        ...(TOOLS.includes(st.item) ? [this.durBar(st.item as FrTool)] : []),
      ]);
      slot.addEventListener('click', () => this.moveItems(st.item, s.chest[st.item] ?? 0, false));
      cells.push(slot);
    }
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-cook' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestChestTitle }), close]),
        el('div', { class: 'fr-grid' }, cells),
        el('h3', { class: 'fr-sub', text: GAMES_TEXT.forestBagTitle(frBagUsed(s), frBagSize(s)) }),
        el('div', { class: 'fr-grid' }, this.bagCells((item) => this.moveItems(item, s.inv[item] ?? 0, true))),
      ]),
    );
  }

  /** Окошко готовки у костра: в него по одной штуке переезжает еда из рюкзака. */
  private openCook(): void {
    this.renderCook();
    this.bag.removeAttribute('hidden');
  }

  private renderCook(): void {
    const s = this.state;
    const out = frRecipe(s.pot);
    const slots: HTMLElement[] = [];
    for (let k = 0; k < FR_POT_SLOTS; k++) {
      const item = s.pot[k];
      if (!item) {
        slots.push(el('span', { class: 'fr-slot empty' }));
        continue;
      }
      const icon = el('canvas', { class: 'fr-slot-icon', width: '64', height: '64' }) as HTMLCanvasElement;
      const ictx = icon.getContext('2d');
      if (ictx) drawItem(ictx, item, 32, 34, 52, 0);
      const slot = el('button', { type: 'button', class: 'fr-slot', 'aria-label': GAMES_TEXT.forestItems[item] ?? item }, [icon]);
      slot.addEventListener('click', () => {
        frPotRemove(s, k);
        this.renderCook();
      });
      slots.push(slot);
    }
    const result = out ? el('span', { class: 'fr-slot fr-result' }) : el('button', { type: 'button', class: 'fr-slot empty fr-result', 'aria-label': GAMES_TEXT.forestRecipes });
    if (!out) result.addEventListener('click', () => this.renderRecipes());
    if (out) {
      const icon = el('canvas', { class: 'fr-slot-icon', width: '64', height: '64' }) as HTMLCanvasElement;
      const ictx = icon.getContext('2d');
      if (ictx) drawItem(ictx, out, 32, 34, 52, 0);
      result.append(icon);
    } else result.append(el('span', { class: 'fr-result-q', text: '?' }));
    const cook = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestActs.cook });
    if (!out) cook.setAttribute('disabled', '');
    cook.addEventListener('click', () => {
      this.handle(frPotCook(s));
      this.renderCook();
    });
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-cook' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestCookTitle }), close]),
        el('div', { class: 'fr-cook-row' }, [result]),
        el('div', { class: 'fr-cook-row' }, slots),
        el('p', { class: 'fr-card-desc', text: out ? GAMES_TEXT.forestItems[out] ?? out : GAMES_TEXT.forestCookHint }),
        cook,
        el('div', { class: 'fr-grid' }, this.bagCells((item) => {
          frPotAdd(s, item);
          this.renderCook();
        }, frCookable)),
      ]),
    );
  }

  /** Список рецептов: доступные нажимаются и сами кладут ингредиенты в окошко, остальные затемнены. */
  private renderRecipes(): void {
    const s = this.state;
    const rows = FR_RECIPES.map((r) => ({ r, ok: frRecipeAvailable(s, r) })).sort((a, b) => Number(b.ok) - Number(a.ok));
    const list = rows.map(({ r, ok }) => {
      const counts = new Map<FrItem, number>();
      for (const it of r.from) counts.set(it, (counts.get(it) ?? 0) + 1);
      const mats = [...counts].map(([it, n]) => el('span', { class: 'fr-mat' }, [this.iconCanvas(it, 24), el('b', { text: n > 1 ? `×${n}` : '' })]));
      const row = el('button', { type: 'button', class: ok ? 'fr-recipe fr-recipe-pick' : 'fr-recipe fr-recipe-pick dim' }, [
        el('span', { class: 'fr-slot' }, [this.iconCanvas(r.to)]),
        el('div', { class: 'fr-recipe-info' }, [el('b', { text: GAMES_TEXT.forestItems[r.to] ?? r.to }), el('div', { class: 'fr-mats' }, mats)]),
        el('div', { class: 'fr-rfx' }, Object.entries(FR_EFFECTS[r.to] ?? {}).flatMap(([k, v]) => [el('span', { text: GAMES_TEXT.forestStatNames[k] ?? k }), el('b', { text: `+${v}` })])),
      ]);
      if (!ok) row.setAttribute('disabled', '');
      row.addEventListener('click', () => {
        if (frRecipeFill(s, r)) this.renderCook();
      });
      return row;
    });
    const back = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    back.addEventListener('click', () => this.renderCook());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-craft' }, [el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestRecipes }), back]), ...list]),
    );
  }

  /** Ячейки рюкзака: по нажатию вызывается onPick с видом предмета. */
  private bagCells(onPick: (item: FrItem) => void, enabled: (item: FrItem) => boolean = () => true): HTMLElement[] {
    const s = this.state;
    const stacks: Array<{ item: FrItem; n: number }> = [];
    const held = frHeld(s);
    for (const item of ITEM_ORDER) {
      let n = (s.inv[item] ?? 0) - (item === held ? 1 : 0);
      while (n > 0) {
        stacks.push({ item, n: Math.min(FR_STACK, n) });
        n -= FR_STACK;
      }
    }
    const cells: HTMLElement[] = [];
    for (let k = 0; k < frBagSize(s); k++) {
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
      if (!enabled(st.item)) {
        slot.setAttribute('disabled', '');
        slot.classList.add('dim');
      }
      slot.addEventListener('click', () => onPick(st.item));
      cells.push(slot);
    }
    return cells;
  }

  /** Рюкзак — сетка 4×3 ячеек; нажатие на ячейку открывает карточку предмета. */
  private renderBag(): void {
    const s = this.state;
    const cells = this.bagCells((item) => this.renderItem(item));
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.toggleBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestBagTitle(frBagUsed(s), frBagSize(s)) }), close]),
        this.gearRow(),
        el('div', { class: 'fr-grid' }, cells),
      ]),
    );
  }

  /** Карточка предмета: картинка, что даёт, описание, «Съесть» и «Выбросить». */
  /** Полоска прочности инструмента. */
  private durBar(tool: FrTool): HTMLElement {
    const left = frDurability(this.state, tool);
    const uses = frToolMax(this.state, tool);
    const pct = Math.round((left / uses) * 100);
    const color = pct > 50 ? '#4caf50' : pct > 25 ? '#f0b429' : '#e0443e';
    const fill = el('i', { style: `width:${pct}%;background:${color}` });
    return el('span', { class: 'fr-dur', title: `${left}/${uses}` }, [fill]);
  }

  private renderItem(item: FrItem): void {
    const s = this.state;
    if (!(s.inv[item] ?? 0)) {
      this.renderBag();
      return;
    }
    const icon = el('canvas', { class: 'fr-card-icon', width: '96', height: '96' }) as HTMLCanvasElement;
    const ictx = icon.getContext('2d');
    if (ictx) drawItem(ictx, item, 48, 50, 78, 0);
    const fx = FR_EFFECTS[item];
    const buttons: HTMLElement[] = [];
    if (item === 'torch') {
      const light = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestLight });
      light.addEventListener('click', () => {
        this.handle(frTorch(s));
        this.renderItem(item);
      });
      buttons.push(light);
    }
    if (item === 'lantern') {
      const light = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestLight });
      light.addEventListener('click', () => {
        this.handle(frLantern(s));
        this.renderItem(item);
      });
      buttons.push(light);
    }
    if (TOOLS.includes(item)) {
      const up = el('button', { type: 'button', class: 'chunky fr-action', text: s.up[item as FrTool] ? GAMES_TEXT.forestUpgraded : `${GAMES_TEXT.forestUpgrade} (${s.inv.crystal ?? 0})` });
      if (!frCanUpgrade(s, item as FrTool)) up.setAttribute('disabled', '');
      up.addEventListener('click', () => {
        this.handle(frUpgrade(s, item as FrTool));
        this.renderItem(item);
      });
      buttons.push(up);
    }
    if (FR_WEAPONS[item as FrTool]) {
      const on = s.weapon === item;
      const equip = el('button', { type: 'button', class: 'chunky fr-action', text: on ? GAMES_TEXT.forestUnequip : GAMES_TEXT.forestEquip });
      equip.addEventListener('click', () => {
        this.handle(frEquip(s, item as FrTool));
        this.renderItem(item);
      });
      buttons.push(equip);
    }
    if (item === 'purse') {
      const wear = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestWear });
      if (s.worn.length >= FR_GEAR_SLOTS) wear.setAttribute('disabled', '');
      wear.addEventListener('click', () => {
        this.handle(frWear(s, item));
        this.renderBag();
      });
      buttons.push(wear);
    }
    if (fx) {
      const drink = !fx.food && !!fx.water;
      const eat = el('button', { type: 'button', class: 'chunky fr-action', text: drink ? GAMES_TEXT.forestDrink : GAMES_TEXT.forestEat });
      eat.addEventListener('click', () => {
        this.handle(frEat(s, item));
        this.renderItem(item);
      });
      buttons.push(eat);
    }
    const toss = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestThrow });
    toss.addEventListener('click', () => {
      const have = s.inv[item] ?? 0;
      if (have <= 1) {
        this.handle(frThrow(s, item));
        this.renderItem(item);
        return;
      }
      this.askCount(item, have, GAMES_TEXT.forestThrow, (n) => {
        this.handle(frThrow(s, item, n));
        this.renderItem(item);
      }, () => this.renderItem(item));
    });
    buttons.push(toss);
    // Удаление: одну штуку — в два нажатия, пачку — с выбором количества.
    const destroy = el('button', { type: 'button', class: 'chunky fr-action fr-destroy', text: GAMES_TEXT.forestDestroy });
    let sure = false;
    destroy.addEventListener('click', () => {
      const have = s.inv[item] ?? 0;
      if (have > 1) {
        this.askCount(item, have, GAMES_TEXT.forestDestroy, (n) => {
          this.handle(frDestroy(s, item, n));
          this.renderBag();
        }, () => this.renderItem(item));
        return;
      }
      if (!sure) {
        sure = true;
        destroy.textContent = GAMES_TEXT.forestDestroySure(1);
        destroy.classList.add('sure');
        return;
      }
      this.handle(frDestroy(s, item));
      this.renderBag();
    });
    buttons.push(destroy);
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.renderBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: TOOLS.includes(item) || (s.inv[item] ?? 0) <= 1 ? (GAMES_TEXT.forestItems[item] ?? item) : `${GAMES_TEXT.forestItems[item] ?? item} ×${s.inv[item]}` }), close]),
        el('div', { class: 'fr-card-top' }, [
          el('div', { class: 'fr-card-iconbox' }, [icon, ...(TOOLS.includes(item) ? [this.durBar(item as FrTool)] : [])]),
          el('div', { class: 'fr-card-lines' }, fx ? Object.entries(fx).map(([k, v]) => el('span', { text: `${GAMES_TEXT.forestStatNames[k] ?? k} +${v}` })) : FR_WEAPONS[item as FrTool] ? [el('div', { class: 'fr-wstats' }, [
            el('span', { text: GAMES_TEXT.forestStatDmg }), el('b', { text: String(frWeaponDmg(s, item as FrTool)) }),
            el('span', { text: GAMES_TEXT.forestStatSpeed }), el('b', { text: GAMES_TEXT.forestStatSpeedVal(FR_WEAPONS[item as FrTool]!.ms) }),
          ])] : []),
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

  /** В начале похода: предупреждение про дождь и шалаш. */
  private shelterTip(): void {
    const s = this.state;
    if (s.over || s.day > 1 || s.clock > 30_000 || s.count.tip) return;
    s.count.tip = 1;
    this.say(GAMES_TEXT.forestShelterTip);
    this.messageLeft = 12_000;
  }

  private restart(): void {
    this.state = newForest(randomSeed());
    storeSaved(this.state);
    this.overPanel.setAttribute('hidden', '');
    this.bag.setAttribute('hidden', '');
    this.closeMenu();
    this.say(GAMES_TEXT.forestHint);
    this.introTip();
    this.shelterTip();
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
    const day = GAMES_TEXT.forestDay(s.day);
    this.clockHand.setAttribute('transform', `rotate(${((s.clock / FR_DAY_MS) * 360).toFixed(1)} 24 24)`);
    const dayText = s.loc === 'home' ? day : `${day} · ${GAMES_TEXT.forestLocs[s.loc]}`;
    if (this.dayChip.textContent !== dayText) this.dayChip.textContent = dayText;
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
    this.updateQuestCard();
    this.updateStatusIcons();
    // «Проснуться» видна только во сне; лечь спать можно кнопкой у горящего костра.
    if (this.sleepButton.hidden === s.sleeping) this.sleepButton.hidden = !s.sleeping;
  }

  /** Значки сбоку поля: горящий факел с полоской времени и предупреждение о дожде. */
  private updateStatusIcons(): void {
    const s = this.state;
    const torchOn = s.torch > 0;
    this.torchBox.hidden = !torchOn;
    if (torchOn) this.torchFill.style.width = `${Math.max(0, Math.min(100, (s.torch / (s.torchMax || FR_TORCH_MS)) * 100))}%`;
    const raining = frRainHere(s);
    const soon = frRainSoon(s);
    this.rainIcon.hidden = !raining && !soon;
    this.rainIcon.classList.toggle('blink', soon);
  }

  // --- Рисование ---

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    // Поле занимает всё доступное место: страница игры не должна листаться.
    const cw = this.canvas.clientWidth;
    const wrap = this.canvas.parentElement;
    if (cw > 0 && wrap && this.root.isConnected) {
      const sc = (this.root.closest('.overlay') as HTMLElement | null) ?? document.documentElement;
      const fits = sc.clientHeight >= 520;
      if (fits && sc.scrollTop) sc.scrollTop = 0;
      const box = (this.root.closest('.overlay-body') as HTMLElement | null) ?? this.root;
      const wr = wrap.getBoundingClientRect();
      const top = wr.top - sc.getBoundingClientRect().top + sc.scrollTop;
      const below = box.getBoundingClientRect().bottom - wr.bottom;
      const avail = sc.clientHeight - top - below - 14;
      const want = Math.round(Math.max(180, Math.min(avail, cw * 1.5)));
      if (this.canvas.style.height !== `${want}px`) this.canvas.style.height = `${want}px`;
    }
    const w = Math.round(cw * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (w > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.shade.width = w;
      this.shade.height = h;
    }
  }

  /** Сдвиг камеры (в клетках) от слежения за питомцем; сбрасывается, когда питомец двигается. */
  private pan = { x: 0, y: 0 };
  private drag: { px: number; py: number; ox: number; oy: number } | null = null;
  private dragMoved = false;
  private following = false;
  private lastPet = { x: -1, y: -1, loc: '' };

  private view(): { tile: number; rows: number; camX: number; camY: number } {
    const s = this.state;
    const tile = this.canvas.width / VIEW_W || 1;
    const rows = this.canvas.height / tile;
    if (Math.abs(s.x - this.lastPet.x) > 1e-6 || Math.abs(s.y - this.lastPet.y) > 1e-6 || s.loc !== this.lastPet.loc) {
      if (s.loc !== this.lastPet.loc) this.pan = { x: 0, y: 0 };
      this.lastPet = { x: s.x, y: s.y, loc: s.loc };
      this.following = true;
    }
    const camX = clamp(s.x - VIEW_W / 2 + this.pan.x, 0, FR_W - VIEW_W);
    const camY = clamp(s.y - rows / 2 + this.pan.y, 0, FR_H - rows);
    this.pan = { x: camX - (s.x - VIEW_W / 2), y: camY - (s.y - rows / 2) };
    return { tile, rows, camX, camY };
  }

  private readonly mobSeen = new Map<number, { x: number; y: number; t: number }>();

  /** Показываемая позиция зверя с лёгким сглаживанием: мелкая дрожь позиции не мигает и не меняет порядок рисования с травой. */
  private mobShown(m: FrMob, t: number): FrMob {
    const p = this.mobSeen.get(m.id);
    if (!p || Math.hypot(m.x - p.x, m.y - p.y) > 3) {
      this.mobSeen.set(m.id, { x: m.x, y: m.y, t });
      return m;
    }
    const k = 1 - Math.exp(-Math.max(0, Math.min(100, t - p.t)) / 90);
    p.x += (m.x - p.x) * k;
    p.y += (m.y - p.y) * k;
    p.t = t;
    return { ...m, x: p.x, y: p.y };
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
          const isLand = (nx: number, ny: number): boolean => nx >= 0 && ny >= 0 && nx < FR_W && ny < FR_H && s.tiles[frIndex(nx, ny)] !== 'water';
          drawWater(ctx, px, py, size, t, x, y, {
            n: isLand(x, y - 1),
            e: isLand(x + 1, y),
            s: isLand(x, y + 1),
            w: isLand(x - 1, y),
            nw: isLand(x - 1, y - 1),
            ne: isLand(x + 1, y - 1),
            se: isLand(x + 1, y + 1),
            sw: isLand(x - 1, y + 1),
          }, groundTile(s.loc === 'cave' ? 'cave' : 'meadow', x, y));
        } else {
          const gt = groundTile(s.loc === 'cave' ? 'cave' : 'meadow', x, y);
          if (gt) ctx.drawImage(gt, px, py, size, size);
          else {
            ctx.fillStyle = s.loc === 'cave' ? ((x + y) % 2 ? '#8a847a' : '#837d73') : (x + y) % 2 ? '#7cc56b' : '#76bd65';
            ctx.fillRect(px, py, size, size);
          }
        }
      }
    }

    if (this.placing) {
      for (const i of frPlaceSpots(s, this.placing.id)) {
        const px = Math.floor(sx(i % FR_W));
        const py = Math.floor(sy(Math.floor(i / FR_W)));
        ctx.fillStyle = i === this.placing.cell ? 'rgba(255,255,120,0.6)' : 'rgba(60,220,80,0.5)';
        ctx.fillRect(px + 1, py + 1, Math.ceil(tile) - 2, Math.ceil(tile) - 2);
      }
      if (this.placing.cell !== null) {
        const draw = this.placing.id === 'loom' ? drawLoom : this.placing.id === 'trap' ? drawTrap : this.placing.id === 'foundry' ? drawFoundry : this.placing.id === 'dryer' ? drawDryer : this.placing.id === 'lighthouse' ? drawLighthouse : this.placing.id === 'campfire' ? drawCampGhost : drawChest;
        draw(ctx, sx((this.placing.cell % FR_W) + 0.5), sy(Math.floor(this.placing.cell / FR_W) + 0.5), tile);
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
        if (kind === 'tree') {
          // Если питомец зашёл за дерево, оно становится полупрозрачным, чтобы его было видно.
          const behind = Math.abs(s.x - (x + 0.5)) < 0.75 && s.y > y - 1.2 && s.y < y + 0.9;
          items.push({
            y: y + 0.9,
            draw: () => {
              ctx.globalAlpha = behind ? 0.45 : 1;
              if (!drawSprite(ctx, 'tree', cellHash(x, y, 1) % natureCount('tree'), cx, sy(y + 1) + tile * 0.05, { h: tile * 1.75 })) drawTree(ctx, cx, sy(y + 1), tile);
              ctx.globalAlpha = 1;
            },
          });
        }
        else if (kind === 'bush') items.push({ y: y + 0.8, draw: () => drawBush(ctx, cx, cy, tile, s.berries.includes(i), cellHash(x, y, 7)) });
        else if (kind === 'tall') items.push({ y: y + 0.55, draw: () => { if (!drawSprite(ctx, 'grass', cellHash(x, y, 4) % natureCount('grass'), cx, cy + tile * 0.42, { w: tile * 0.9 }, Math.sin(t / 650 + x * 1.7 + y) * tile * 0.07)) drawTall(ctx, cx, cy, tile, i, t); } });
        else if (kind === 'rock' && s.loc === 'cave') items.push({ y: y - 0.5, draw: () => { if (!drawSprite(ctx, 'cavewall', cellHash(x, y, 5) % natureCount('cavewall'), cx, cy + tile / 2, { w: tile + 1 })) drawWall(ctx, cx, cy, tile, false); } });
        else if (kind === 'ore') items.push({ y: y + 0.6, draw: () => { if (!drawSprite(ctx, 'ore', cellHash(x, y, 3) % natureCount('ore'), cx, cy + tile * 0.46, { w: tile * 1.02 })) drawWall(ctx, cx, cy, tile, true); } });
        // Табличка перехода крупная и рисуется поверх деревьев, чтобы её было видно у края карты.
        else if (kind === 'exit') items.push({ y: y + 3, draw: () => drawExit(ctx, cx, cy - tile * 0.2, tile * 1.5, s.loc, frExitAt(s, i)?.to ?? 'home', t) });
        else if (kind === 'reed') items.push({ y: y + 0.55, draw: () => drawReed(ctx, cx, cy, tile, i, t) });
        else if (kind === 'rock') items.push({ y: y + 0.7, draw: () => { if (!drawSprite(ctx, 'rock', cellHash(x, y, 2) % natureCount('rock'), cx, cy + tile * 0.44, { w: tile * 1.05 })) drawRock(ctx, cx, cy, tile); } });
        else if (kind === 'chest') items.push({ y: y + 0.7, draw: () => drawChest(ctx, cx, cy, tile) });
        else if (kind === 'loom') items.push({ y: y + 0.7, draw: () => drawLoom(ctx, cx, cy, tile) });
        else if (kind === 'lighthouse') items.push({ y: y + 0.7, draw: () => drawLighthouse(ctx, cx, cy, tile, (s.count.beacon ?? 0) > 0 && frIsNight(s)) });
        else if (kind === 'dryer') items.push({ y: y + 0.7, draw: () => drawDryer(ctx, cx, cy, tile) });
        else if (kind === 'ruins' && s.tiles[i - 1] !== 'ruins' && s.tiles[i - FR_W] !== 'ruins') items.push({ y: y + 1.7, draw: () => drawRuins(ctx, cx + tile / 2, cy + tile / 2, tile * 2) });
        else if (kind === 'foundry') items.push({ y: y + 0.7, draw: () => drawFoundry(ctx, cx, cy, tile) });
        else if (kind === 'trap' || kind === 'trapfull') items.push({ y: y + 0.2, draw: () => drawTrap(ctx, cx, cy, tile, kind === 'trapfull') });
        else if (kind === 'pit') items.push({ y: y + 0.7, draw: () => drawPit(ctx, cx, cy, tile, s.fire > 0, t) });
        const d = drops.get(i);
        if (d) items.push({ y: y + 0.4, draw: () => drawItem(ctx, d.kind, cx, cy, tile * 0.7, t, d.id) });
      }
    }
    for (const m of s.mobs) {
      const sm = this.mobShown(m, t);
      items.push({ y: sm.y + 0.3, draw: () => drawMob(ctx, sm, sx(sm.x), sy(sm.y), tile, t) });
    }
    items.push({ y: s.y + 0.2, draw: () => this.drawPetAt(ctx, sx(s.x), sy(s.y) + tile * 0.35, tile, t) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    this.drawWeather(ctx, sx, sy, tile, t);
    this.drawDarkness(ctx, sx, sy, tile, t);
    this.drawLabels(ctx, sx, sy, tile, drops);
  }

  /** Оружие в руках летает рядом с питомцем, при ударе делает выпад в сторону зверя; со вставленным камнем светится. */
  private drawHeld(ctx: CanvasRenderingContext2D, cx: number, feet: number, tile: number, t: number): void {
    const s = this.state;
    const w = frWeaponStats(s).item;
    if (!w || s.sleeping || s.over) return;
    const f = s.facing < 0 ? -1 : 1;
    const bx = cx - f * tile * 0.62;
    const by = feet - tile * 0.95 + Math.sin(t / 330) * tile * 0.06;
    let x = bx;
    let y = by;
    let rot = -0.35 * f;
    const dur = 280;
    const sw = this.swing;
    let spark: { x: number; y: number; a: number } | null = null;
    if (sw && t >= sw.at && t - sw.at < dur) {
      const p = (t - sw.at) / dur;
      const k = Math.sin(Math.PI * Math.min(1, p * 1.1));
      const tx = cx + sw.dx * tile;
      const ty = feet - tile * 0.45 + sw.dy * tile;
      x = bx + (tx - bx) * k * 0.9;
      y = by + (ty - by) * k * 0.9;
      rot = f * (-0.9 + 2.2 * p);
      if (p > 0.35 && p < 0.8) spark = { x: tx, y: ty, a: 1 - Math.abs(p - 0.55) / 0.25 };
    }
    const size = tile * 0.62;
    if (s.up[w]) {
      const a = 0.4 + 0.2 * Math.sin(t / 260);
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 0.85);
      g.addColorStop(0, `rgba(150,235,255,${a})`);
      g.addColorStop(1, 'rgba(150,235,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (f < 0) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    drawIcon(ctx, `item-${w}`, 0, 0, size);
    ctx.restore();
    if (s.up[w]) {
      ctx.fillStyle = '#e8fbff';
      for (let k = 0; k < 2; k++) {
        const ang = t / 420 + k * Math.PI;
        const px = x + Math.cos(ang) * size * 0.55;
        const py = y + Math.sin(ang) * size * 0.45;
        const r = tile * 0.028 * (1 + 0.5 * Math.sin(t / 150 + k));
        ctx.fillRect(px - r, py - r * 3, r * 2, r * 6);
        ctx.fillRect(px - r * 3, py - r, r * 6, r * 2);
      }
    }
    if (spark) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, spark.a);
      ctx.fillStyle = '#fff6c8';
      const r = tile * 0.07;
      ctx.fillRect(spark.x - r, spark.y - r * 4, r * 2, r * 8);
      ctx.fillRect(spark.x - r * 4, spark.y - r, r * 8, r * 2);
      ctx.restore();
    }
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
    this.drawHeld(ctx, cx, feet, tile, t);
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

  /** Шалаш и лежанка вокруг костра, затем дождь. */
  private drawWeather(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number, tile: number, t: number): void {
    const s = this.state;
    const c = frCenter();
    if (s.shelter > 0) {
      const x0 = sx(c.x - 1);
      const y0 = sy(c.y - 1);
      const w = tile * 3;
      if (s.bed) {
        const b = frBedCell();
        const bx = sx(b.x);
        const by = sy(b.y);
        if (!drawIcon(ctx, 'item-bed', bx + tile / 2, by + tile / 2, tile * 0.95)) {
          ctx.fillStyle = '#c9544d';
          ctx.fillRect(bx + tile * 0.1, by + tile * 0.3, tile * 0.8, tile * 0.5);
        }
      }
      // Шалаш над 3x3 клетками; когда питомец внутри или рядом (в клетке от него), он становится полупрозрачным.
      // Прозрачным шалаш становится уже за клетку до него.
      const inside = s.x >= c.x - 2 && s.x < c.x + 3 && s.y >= c.y - 2 && s.y < c.y + 3;
      this.hutAlpha += ((inside ? 0.28 : 1) - this.hutAlpha) * 0.15;
      const size = tile * 3.95;
      ctx.save();
      ctx.globalAlpha = this.hutAlpha * (s.shelter / FR_SHELTER_RAINS > 0.3 ? 1 : 0.85);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.ellipse(x0 + w / 2, y0 + w + tile * 0.05, w * 0.52, tile * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.imageSmoothingEnabled = false;
      if (!drawIcon(ctx, 'hut', x0 + w / 2, y0 + w + tile * 0.1 - size / 2, size)) {
        ctx.fillStyle = 'rgba(236,222,186,0.5)';
        ctx.fillRect(x0, y0, w, w);
      }
      ctx.restore();
    }
    if (frRainHere(s)) {
      const W = this.canvas.width;
      const H = this.canvas.height;
      ctx.fillStyle = 'rgba(40,60,90,0.18)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(200,225,255,0.65)';
      ctx.lineWidth = Math.max(1, tile * 0.04);
      ctx.beginPath();
      const n = 70;
      for (let k = 0; k < n; k++) {
        const px = ((k * 97.13) % 1) * W + ((k * 53) % W);
        const x = px % W;
        const y = (((k * 211) % H) + t * 0.9) % H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - tile * 0.12, y + tile * 0.4);
      }
      ctx.stroke();
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
    const c = frCenter(s);
    const fx = sx(c.x + 0.5);
    const fy = sy(c.y + 0.5);
    if (s.fire > 0) {
      // Тёплый отсвет огня.
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, frFireRadius(s) * tile);
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
    if (s.fire > 0) hole(fx, fy, frFireRadius(s) * tile * (1 + Math.sin(t / 130) * 0.03), 1);
    if (s.torch > 0) hole(sx(s.x), sy(s.y), tile * (s.torchMax > FR_TORCH_MS ? 4.2 : 3) * (1 + Math.sin(t / 110) * 0.04), 0.95);
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
        if (d) labels.push({ x, y, text: `${GAMES_TEXT.forestItems[d.kind] ?? d.kind}${(d.n ?? 1) > 1 ? ` x${d.n}` : ''}` });
        else if (kind === 'bush' && s.berries.includes(i)) labels.push({ x, y, text: GAMES_TEXT.forestPlaces.bush ?? '' });
        else if (kind === 'rock' && s.loc !== 'cave') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.rock ?? '' });
        else if (kind === 'ore') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.ore ?? '' });
        else if (kind === 'exit') labels.push({ x, y, text: GAMES_TEXT.forestPlaces[`exit_${frExitAt(s, i)?.to ?? 'home'}`] ?? '' });
        else if (kind === 'ruins' && s.tiles[i - 1] !== 'ruins' && s.tiles[i - FR_W] !== 'ruins') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.ruins ?? '' });
        else if (kind === 'lighthouse') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.lighthouse ?? '' });
        else if (kind === 'dryer') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.dryer ?? '' });
        else if (kind === 'foundry') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.foundry ?? '' });
        else if (kind === 'trapfull') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.trapfull ?? '' });
        else if (kind === 'loom') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.loom ?? '' });
        else if (kind === 'chest') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.chest ?? '' });
        else if (kind === 'pit') labels.push({ x, y, text: GAMES_TEXT.forestPlaces[s.fire > 0 ? 'fire' : 'pit'] ?? '' });
        else if (kind === 'water') {
          const dist = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
          if (!water || dist < water.d) water = { x, y, d: dist };
        }
      }
    }
    if (water) labels.push({ x: water.x, y: water.y, text: (s.loc === 'cave' ? GAMES_TEXT.forestPlaces.cavewater : GAMES_TEXT.forestPlaces.water) ?? '' });
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

interface Shore {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
  nw: boolean;
  ne: boolean;
  se: boolean;
  sw: boolean;
}

/** Клетка воды с берегом: песок и белая пена, внешние и внутренние углы закруглены. */
export function drawWater(ctx: CanvasRenderingContext2D, px: number, py: number, size: number, t: number, x: number, y: number, L: Shore, ground: HTMLCanvasElement | null): void {
  const sand = Math.max(2, size * 0.2);
  const foam = Math.max(1.5, size * 0.07);
  const R = size * 0.42;
  const anyLand = L.n || L.e || L.s || L.w || L.nw || L.ne || L.se || L.sw;
  if (!anyLand) {
    ctx.fillStyle = '#5aaef0';
    ctx.fillRect(px, py, size, size);
  } else {
    // Под водой — земля: она видна в закруглённых углах.
    if (ground) ctx.drawImage(ground, px, py, size, size);
    else {
      ctx.fillStyle = '#7cc56b';
      ctx.fillRect(px, py, size, size);
    }
    // Песчаная форма клетки: углы, где суша с двух сторон, скруглены.
    const rNW = L.n && L.w ? R : 0;
    const rNE = L.n && L.e ? R : 0;
    const rSE = L.s && L.e ? R : 0;
    const rSW = L.s && L.w ? R : 0;
    const shape = (x0: number, y0: number, x1: number, y1: number, k: number): void => {
      const r = (v: number): number => Math.max(0, v - k);
      ctx.beginPath();
      ctx.moveTo(x0 + r(rNW), y0);
      ctx.lineTo(x1 - r(rNE), y0);
      if (rNE) ctx.arc(x1 - r(rNE), y0 + r(rNE), r(rNE), -Math.PI / 2, 0);
      ctx.lineTo(x1, y1 - r(rSE));
      if (rSE) ctx.arc(x1 - r(rSE), y1 - r(rSE), r(rSE), 0, Math.PI / 2);
      ctx.lineTo(x0 + r(rSW), y1);
      if (rSW) ctx.arc(x0 + r(rSW), y1 - r(rSW), r(rSW), Math.PI / 2, Math.PI);
      ctx.lineTo(x0, y0 + r(rNW));
      if (rNW) ctx.arc(x0 + r(rNW), y0 + r(rNW), r(rNW), Math.PI, Math.PI * 1.5);
      ctx.closePath();
    };
    ctx.fillStyle = '#ecd9a0';
    shape(px, py, px + size, py + size, 0);
    ctx.fill();
    // Вода внутри песка.
    const wx0 = px + (L.w ? sand : 0);
    const wy0 = py + (L.n ? sand : 0);
    const wx1 = px + size - (L.e ? sand : 0);
    const wy1 = py + size - (L.s ? sand : 0);
    ctx.save();
    shape(wx0, wy0, wx1, wy1, sand);
    ctx.fillStyle = '#5aaef0';
    ctx.fill();
    ctx.clip();
    // Внутренние углы: суша заходит в угол клетки воды, у неё свой песчаный ободок.
    const notch = (cx: number, cy: number): void => {
      ctx.fillStyle = '#ecd9a0';
      ctx.beginPath();
      ctx.arc(cx, cy, sand, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = foam;
      ctx.beginPath();
      ctx.arc(cx, cy, sand + foam / 2, 0, Math.PI * 2);
      ctx.stroke();
    };
    if (L.nw && !L.n && !L.w) notch(px, py);
    if (L.ne && !L.n && !L.e) notch(px + size, py);
    if (L.se && !L.s && !L.e) notch(px + size, py + size);
    if (L.sw && !L.s && !L.w) notch(px, py + size);
    ctx.restore();
    // Пена вдоль берега.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = foam;
    ctx.lineCap = 'butt';
    const line = (ax: number, ay: number, bx: number, by: number): void => {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };
    const f = foam / 2;
    const cr = (v: number): number => Math.max(0, v - sand);
    if (L.n) line(wx0 + cr(rNW), wy0 + f, wx1 - cr(rNE), wy0 + f);
    if (L.s) line(wx0 + cr(rSW), wy1 - f, wx1 - cr(rSE), wy1 - f);
    if (L.w) line(wx0 + f, wy0 + cr(rNW), wx0 + f, wy1 - cr(rSW));
    if (L.e) line(wx1 - f, wy0 + cr(rNE), wx1 - f, wy1 - cr(rSE));
    const arc = (cx: number, cy: number, rr: number, a0: number, a1: number): void => {
      if (rr <= 0) return;
      ctx.beginPath();
      ctx.arc(cx, cy, rr - f, a0, a1);
      ctx.stroke();
    };
    if (rNE) arc(wx1 - cr(rNE), wy0 + cr(rNE), cr(rNE), -Math.PI / 2, 0);
    if (rSE) arc(wx1 - cr(rSE), wy1 - cr(rSE), cr(rSE), 0, Math.PI / 2);
    if (rSW) arc(wx0 + cr(rSW), wy1 - cr(rSW), cr(rSW), Math.PI / 2, Math.PI);
    if (rNW) arc(wx0 + cr(rNW), wy0 + cr(rNW), cr(rNW), Math.PI, Math.PI * 1.5);
  }
  // Лёгкая рябь только в открытой воде.
  if (!(L.n || L.e || L.s || L.w)) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, size * 0.06);
    const wave = Math.sin(t / 600 + x * 1.3 + y * 0.7) * size * 0.1;
    ctx.beginPath();
    ctx.moveTo(px + size * 0.2 + wave, py + size * 0.4);
    ctx.lineTo(px + size * 0.5 + wave, py + size * 0.4);
    ctx.stroke();
  }
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

function drawBush(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, berries: boolean, v = 0): void {
  if (drawSprite(ctx, berries ? 'berrybush' : 'bush', v, cx, cy + tile * 0.42, { w: tile * 0.95 })) return;
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

function drawTall(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, i: number, t: number): void {
  ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const h = (i * 31 + k * 17) % 100;
    const bx = cx + ((((h * 7) % 100) / 100) - 0.5) * tile * 0.8;
    const by = cy + ((((h * 13) % 100) / 100) - 0.2) * tile * 0.5;
    const len = tile * (0.28 + (h % 20) / 100);
    const sway = Math.sin(t / 700 + i + k) * tile * 0.03 + (((h % 7) - 3) / 3) * tile * 0.06;
    ctx.strokeStyle = k % 2 ? '#3f8f45' : '#2f7a3a';
    ctx.lineWidth = Math.max(2, tile * 0.07);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + sway * 0.4, by - len * 0.6, bx + sway, by - len);
    ctx.stroke();
  }
}

function drawRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
  outline(ctx, tile);
  ctx.fillStyle = '#8b9199';
  ctx.beginPath();
  ctx.moveTo(cx - tile * 0.42, cy + tile * 0.22);
  ctx.lineTo(cx - tile * 0.3, cy - tile * 0.12);
  ctx.lineTo(cx - tile * 0.05, cy - tile * 0.34);
  ctx.lineTo(cx + tile * 0.26, cy - tile * 0.2);
  ctx.lineTo(cx + tile * 0.42, cy + tile * 0.08);
  ctx.lineTo(cx + tile * 0.34, cy + tile * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b4bac1';
  ctx.beginPath();
  ctx.moveTo(cx - tile * 0.22, cy - tile * 0.08);
  ctx.lineTo(cx - tile * 0.04, cy - tile * 0.26);
  ctx.lineTo(cx + tile * 0.14, cy - tile * 0.16);
  ctx.lineTo(cx - tile * 0.04, cy - tile * 0.02);
  ctx.closePath();
  ctx.fill();
}

function drawTrap(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, full = false): void {
  if (drawSprite(ctx, 'trap', 0, cx, cy + tile * 0.4, { w: tile * 0.8 })) {
    if (full) {
      ctx.fillStyle = '#d96c6c';
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3b2a1e';
      ctx.lineWidth = Math.max(1, tile * 0.04);
      ctx.stroke();
    }
    return;
  }
  const w = tile * 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(cx - w / 2, cy - w / 2, w, w);
  ctx.strokeStyle = '#7a4d2b';
  ctx.lineWidth = Math.max(2, tile * 0.08);
  ctx.strokeRect(cx - w / 2, cy - w / 2, w, w);
  ctx.strokeStyle = '#e9d9b6';
  ctx.lineWidth = Math.max(1, tile * 0.04);
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + (k * w) / 4, cy - w / 2);
    ctx.lineTo(cx - w / 2 + (k * w) / 4, cy + w / 2);
    ctx.moveTo(cx - w / 2, cy - w / 2 + (k * w) / 4);
    ctx.lineTo(cx + w / 2, cy - w / 2 + (k * w) / 4);
    ctx.stroke();
  }
  if (full) {
    ctx.fillStyle = '#d96c6c';
    ctx.beginPath();
    ctx.arc(cx, cy, tile * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b2a1e';
    ctx.lineWidth = Math.max(1, tile * 0.05);
    ctx.stroke();
  }
}

const mobFace = new Map<number, { x: number; face: number }>();
const MOB_LEFT: ReadonlySet<string> = new Set(['mouse']);

/** Мышь, кролик, волк и летучая мышь — картинки, если загрузились, иначе кодом; у раненого над головой полоска здоровья. */
function drawMob(ctx: CanvasRenderingContext2D, m: FrMob, x: number, y: number, tile: number, t: number): void {
  const bob = Math.sin(t / 120 + m.id) * tile * 0.03;
  const k = m.kind;
  // Поворот только при настоящем движении (порог), иначе мелкие подёргивания разворачивают зверя каждый кадр.
  const fs = mobFace.get(m.id) ?? { x: m.x, face: 1 };
  const dx = m.x - fs.x;
  if (Math.abs(dx) > 0.2) {
    fs.face = dx > 0 ? 1 : -1;
    fs.x = m.x;
  } else if (Math.sign(dx) === fs.face) fs.x = m.x;
  mobFace.set(m.id, fs);
  const face = fs.face;
  const hpBar = (top: number): void => {
    if (m.hp >= FR_MOBS[k].hp) return;
    const w = tile * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - w / 2, y - tile * top, w, 5);
    ctx.fillStyle = '#e0443e';
    ctx.fillRect(x - w / 2, y - tile * top, (w * Math.max(0, m.hp)) / FR_MOBS[k].hp, 5);
  };
  if (k === 'bat') {
    const flap = Math.sin(t / 70 + m.id) * 0.5;
    ctx.save();
    ctx.translate(x, y - tile * 0.25 + bob * 3);
    ctx.scale(1, 1 + flap * 0.35);
    const ok = drawSprite(ctx, 'bat', 0, 0, tile * 0.2, { w: tile * 0.75 });
    ctx.restore();
    if (ok) {
      hpBar(0.7);
      return;
    }
  } else {
    const w = tile * (k === 'alpha' ? 1.5 : k === 'wolf' ? 1.2 : k === 'rabbit' ? 0.75 : 0.6);
    ctx.save();
    ctx.translate(x, y + tile * 0.3 + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, -tile * 0.02, w * 0.38, tile * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.scale(MOB_LEFT.has(k) ? -face : face, 1);
    const ok = drawSprite(ctx, k, 0, 0, 0, { w });
    ctx.restore();
    if (ok) {
      hpBar(k === 'alpha' ? 1.05 : k === 'wolf' ? 0.75 : 0.55);
      return;
    }
  }
  if (k === 'bat') {
    const flap = Math.sin(t / 70 + m.id) * 0.5;
    ctx.save();
    ctx.translate(x, y - tile * 0.25 + bob * 3);
    ctx.fillStyle = '#4b3f5c';
    ctx.strokeStyle = '#1d1726';
    ctx.lineWidth = Math.max(1.5, tile * 0.04);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dir * tile * 0.3, -tile * (0.25 + flap * 0.3), dir * tile * 0.42, tile * (0.02 - flap * 0.1));
      ctx.quadraticCurveTo(dir * tile * 0.22, tile * 0.08, 0, tile * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, tile * 0.03, tile * 0.11, tile * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = m.angry ? '#e0443e' : '#f2e27a';
    ctx.fillRect(-tile * 0.06, 0, Math.max(2, tile * 0.04), Math.max(2, tile * 0.04));
    ctx.fillRect(tile * 0.03, 0, Math.max(2, tile * 0.04), Math.max(2, tile * 0.04));
    ctx.restore();
    if (m.hp < FR_MOBS[k].hp) {
      const w = tile * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - w / 2, y - tile * 0.7, w, 5);
      ctx.fillStyle = '#e0443e';
      ctx.fillRect(x - w / 2, y - tile * 0.7, (w * Math.max(0, m.hp)) / FR_MOBS[k].hp, 5);
    }
    return;
  }
  const s = k === 'alpha' ? 1.25 : k === 'wolf' ? 0.95 : k === 'rabbit' ? 0.7 : 0.5;
  ctx.save();
  ctx.translate(x, y + tile * 0.2 + bob);
  ctx.strokeStyle = '#3b2a1e';
  ctx.lineWidth = Math.max(1.5, tile * 0.05);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, tile * 0.12, tile * 0.3 * s + 2, tile * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = k === 'alpha' ? '#f0f2f8' : k === 'wolf' ? '#7d828c' : k === 'rabbit' ? '#f2ebe0' : '#a88f7a';
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -tile * 0.15 * s, tile * 0.36 * s, tile * 0.25 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // голова
  ctx.beginPath();
  ctx.arc(tile * 0.3 * s, -tile * 0.28 * s, tile * 0.19 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // уши
  ctx.fillStyle = body;
  if (k === 'rabbit') {
    ctx.fillRect(tile * 0.22 * s, -tile * 0.75 * s, tile * 0.08 * s, tile * 0.38 * s);
    ctx.fillRect(tile * 0.36 * s, -tile * 0.75 * s, tile * 0.08 * s, tile * 0.38 * s);
  } else {
    ctx.beginPath();
    ctx.moveTo(tile * 0.2 * s, -tile * 0.4 * s);
    ctx.lineTo(tile * 0.26 * s, -tile * (k === 'wolf' || k === 'alpha' ? 0.68 : 0.55) * s);
    ctx.lineTo(tile * 0.34 * s, -tile * 0.42 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // хвост
  ctx.strokeStyle = k === 'mouse' ? '#d9a0a0' : '#3b2a1e';
  ctx.beginPath();
  ctx.moveTo(-tile * 0.34 * s, -tile * 0.15 * s);
  ctx.quadraticCurveTo(-tile * 0.55 * s, -tile * 0.3 * s, -tile * 0.5 * s, -tile * 0.05 * s);
  ctx.stroke();
  // глаз
  ctx.fillStyle = m.angry || m.provoked ? '#e0443e' : '#222';
  ctx.fillRect(tile * 0.36 * s, -tile * 0.32 * s, Math.max(2, tile * 0.05), Math.max(2, tile * 0.05));
  ctx.restore();
  if (m.hp < FR_MOBS[k].hp) {
    const w = tile * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - w / 2, y - tile * (k === 'alpha' ? 1.05 : k === 'wolf' ? 0.75 : 0.55), w, 5);
    ctx.fillStyle = '#e0443e';
    ctx.fillRect(x - w / 2, y - tile * (k === 'alpha' ? 1.05 : k === 'wolf' ? 0.75 : 0.55), (w * Math.max(0, m.hp)) / FR_MOBS[k].hp, 5);
  }
}

/** Стена пещеры; с рудой — с оранжевыми вкраплениями. */
function drawWall(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, ore: boolean): void {
  const x = cx - tile / 2;
  const y = cy - tile / 2;
  ctx.fillStyle = '#4b463f';
  ctx.fillRect(x, y, tile + 1, tile + 1);
  ctx.fillStyle = '#5c564d';
  ctx.fillRect(x + tile * 0.08, y + tile * 0.08, tile * 0.84, tile * 0.3);
  if (ore) {
    ctx.fillStyle = '#e8a23c';
    for (const [a, b] of [[0.25, 0.55], [0.55, 0.45], [0.7, 0.72], [0.35, 0.8]] as const) ctx.fillRect(x + a * tile, y + b * tile, tile * 0.16, tile * 0.16);
  }
}

function drawReed(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, seed: number, t: number): void {
  if (drawSprite(ctx, 'reed', Math.abs(seed), cx, cy + tile * 0.42, { h: tile * 0.95 }, Math.sin(t / 700 + seed) * tile * 0.04)) return;
  ctx.strokeStyle = '#3f7d3a';
  ctx.lineWidth = Math.max(2, tile * 0.07);
  for (let k = 0; k < 4; k++) {
    const bx = cx + (k - 1.5) * tile * 0.2;
    const sway = Math.sin(t / 700 + seed + k) * tile * 0.04;
    ctx.beginPath();
    ctx.moveTo(bx, cy + tile * 0.35);
    ctx.lineTo(bx + sway, cy - tile * (0.2 + (k % 2) * 0.12));
    ctx.stroke();
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(bx + sway - tile * 0.04, cy - tile * (0.32 + (k % 2) * 0.12), tile * 0.08, tile * 0.14);
  }
}

/** Выход: табличка со стрелкой; дома две, в походе одна обратно. */
function drawExit(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, loc: FrPlace, to: FrPlace, t: number): void {
  ctx.fillStyle = '#7a4d2b';
  ctx.fillRect(cx - tile * 0.05, cy - tile * 0.1, tile * 0.1, tile * 0.5);
  ctx.fillStyle = '#e9d9b6';
  ctx.fillRect(cx - tile * 0.32, cy - tile * 0.42, tile * 0.64, tile * 0.34);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, tile * 0.05);
  ctx.strokeRect(cx - tile * 0.32, cy - tile * 0.42, tile * 0.64, tile * 0.34);
  ctx.fillStyle = to === 'home' ? '#4a8f3d' : to === 'lake' ? '#3b86d1' : '#8a5a2b';
  ctx.font = `bold ${Math.round(tile * 0.26)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(to === 'home' ? '⌂' : to === 'lake' ? '≈' : '▲', cx, cy - tile * 0.25 + Math.sin(t / 400) * tile * 0.02);
  void loc;
}

function drawRuins(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, tile * 0.05);
  ctx.fillStyle = '#bdb5a6';
  ctx.beginPath();
  ctx.moveTo(cx - tile * 0.36, cy + tile * 0.4);
  ctx.lineTo(cx - tile * 0.3, cy - tile * 0.2);
  ctx.lineTo(cx - tile * 0.12, cy - tile * 0.05);
  ctx.lineTo(cx + tile * 0.02, cy - tile * 0.45);
  ctx.lineTo(cx + tile * 0.2, cy - tile * 0.1);
  ctx.lineTo(cx + tile * 0.36, cy + tile * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8f887a';
  ctx.fillRect(cx - tile * 0.28, cy + tile * 0.12, tile * 0.18, tile * 0.1);
  ctx.fillRect(cx + tile * 0.02, cy + tile * 0.02, tile * 0.2, tile * 0.1);
  ctx.fillStyle = '#4b9a47';
  ctx.fillRect(cx - tile * 0.34, cy + tile * 0.32, tile * 0.7, tile * 0.08);
}

function drawLighthouse(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, lit = false): void {
  if (lit) {
    const g = ctx.createRadialGradient(cx, cy - tile * 0.6, 0, cx, cy - tile * 0.6, tile * 2.2);
    g.addColorStop(0, 'rgba(255,230,140,0.55)');
    g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - tile * 2.2, cy - tile * 2.8, tile * 4.4, tile * 4.4);
  }
  if (drawSprite(ctx, 'lighthouse', 0, cx, cy + tile * 0.45, { h: tile * 1.95 })) {
    if (lit) {
      ctx.fillStyle = 'rgba(255,240,170,0.9)';
      ctx.fillRect(cx - tile * 0.07, cy - tile * 1.18, tile * 0.14, tile * 0.12);
    }
    return;
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, tile * 0.05);
  ctx.fillStyle = '#e9e1d2';
  ctx.beginPath();
  ctx.moveTo(cx - tile * 0.34, cy + tile * 0.4);
  ctx.lineTo(cx - tile * 0.2, cy - tile * 0.55);
  ctx.lineTo(cx + tile * 0.2, cy - tile * 0.55);
  ctx.lineTo(cx + tile * 0.34, cy + tile * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c85a4a';
  ctx.fillRect(cx - tile * 0.27, cy - tile * 0.15, tile * 0.54, tile * 0.16);
  ctx.fillStyle = lit ? '#fff2a8' : '#6b6560';
  ctx.fillRect(cx - tile * 0.16, cy - tile * 0.78, tile * 0.32, tile * 0.24);
  ctx.strokeRect(cx - tile * 0.16, cy - tile * 0.78, tile * 0.32, tile * 0.24);
  ctx.fillStyle = '#c85a4a';
  ctx.beginPath();
  ctx.moveTo(cx - tile * 0.22, cy - tile * 0.78);
  ctx.lineTo(cx, cy - tile * 0.98);
  ctx.lineTo(cx + tile * 0.22, cy - tile * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawDryer(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
  if (drawSprite(ctx, 'dryer', 0, cx, cy + tile * 0.42, { w: tile * 0.95 })) return;
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = Math.max(2, tile * 0.07);
  ctx.beginPath();
  ctx.moveTo(cx - tile * 0.38, cy + tile * 0.4);
  ctx.lineTo(cx - tile * 0.38, cy - tile * 0.35);
  ctx.moveTo(cx + tile * 0.38, cy + tile * 0.4);
  ctx.lineTo(cx + tile * 0.38, cy - tile * 0.35);
  ctx.moveTo(cx - tile * 0.42, cy - tile * 0.3);
  ctx.lineTo(cx + tile * 0.42, cy - tile * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#b5543a';
  for (const dx of [-0.22, 0, 0.22]) ctx.fillRect(cx + tile * dx - tile * 0.05, cy - tile * 0.28, tile * 0.1, tile * 0.38);
}

function drawFoundry(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
  if (drawSprite(ctx, 'foundry', 0, cx, cy + tile * 0.44, { w: tile * 0.9 })) return;
  const w = tile * 0.8;
  ctx.fillStyle = '#6b6560';
  ctx.fillRect(cx - w / 2, cy - tile * 0.35, w, tile * 0.7);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, tile * 0.05);
  ctx.strokeRect(cx - w / 2, cy - tile * 0.35, w, tile * 0.7);
  ctx.fillStyle = '#2b2622';
  ctx.fillRect(cx - tile * 0.2, cy - tile * 0.05, tile * 0.4, tile * 0.3);
  ctx.fillStyle = '#ff9f3b';
  ctx.fillRect(cx - tile * 0.12, cy + tile * 0.08, tile * 0.24, tile * 0.14);
  ctx.fillStyle = '#4b463f';
  ctx.fillRect(cx - tile * 0.12, cy - tile * 0.5, tile * 0.24, tile * 0.18);
}

function drawCampGhost(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
  if (drawSprite(ctx, 'campcold', 0, cx, cy + tile * 0.4, { w: tile * 1.05 })) return;
  ctx.fillStyle = '#6b6560';
  ctx.beginPath();
  ctx.arc(cx, cy + tile * 0.1, tile * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${Math.round(tile * 0.6)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔥', cx, cy);
}

function drawLoom(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
  if (drawSprite(ctx, 'loom', 0, cx, cy + tile * 0.42, { w: tile * 0.85 })) return;
  outline(ctx, tile);
  const w = tile * 0.8;
  const h = tile * 0.7;
  ctx.fillStyle = '#a0683b';
  ctx.fillRect(cx - w / 2, cy - h / 2, tile * 0.1, h);
  ctx.fillRect(cx + w / 2 - tile * 0.1, cy - h / 2, tile * 0.1, h);
  ctx.fillRect(cx - w / 2, cy - h / 2, w, tile * 0.1);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = '#f0e2c0';
  ctx.lineWidth = Math.max(1, tile * 0.04);
  for (let k = 0; k < 6; k++) {
    const x = cx - w / 2 + tile * 0.15 + (k * (w - tile * 0.3)) / 5;
    ctx.beginPath();
    ctx.moveTo(x, cy - h / 2 + tile * 0.1);
    ctx.lineTo(x, cy + h / 2 - tile * 0.1);
    ctx.stroke();
  }
  ctx.fillStyle = '#d96c6c';
  ctx.fillRect(cx - w / 2 + tile * 0.1, cy + tile * 0.05, w - tile * 0.2, tile * 0.12);
}

function drawChest(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
  if (drawSprite(ctx, 'chest', 0, cx, cy + tile * 0.36, { w: tile * 0.8 })) return;
  outline(ctx, tile);
  const w = tile * 0.7;
  const h = tile * 0.45;
  ctx.fillStyle = '#a8703c';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h * 0.2, w, h * 0.8, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c98a4b';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h * 0.7, w, h * 0.55, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd15a';
  ctx.fillRect(cx - tile * 0.05, cy - h * 0.25, tile * 0.1, tile * 0.14);
  ctx.strokeRect(cx - tile * 0.05, cy - h * 0.25, tile * 0.1, tile * 0.14);
}

function drawPit(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, lit: boolean, t: number): void {
  if (drawSprite(ctx, lit ? 'campfire' : 'campcold', 0, cx, cy + tile * 0.4, { w: tile * 1.05 })) {
    if (lit) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, tile * 1.1);
      g.addColorStop(0, `rgba(255,190,80,${0.22 + Math.sin(t / 110) * 0.05})`);
      g.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - tile * 1.1, cy - tile * 1.1, tile * 2.2, tile * 2.2);
    }
    return;
  }
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
function drawItem(ctx: CanvasRenderingContext2D, kind: FrItem, cx: number, cy: number, size: number, t: number, phase = 0): void {
  const bob = Math.sin(t / 500 + phase) * size * 0.03;
  cy += bob;
  if (kind === 'branch' || kind === 'stone' || kind === 'flint' || kind === 'mushroom') {
    if (drawIcon(ctx, kind, cx, cy, size * (kind === 'flint' ? 0.8 : 0.95), phase)) return;
  }
  if (kind === 'crystal' || kind === 'glowcap') {
    if (drawIcon(ctx, kind, cx, cy, size * 0.95, phase)) return;
  }
  if (kind === 'reed' || kind === 'grass') {
    if (drawIcon(ctx, kind === 'reed' ? 'reed' : 'grass', cx, cy, size * 0.95)) return;
  }
  if (drawIcon(ctx, `item-${kind}`, cx, cy, size * 0.95)) return;
  outline(ctx, size);
  switch (kind) {
    case 'pickaxe':
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.3, cy + size * 0.4);
      ctx.lineTo(cx + size * 0.12, cy - size * 0.2);
      ctx.stroke();
      ctx.strokeStyle = '#a0683b';
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.28, cy - size * 0.28);
      ctx.quadraticCurveTo(cx + size * 0.1, cy - size * 0.5, cx + size * 0.42, cy - size * 0.1);
      ctx.stroke();
      ctx.strokeStyle = '#b9c0c8';
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
      break;
    case 'knife':
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.38, cy + size * 0.34);
      ctx.lineTo(cx - size * 0.1, cy + size * 0.06);
      ctx.stroke();
      ctx.strokeStyle = '#a0683b';
      ctx.lineWidth = size * 0.11;
      ctx.stroke();
      ctx.fillStyle = '#d5dbe2';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.1, cy + size * 0.14);
      ctx.lineTo(cx + size * 0.38, cy - size * 0.36);
      ctx.lineTo(cx + size * 0.14, cy - size * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'axe':
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.3, cy + size * 0.38);
      ctx.lineTo(cx + size * 0.2, cy - size * 0.3);
      ctx.stroke();
      ctx.strokeStyle = '#a0683b';
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
      ctx.fillStyle = '#b9c0c8';
      ctx.beginPath();
      ctx.moveTo(cx + size * 0.05, cy - size * 0.38);
      ctx.lineTo(cx + size * 0.42, cy - size * 0.3);
      ctx.lineTo(cx + size * 0.38, cy + size * 0.02);
      ctx.lineTo(cx + size * 0.12, cy - size * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
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
    case 'torch':
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.05, cy + size * 0.4);
      ctx.lineTo(cx + size * 0.05, cy - size * 0.1);
      ctx.stroke();
      ctx.strokeStyle = '#a0683b';
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.05, cy - size * 0.25, size * 0.17, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.05, cy - size * 0.2, size * 0.08, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'flask':
    case 'fullflask':
      ctx.fillStyle = kind === 'flask' ? '#b98a52' : '#5aaef0';
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.08, size * 0.26, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8a6a3c';
      ctx.fillRect(cx - size * 0.07, cy - size * 0.32, size * 0.14, size * 0.14);
      ctx.strokeRect(cx - size * 0.07, cy - size * 0.32, size * 0.14, size * 0.14);
      if (kind === 'flask') {
        ctx.strokeStyle = '#e9d7a8';
        ctx.lineWidth = size * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.2, cy + size * 0.08);
        ctx.lineTo(cx + size * 0.2, cy + size * 0.08);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(cx - size * 0.12, cy - size * 0.02, size * 0.07, size * 0.14);
      }
      break;
    case 'egg':
      ctx.fillStyle = '#f4efe2';
      for (const dx of [-0.14, 0.14]) {
        ctx.beginPath();
        ctx.ellipse(cx + dx * size, cy + size * 0.02, size * 0.15, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#8b7a66';
      ctx.fillRect(cx - size * 0.18, cy - size * 0.05, size * 0.05, size * 0.05);
      ctx.fillRect(cx + size * 0.12, cy + size * 0.05, size * 0.05, size * 0.05);
      break;
    case 'seeds':
      ctx.fillStyle = '#c99a4a';
      for (const [dx, dy] of [[-0.18, 0.08], [0.02, 0.14], [0.18, 0], [-0.04, -0.1], [0.1, -0.16]] as const) {
        ctx.beginPath();
        ctx.ellipse(cx + dx * size, cy + dy * size, size * 0.09, size * 0.06, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'friedegg':
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.04, size * 0.36, size * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath();
      ctx.arc(cx - size * 0.04, cy, size * 0.13, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'tea':
    case 'compote':
    case 'porridge':
    case 'berryporridge': {
      const liquid = { tea: '#8cc66a', compote: '#d9455a', porridge: '#f2dca0', berryporridge: '#f2dca0' }[kind];
      ctx.fillStyle = '#d9cbb0';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.34, cy - size * 0.05);
      ctx.lineTo(cx + size * 0.34, cy - size * 0.05);
      ctx.quadraticCurveTo(cx + size * 0.3, cy + size * 0.34, cx, cy + size * 0.34);
      ctx.quadraticCurveTo(cx - size * 0.3, cy + size * 0.34, cx - size * 0.34, cy - size * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = liquid;
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.05, size * 0.3, size * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      if (kind === 'berryporridge') {
        ctx.fillStyle = '#e8505b';
        for (const dx of [-0.12, 0.02, 0.14]) {
          ctx.beginPath();
          ctx.arc(cx + dx * size, cy - size * 0.07, size * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (kind === 'tea') {
        ctx.fillStyle = '#d9cbb0';
        ctx.fillRect(cx + size * 0.32, cy, size * 0.1, size * 0.14);
        ctx.strokeRect(cx + size * 0.32, cy, size * 0.1, size * 0.14);
      }
      break;
    }
    case 'cloth':
      ctx.fillStyle = '#e9d9b6';
      ctx.fillRect(cx - size * 0.32, cy - size * 0.22, size * 0.64, size * 0.44);
      ctx.strokeRect(cx - size * 0.32, cy - size * 0.22, size * 0.64, size * 0.44);
      ctx.strokeStyle = '#c8b58a';
      ctx.lineWidth = size * 0.04;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.32, cy - size * 0.22 + (k * size * 0.44) / 4);
        ctx.lineTo(cx + size * 0.32, cy - size * 0.22 + (k * size * 0.44) / 4);
        ctx.stroke();
      }
      break;
    case 'purse':
      ctx.fillStyle = '#b8794a';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.14, cy - size * 0.25);
      ctx.quadraticCurveTo(cx - size * 0.42, cy + size * 0.05, cx - size * 0.3, cy + size * 0.3);
      ctx.lineTo(cx + size * 0.3, cy + size * 0.3);
      ctx.quadraticCurveTo(cx + size * 0.42, cy + size * 0.05, cx + size * 0.14, cy - size * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e6c06a';
      ctx.fillRect(cx - size * 0.16, cy - size * 0.3, size * 0.32, size * 0.1);
      ctx.strokeRect(cx - size * 0.16, cy - size * 0.3, size * 0.32, size * 0.1);
      break;
    case 'reed':
      ctx.fillStyle = '#6aa84f';
      ctx.fillRect(cx - size * 0.3, cy - size * 0.05, size * 0.6, size * 0.1);
      ctx.strokeRect(cx - size * 0.3, cy - size * 0.05, size * 0.6, size * 0.1);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(cx + size * 0.18, cy - size * 0.2, size * 0.1, size * 0.4);
      break;
    case 'fish':
    case 'friedfish':
      ctx.fillStyle = kind === 'fish' ? '#7fb4d9' : '#c98a4b';
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.32, size * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + size * 0.28, cy);
      ctx.lineTo(cx + size * 0.45, cy - size * 0.14);
      ctx.lineTo(cx + size * 0.45, cy + size * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'fishsoup':
      ctx.fillStyle = '#c98a4b';
      ctx.beginPath();
      ctx.arc(cx, cy + size * 0.05, size * 0.32, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9fd1e8';
      ctx.fillRect(cx - size * 0.3, cy - size * 0.02, size * 0.6, size * 0.1);
      break;
    case 'rod':
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.3, cy + size * 0.3);
      ctx.lineTo(cx + size * 0.3, cy - size * 0.3);
      ctx.lineTo(cx + size * 0.3, cy + size * 0.05);
      ctx.stroke();
      break;
    case 'ore':
      ctx.fillStyle = '#9b9488';
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.3, size * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8a23c';
      ctx.fillRect(cx - size * 0.1, cy - size * 0.1, size * 0.16, size * 0.16);
      break;
    case 'fang':
      ctx.fillStyle = '#f4efe2';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.16, cy - size * 0.3);
      ctx.quadraticCurveTo(cx + size * 0.2, cy - size * 0.2, cx + size * 0.14, cy + size * 0.1);
      ctx.lineTo(cx + size * 0.02, cy + size * 0.38);
      ctx.quadraticCurveTo(cx - size * 0.08, cy + size * 0.05, cx - size * 0.16, cy - size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'spear':
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.32, cy + size * 0.34);
      ctx.lineTo(cx + size * 0.2, cy - size * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#f4efe2';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx + size * 0.36, cy - size * 0.38);
      ctx.lineTo(cx + size * 0.08, cy - size * 0.22);
      ctx.lineTo(cx + size * 0.22, cy - size * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'crystal':
      ctx.fillStyle = '#8fd8ff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.38);
      ctx.lineTo(cx + size * 0.26, cy - size * 0.05);
      ctx.lineTo(cx + size * 0.14, cy + size * 0.34);
      ctx.lineTo(cx - size * 0.14, cy + size * 0.34);
      ctx.lineTo(cx - size * 0.26, cy - size * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8f8ff';
      ctx.fillRect(cx - size * 0.06, cy - size * 0.2, size * 0.08, size * 0.28);
      break;
    case 'lantern':
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy - size * 0.3, size * 0.14, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(cx - size * 0.2, cy - size * 0.2, size * 0.4, size * 0.08);
      ctx.fillRect(cx - size * 0.2, cy + size * 0.24, size * 0.4, size * 0.08);
      ctx.fillStyle = '#8fd8ff';
      ctx.fillRect(cx - size * 0.16, cy - size * 0.12, size * 0.32, size * 0.36);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(cx - size * 0.07, cy - size * 0.02, size * 0.14, size * 0.16);
      break;
    case 'glowcap':
      ctx.fillStyle = '#5be3d0';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy - size * 0.05, size * 0.3, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d8f7f0';
      ctx.fillRect(cx - size * 0.07, cy - size * 0.05, size * 0.14, size * 0.3);
      break;
    case 'glowsoup':
      ctx.fillStyle = '#6a625a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.32, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5be3d0';
      ctx.fillRect(cx - size * 0.28, cy - size * 0.03, size * 0.56, size * 0.07);
      break;
    case 'salt':
      ctx.fillStyle = '#f4f1ea';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.3, cy + size * 0.22);
      ctx.lineTo(cx - size * 0.18, cy - size * 0.2);
      ctx.lineTo(cx + size * 0.2, cy - size * 0.24);
      ctx.lineTo(cx + size * 0.32, cy + size * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'jerky':
    case 'driedfish':
      ctx.fillStyle = kind === 'jerky' ? '#8b3a2b' : '#c98f4e';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.34, size * 0.18, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'ingot':
      ctx.fillStyle = '#b8c2cc';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.34, cy + size * 0.2);
      ctx.lineTo(cx - size * 0.2, cy - size * 0.18);
      ctx.lineTo(cx + size * 0.34, cy - size * 0.18);
      ctx.lineTo(cx + size * 0.24, cy + size * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'ironknife':
      ctx.fillStyle = '#b8c2cc';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.05, cy + size * 0.05);
      ctx.lineTo(cx + size * 0.32, cy - size * 0.34);
      ctx.lineTo(cx + size * 0.12, cy + size * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(cx - size * 0.28, cy + size * 0.02, size * 0.28, size * 0.12);
      break;
    case 'ironaxe':
    case 'ironpick':
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = Math.max(2, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.25, cy + size * 0.32);
      ctx.lineTo(cx + size * 0.2, cy - size * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#b8c2cc';
      ctx.beginPath();
      if (kind === 'ironaxe') {
        ctx.moveTo(cx + size * 0.05, cy - size * 0.36);
        ctx.lineTo(cx + size * 0.4, cy - size * 0.2);
        ctx.lineTo(cx + size * 0.28, cy + size * 0.02);
        ctx.lineTo(cx + size * 0.18, cy - size * 0.2);
      } else {
        ctx.moveTo(cx - size * 0.12, cy - size * 0.3);
        ctx.quadraticCurveTo(cx + size * 0.2, cy - size * 0.5, cx + size * 0.45, cy - size * 0.2);
        ctx.lineTo(cx + size * 0.4, cy - size * 0.1);
        ctx.quadraticCurveTo(cx + size * 0.2, cy - size * 0.3, cx - size * 0.05, cy - size * 0.2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'meat':
    case 'steak':
      ctx.fillStyle = kind === 'meat' ? '#d96c6c' : '#a8603a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.32, size * 0.22, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f4e3c1';
      ctx.fillRect(cx + size * 0.18, cy - size * 0.26, size * 0.1, size * 0.2);
      break;
    case 'broth':
    case 'fishporridge':
    case 'meatporridge':
      ctx.fillStyle = '#c98a4b';
      ctx.beginPath();
      ctx.arc(cx, cy + size * 0.05, size * 0.32, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = kind === 'broth' ? '#e8c477' : '#d9b27a';
      ctx.fillRect(cx - size * 0.3, cy - size * 0.02, size * 0.6, size * 0.1);
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

/** Часы похода: жёлтый сектор — день, оранжевый — вечер, тёмный — ночь; стрелка — сейчас. */
function clockFace(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'fr-clock');
  svg.setAttribute('aria-hidden', 'true');
  const point = (f: number, r: number): string => {
    const a = f * Math.PI * 2 - Math.PI / 2;
    return `${(24 + Math.cos(a) * r).toFixed(2)} ${(24 + Math.sin(a) * r).toFixed(2)}`;
  };
  const sector = (from: number, to: number, color: string): string =>
    `<path d="M24 24L${point(from, 20)}A20 20 0 ${to - from > 0.5 ? 1 : 0} 1 ${point(to, 20)}Z" fill="${color}"/>`;
  const e = FR_EVENING_AT / FR_DAY_MS;
  const n = FR_NIGHT_AT / FR_DAY_MS;
  svg.innerHTML =
    `<circle cx="24" cy="24" r="22" fill="#3b2a1e"/>` +
    sector(0, e, '#ffd25e') +
    sector(e, n, '#ff9f4a') +
    sector(n, 1, '#3d3f8a') +
    `<circle cx="24" cy="24" r="20" fill="none" stroke="#3b2a1e" stroke-width="2"/>` +
    `<circle cx="${point(e / 2, 12).split(' ')[0]}" cy="${point(e / 2, 12).split(' ')[1]}" r="3.2" fill="#fff6c4" stroke="#e8a21e" stroke-width="1.2"/>` +
    `<path d="M${point((n + 1) / 2, 14)}a3.4 3.4 0 1 0 3 4.6a2.8 2.8 0 1 1 -3 -4.6z" fill="#e9e6ff"/>` +
    `<g class="fr-hand"><path d="M24 24L24 7" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><path d="M24 24L24 7" stroke="#3b2a1e" stroke-width="2.2" stroke-linecap="round"/></g>` +
    `<circle cx="24" cy="24" r="3" fill="#3b2a1e"/>`;
  return svg;
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
