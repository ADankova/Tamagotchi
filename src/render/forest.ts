import { randomSeed } from '../core/rng';
import {
  FR_DAY_MS,
  FR_EVENING_AT,
  FR_FIRE_RADIUS,
  FR_NIGHT_AT,
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
  frCookable,
  frCanCraft,
  frCraft,
  frChestPut,
  frChestTake,
  frClaim,
  frCounter,
  frQuestState,
  FR_CRAFT,
  FR_QUESTS,
  type FrQuest,
  frEat,
  frPotAdd,
  frPotCook,
  frPotRemove,
  frPotReturn,
  frRecipe,
  FR_POT_SLOTS,
  frIndex,
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
const ITEM_ORDER: readonly FrItem[] = ['branch', 'flint', 'stone', 'grass', 'berries', 'mushroom', 'cooked', 'axe', 'knife', 'pickaxe'];
const ACT_ICONS: Readonly<Record<FrAction, string>> = {
  pick: '✋',
  chop: '🪓',
  drink: '💧',
  light: '🔥',
  feed: '🪵',
  cook: '🍳',
  open: '📦',
  mine: '⛏️',
  cut: '✂️',
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
  private readonly questLine = el('button', { type: 'button', class: 'fr-quest' });
  private questKey = '';
  private readonly note = el('p', { class: 'm3-note fr-note', text: GAMES_TEXT.forestHint });
  private readonly dayChip = el('span', { class: 'q-chip fr-day' });
  private readonly clockHand: SVGElement;
  private readonly clock: SVGSVGElement;
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
      el('div', { class: 'm3-wrap fr-wrap' }, [this.canvas, this.menu, this.bag, this.overPanel]),
      this.note,
      el('div', { class: 'fr-actions' }, [bagButton, craftButton, this.sleepButton]),
    ]);
    this.canvas.addEventListener('click', (e) => this.tap(e));
    this.bag.addEventListener('click', (e) => {
      if (e.target === this.bag) this.closeBag();
    });
    if (this.state.over) this.showOver();
    this.questLine.addEventListener('click', () => this.openQuests());
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
    const fx = view.camX + ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const fy = view.camY + ((e.clientY - rect.top) / rect.height) * view.rows;
    const x = Math.floor(fx);
    const y = Math.floor(fy);
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
          this.say(GAMES_TEXT.forestQuestReady, 'snack');
          break;
        case 'questDone':
          this.host.earnTreats(ev.reward);
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
    if (ictx) drawItem(ictx, item, size / 2, size / 2 + 2, size * 0.8, 0);
    return icon;
  }

  private partText(p: { key: string; need: number }, value: number): string {
    const tpl = GAMES_TEXT.forestPart[p.key] ?? p.key;
    return `${tpl.replace('{n}', String(p.need))} (${Math.min(value, p.need)}/${p.need})`;
  }

  /** Строки пунктов задания с прогрессом. */
  private questLines(q: FrQuest): HTMLElement[] {
    return q.parts.map((p) => {
      const v = frCounter(this.state, p.key);
      return el('div', { class: v >= p.need ? 'fr-qline done' : 'fr-qline', text: this.partText(p, v) });
    });
  }

  /** Плашка слева над полем: ближайшее невыполненное задание, нажатие открывает список. */
  private updateQuestCard(): void {
    const s = this.state;
    const ready = FR_QUESTS.find((q) => frQuestState(s, q) === 'ready');
    const next = ready ?? FR_QUESTS.find((q) => q.kind === 'regular' && frQuestState(s, q) === 'progress');
    const key = next ? `${next.id}:${next.parts.map((p) => Math.min(frCounter(s, p.key), p.need)).join(',')}:${ready ? 1 : 0}` : 'done';
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

  private renderQuests(): void {
    const s = this.state;
    const order: Record<string, number> = { ready: 0, progress: 1, claimed: 2 };
    const section = (kind: FrQuest['kind'], title: string): HTMLElement => {
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
          el('div', { class: 'fr-qreward' }, [el('img', { src: this.host.treatImage, alt: '' }), el('b', { text: String(q.reward) })]),
          btn,
        ]);
      });
      return el('div', { class: 'fr-qsection' }, [el('h4', { text: title }), ...rows]);
    };
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-cook fr-quests' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestQuestsTitle }), close]),
        section('regular', GAMES_TEXT.forestRegularQ),
        section('default', GAMES_TEXT.forestDefaultQ),
      ]),
    );
  }

  private craftTab: 'tools' | 'build' = 'tools';

  /** Окно крафта: вкладки, плитки предметов с материалами; нажатие открывает подробности. */
  private renderCraft(): void {
    const s = this.state;
    const tabs = (['tools', 'build'] as const).map((tab) => {
      const b = el('button', { type: 'button', class: this.craftTab === tab ? 'fr-tab on' : 'fr-tab', text: GAMES_TEXT.forestCraftTabs[tab] });
      b.addEventListener('click', () => {
        this.craftTab = tab;
        this.renderCraft();
      });
      return b;
    });
    const recipes = FR_CRAFT.filter((r) => (r.id === 'chest') === (this.craftTab === 'build'));
    const tiles = recipes.map((r) => {
      const can = frCanCraft(s, r.id);
      const mats = r.cost.map(([it, n]) =>
        el('span', { class: (s.inv[it] ?? 0) >= n ? 'fr-mat ok' : 'fr-mat bad' }, [this.iconCanvas(it, 24), el('b', { text: String(n) })]),
      );
      const tile = el('button', { type: 'button', class: can ? 'fr-ctile can' : 'fr-ctile', 'aria-label': GAMES_TEXT.forestItems[r.id] ?? r.id }, [
        r.id === 'chest' ? el('span', { class: 'fr-chest-ico', text: '📦' }) : this.iconCanvas(r.id as FrItem, 72),
      ]);
      tile.addEventListener('click', () => this.renderCraftDetail(r.id));
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
    const owned = id === 'chest' ? (s.tiles.includes('chest') ? 1 : 0) : s.inv[id as FrItem] ?? 0;
    const mats = r.cost.map(([it, n]) =>
      el('div', { class: 'fr-dmat' }, [
        el('span', { class: 'fr-slot' }, [this.iconCanvas(it)]),
        el('b', { class: (s.inv[it] ?? 0) >= n ? 'ok' : 'bad', text: `${Math.min(s.inv[it] ?? 0, 99)}/${n}` }),
      ]),
    );
    const make = el('button', { type: 'button', class: 'chunky fr-action', text: GAMES_TEXT.forestMake });
    if (!frCanCraft(s, id) || owned > 0) make.setAttribute('disabled', '');
    make.addEventListener('click', () => {
      this.handle(frCraft(s, id));
      this.renderCraftDetail(id);
    });
    const back = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    back.addEventListener('click', () => this.renderCraft());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-card' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestCraftLevel }), back]),
        el('div', { class: 'fr-detail-icon' }, [id === 'chest' ? el('span', { class: 'fr-chest-ico', text: '📦' }) : this.iconCanvas(id as FrItem, 96)]),
        el('h3', { class: 'fr-detail-name', text: GAMES_TEXT.forestItems[id] ?? id }),
        el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestDesc[id] ?? '' }),
        el('p', { class: 'fr-card-desc', text: GAMES_TEXT.forestOwned(owned) }),
        el('div', { class: 'fr-dmats' }, mats),
        make,
      ]),
    );
  }

  /** Сундук: сверху то, что в нём, снизу рюкзак; нажатие переносит одну штуку. */
  private openChest(): void {
    this.renderChest();
    this.bag.removeAttribute('hidden');
  }

  private renderChest(): void {
    const s = this.state;
    const stacks: Array<{ item: FrItem; n: number }> = [];
    for (const item of ITEM_ORDER) {
      let n = s.chest[item] ?? 0;
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
      const slot = el('button', { type: 'button', class: 'fr-slot', 'aria-label': GAMES_TEXT.forestItems[st.item] ?? st.item }, [
        this.iconCanvas(st.item),
        ...(st.n > 1 ? [el('span', { class: 'fr-slot-count', text: String(st.n) })] : []),
      ]);
      slot.addEventListener('click', () => {
        frChestTake(s, st.item);
        this.renderChest();
      });
      cells.push(slot);
    }
    const close = el('button', { type: 'button', class: 'm3-help-button fr-x', 'aria-label': GAMES_TEXT.forestClose, text: '✕' });
    close.addEventListener('click', () => this.closeBag());
    this.bag.replaceChildren(
      el('div', { class: 'fr-bag fr-cook' }, [
        el('div', { class: 'fr-bag-head' }, [el('h3', { text: GAMES_TEXT.forestChestTitle }), close]),
        el('div', { class: 'fr-grid' }, cells),
        el('h3', { class: 'fr-sub', text: GAMES_TEXT.forestBagTitle(frSlotsUsed(s.inv), FR_SLOTS) }),
        el('div', { class: 'fr-grid' }, this.bagCells((item) => {
          frChestPut(s, item);
          this.renderChest();
        })),
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
    const result = el('span', { class: out ? 'fr-slot fr-result' : 'fr-slot empty fr-result' });
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

  /** Ячейки рюкзака: по нажатию вызывается onPick с видом предмета. */
  private bagCells(onPick: (item: FrItem) => void, enabled: (item: FrItem) => boolean = () => true): HTMLElement[] {
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
    const day = GAMES_TEXT.forestDay(s.day);
    this.clockHand.setAttribute('transform', `rotate(${((s.clock / FR_DAY_MS) * 360).toFixed(1)} 24 24)`);
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
    this.updateQuestCard();
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
        if (kind === 'tree') {
          // Если питомец зашёл за дерево, оно становится полупрозрачным, чтобы его было видно.
          const behind = Math.abs(s.x - (x + 0.5)) < 0.75 && s.y > y - 1.2 && s.y < y + 0.9;
          items.push({
            y: y + 0.9,
            draw: () => {
              ctx.globalAlpha = behind ? 0.45 : 1;
              drawTree(ctx, cx, sy(y + 1), tile);
              ctx.globalAlpha = 1;
            },
          });
        }
        else if (kind === 'bush') items.push({ y: y + 0.8, draw: () => drawBush(ctx, cx, cy, tile, s.berries.includes(i)) });
        else if (kind === 'tall') items.push({ y: y + 0.55, draw: () => drawTall(ctx, cx, cy, tile, i, t) });
        else if (kind === 'rock') items.push({ y: y + 0.7, draw: () => drawRock(ctx, cx, cy, tile) });
        else if (kind === 'chest') items.push({ y: y + 0.7, draw: () => drawChest(ctx, cx, cy, tile) });
        else if (kind === 'pit') items.push({ y: y + 0.7, draw: () => drawPit(ctx, cx, cy, tile, s.fire > 0, t) });
        const d = drops.get(i);
        if (d) items.push({ y: y + 0.4, draw: () => drawItem(ctx, d.kind, cx, cy, tile * 0.7, t, d.id) });
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
        else if (kind === 'rock') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.rock ?? '' });
        else if (kind === 'chest') labels.push({ x, y, text: GAMES_TEXT.forestPlaces.chest ?? '' });
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

function drawChest(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
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
  outline(ctx, size);
  const bob = Math.sin(t / 500 + phase) * size * 0.03;
  cy += bob;
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
