import { nextRandom } from './rng';

// «Дикий лес»: питомец выживает в лесу. Чистая логика без DOM — тестируется отдельно.
// Время в состоянии — игровые миллисекунды; тик двигает питомца, шкалы, костёр и сутки.

export const FR_W = 30;
export const FR_H = 30;
/** Игровые сутки: день, вечер, ночь (мс). */
export const FR_DAY_MS = 300_000;
export const FR_EVENING_AT = 180_000;
export const FR_NIGHT_AT = 210_000;
/** Во сне у костра время идёт во столько раз быстрее. */
export const FR_SLEEP_SPEED = 5.2;
export const FR_SLOTS = 12;
export const FR_TORCH_MS = 60_000;
const EGG_CHANCE = 0.35;
const SEED_CHANCE = 0.3;
export const FR_STACK = 10;
/** Скорость ходьбы, клеток в секунду. */
const SPEED = 3;
/** Сколько длится сбор или еда, мс. */
export const FR_ACTION_MS = 700;
/** Огонь: сколько горит после разжигания, сколько добавляет ветка, предел. */
export const FR_FIRE_START_MS = 240_000;
export const FR_FIRE_BRANCH_MS = 80_000;
export const FR_FIRE_MAX_MS = 480_000;
/** Радиус света костра, клеток. */
export const FR_FIRE_RADIUS = 3.5;
/** Лакомств за прожитую ночь. */
export const FR_NIGHT_REWARD = 2;

export type FrTile = 'grass' | 'water' | 'tree' | 'bush' | 'pit' | 'chest' | 'tall' | 'rock' | 'loom' | 'trap' | 'trapfull' | 'exit' | 'reed' | 'ore' | 'foundry' | 'dryer';
export type FrPlace = 'home' | 'lake' | 'cave';
export const FR_DRY_FIRST_MS = 150_000;
export const FR_SHELTER_RAINS = 30;
/** Сколько первых ночей дождя нет. */
export const FR_CALM_DAYS = 2;
export const FR_BED_HEAL = 3;

export interface FrPlaceState {
  tiles: FrTile[];
  drops: FrDrop[];
  berries: number[];
  mobs: FrMob[];
  fire: number;
  shelter: number;
  bed: boolean;
  pit: { x: number; y: number };
  day: number;
}

export type FrTool = 'knife' | 'axe' | 'pickaxe' | 'rod' | 'ironaxe' | 'ironpick' | 'ironknife';
export const FR_TOOL_USES = 20;
export const FR_IRON_USES = 60;
export const FISH_CHANCE = 0.55;
export function frToolUses(tool: FrTool): number {
  return tool === 'ironaxe' || tool === 'ironpick' || tool === 'ironknife' ? FR_IRON_USES : FR_TOOL_USES;
}
/** Есть ли нужный инструмент (обычный или железный). */
function hasTool(s: FrState, kind: 'axe' | 'pickaxe' | 'knife'): boolean {
  const iron = kind === 'axe' ? 'ironaxe' : kind === 'pickaxe' ? 'ironpick' : 'ironknife';
  return (s.inv[kind] ?? 0) > 0 || (s.inv[iron] ?? 0) > 0;
}
export type FrItem = 'branch' | 'stone' | 'flint' | 'grass' | 'mushroom' | 'berries' | 'cooked' | 'axe' | 'knife' | 'pickaxe' | 'torch' | 'flask' | 'fullflask' | 'egg' | 'seeds' | 'tea' | 'compote' | 'porridge' | 'berryporridge' | 'friedegg' | 'cloth' | 'purse' | 'meat' | 'steak' | 'meatporridge' | 'broth' | 'reed' | 'fish' | 'friedfish' | 'fishsoup' | 'rod' | 'ore' | 'ironaxe' | 'ironpick' | 'ironknife' | 'ingot' | 'fishporridge' | 'salt' | 'jerky' | 'driedfish';
export type FrStat = 'food' | 'water' | 'warmth' | 'health';

export interface FrDrop {
  id: number;
  kind: FrItem;
  x: number;
  y: number;
}

export interface FrState {
  v: 1;
  seed: number;
  nextId: number;
  tiles: FrTile[];
  /** Кусты, на которых сейчас есть ягоды (индексы клеток). */
  berries: number[];
  drops: FrDrop[];
  /** Положение питомца в клетках (центр клетки = целое + 0.5). */
  x: number;
  y: number;
  facing: 1 | -1;
  /** Точки, через которые питомец идёт (в клетках, дробные). */
  path: Array<[number, number]>;
  /** Что сделать, дойдя до конца пути. */
  goal: FrGoal | null;
  /** Идущее действие (сбор, еда) и сколько ему осталось. */
  busy: { kind: 'gather' | 'eat' | 'drink'; left: number } | null;
  inv: Partial<Record<FrItem, number>>;
  /** Надетые кошельки в верхних слотах рюкзака (каждый +4 ячейки). */
  worn: FrItem[];
  /** Где сейчас питомец и где в этой локации костровище. */
  loc: FrPlace;
  pit: { x: number; y: number };
  /** Остальные локации, пока питомца в них нет (время там стоит). */
  places: Partial<Record<FrPlace, FrPlaceState>>;
  /** Монстры на карте. */
  mobs: FrMob[];
  /** Кто попался в ловушку с прошлого тика (для сообщений). */
  trapNews: FrMobKind[];
  /** Кого питомец сейчас бьёт (id монстра) и перезарядка удара, мс. */
  chase: number | null;
  atkCd: number;
  /** Погода: идёт ли дождь и сколько мс (игрового времени) до смены. */
  weather: { rain: boolean; left: number };
  /** Прочность шалаша вокруг костра: сколько дождей ещё выдержит (0 — шалаша нет). */
  shelter: number;
  /** Лежанка в шалаше. */
  bed: boolean;
  /** Оставшаяся прочность инструментов (нет записи — полная). */
  dur: Partial<Record<FrTool, number>>;
  /** Сколько ещё горит факел, мс (0 — не горит). */
  torch: number;
  /** Что лежит в окошке готовки у костра (вынуто из рюкзака). */
  pot: FrItem[];
  /** Что лежит в сундуке (если он построен). */
  chest: Partial<Record<FrItem, number>>;
  /** Счётчики для заданий: срублено, приготовлено, собрано, изготовлено… (ключи — см. FR_QUESTS). */
  count: Record<string, number>;
  /** Задания, награду за которые уже забрали. */
  claimed: string[];
  /** Задания, о выполнении которых уже сообщили. */
  notified: string[];
  stats: Record<FrStat, number>;
  /** Время суток, мс от начала дня. */
  clock: number;
  day: number;
  /** Сколько ещё гореть костру, мс (0 — не горит). */
  fire: number;
  sleeping: boolean;
  /** Поход окончен: здоровье кончилось. */
  over: boolean;
  /** Лакомств заработано в этом походе. */
  treats: number;
}

export interface FrGoal {
  action: FrAction;
  cell: number;
  /** Для «собрать» с земли — какой предмет. */
  id?: number;
}

export type FrEvent =
  | { type: 'picked'; item: FrItem }
  | { type: 'full' }
  | { type: 'drank' }
  | { type: 'ate'; item: FrItem }
  | { type: 'empty' }
  | { type: 'fireLit' }
  | { type: 'fireFed' }
  | { type: 'needForFire' }
  | { type: 'needBranch' }
  | { type: 'cooked'; item: FrItem }
  | { type: 'nothingToCook' }
  | { type: 'openCook' }
  | { type: 'openChest' }
  | { type: 'openLoom' }
  | { type: 'openFoundry' }
  | { type: 'smelted' }
  | { type: 'openDryer' }
  | { type: 'dried' }
  | { type: 'campGone' }
  | { type: 'worn'; item: FrItem }
  | { type: 'noRoom' }
  | { type: 'travelAsk'; to: FrPlace }
  | { type: 'traveled'; to: FrPlace }
  | { type: 'needRod' }
  | { type: 'tooDark' }
  | { type: 'fished' }
  | { type: 'noBite' }
  | { type: 'trapped'; kind: FrMobKind }
  | { type: 'trapEmptied' }
  | { type: 'petHit'; kind: FrMobKind; dmg: number }
  | { type: 'hurt'; kind: FrMobKind; dmg: number }
  | { type: 'mobKilled'; kind: FrMobKind }
  | { type: 'mobAppeared'; kind: FrMobKind }
  | { type: 'rainStart' }
  | { type: 'rainEnd' }
  | { type: 'fireDoused' }
  | { type: 'shelterBroke' }
  | { type: 'tooWet' }
  | { type: 'spilled' }
  | { type: 'cookDropped'; item: FrItem }
  | { type: 'broke'; item: FrTool }
  | { type: 'chopped' }
  | { type: 'crafted'; item: FrCraftId | FrLoomId }
  | { type: 'needMaterials' }
  | { type: 'haveIt' }
  | { type: 'noPlace' }
  | { type: 'questReady'; id: string }
  | { type: 'questDone'; id: string; reward: number }
  | { type: 'sleepNo' }
  | { type: 'fellAsleep' }
  | { type: 'thrown'; item: FrItem }
  | { type: 'fireOut' }
  | { type: 'needAxe' }
  | { type: 'needKnife' }
  | { type: 'needFlask' }
  | { type: 'filled' }
  | { type: 'found'; item: FrItem }
  | { type: 'torchLit' }
  | { type: 'torchOut' }
  | { type: 'needPickaxe' }
  | { type: 'mined' }
  | { type: 'cut' }
  | { type: 'evening' }
  | { type: 'morning'; day: number; reward: number }
  | { type: 'woke' }
  | { type: 'low'; stat: FrStat }
  | { type: 'over' };

const BLOCKING: ReadonlySet<FrTile> = new Set(['water', 'tree', 'bush', 'pit', 'rock', 'ore']);

export const frIndex = (x: number, y: number): number => y * FR_W + x;
const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < FR_W && y < FR_H;
export const frCenter = (s?: { pit: { x: number; y: number } }): { x: number; y: number } => (s ? s.pit : { x: Math.floor(FR_W / 2), y: Math.floor(FR_H / 2) });

/** Радиус света костра: дома большой, в походе маленький. */
export function frFireRadius(s: FrState): number {
  return s.loc === 'home' ? FR_FIRE_RADIUS : FR_CAMP_RADIUS;
}
/** Во сколько раз костёр в походе горит короче домашнего. */
export const FR_CAMP_FIRE_DIV = 3;
export const FR_CAMP_RADIUS = 2.2;
function fireScale(s: FrState): number {
  return s.loc === 'home' ? 1 : 1 / FR_CAMP_FIRE_DIV;
}

/** Рядом с костром (в 8 клетках) растёт дерево: крона защищает от дождя. */
export function frTreeCover(s: FrState): boolean {
  if (!frHasPit(s)) return false;
  const c = frCenter(s);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(c.x + dx, c.y + dy) && s.tiles[frIndex(c.x + dx, c.y + dy)] === 'tree') return true;
  return false;
}

/** Идёт ли дождь там, где стоит питомец: в пещере дождя нет. */
/** Сколько ресурсов выпадет: от lo до lo+2, меньшее чаще (50% / 30% / 20%). */
export function frYield(s: FrState, key: string, lo: number): number {
  const r = rand(s.seed + 77_000 + (s.count[key] ?? 0) * 17 + (s.count.mine ?? 0) * 5 + (s.count.chop ?? 0) * 3)();
  return r < 0.5 ? lo : r < 0.8 ? lo + 1 : lo + 2;
}

export function frRainHere(s: FrState): boolean {
  return s.weather.rain && s.loc !== 'cave';
}
/** Костёр защищён от дождя: шалаш, дерево или пещера. */
export function frFireSheltered(s: FrState): boolean {
  return s.loc === 'cave' || s.shelter > 0 || frTreeCover(s);
}

/**
 * Где питомец может идти: везде, кроме воды, костровища и самого края леса.
 * Сквозь деревья, кусты и предметы он проходит.
 */
export function frPassable(s: FrState, x: number, y: number): boolean {
  if (x < 1 || y < 1 || x >= FR_W - 1 || y >= FR_H - 1) return false;
  const tile = s.tiles[frIndex(x, y)];
  return tile !== 'water' && tile !== 'pit';
}

/** Свободна ли прямая между двумя точками. */
function clearLine(s: FrState, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.1);
  for (let k = 0; k <= steps; k++) {
    const f = steps ? k / steps : 0;
    if (!frPassable(s, Math.floor(ax + (bx - ax) * f), Math.floor(ay + (by - ay) * f))) return false;
  }
  return true;
}

/** Плавный маршрут к точке (tx, ty): сначала по клеткам, потом лишние повороты срезаются. */
function route(s: FrState, tx: number, ty: number): Array<[number, number]> | null {
  const goal = frIndex(Math.floor(tx), Math.floor(ty));
  if (!frPassable(s, Math.floor(tx), Math.floor(ty))) return null;
  if (clearLine(s, s.x, s.y, tx, ty)) return [[tx, ty]];
  const start = frIndex(Math.floor(s.x), Math.floor(s.y));
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  while (queue.length && !prev.has(goal)) {
    const i = queue.shift()!;
    const x = i % FR_W;
    const y = Math.floor(i / FR_W);
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = frIndex(nx, ny);
      if (prev.has(ni) || !frPassable(s, nx, ny)) continue;
      // По диагонали — только если обе соседние клетки проходимы (не срезаем угол воды).
      if (dx && dy && (!frPassable(s, x + dx, y) || !frPassable(s, x, y + dy))) continue;
      prev.set(ni, i);
      queue.push(ni);
    }
  }
  if (!prev.has(goal)) return null;
  const cells: number[] = [];
  for (let c = goal; c !== start && c !== -1; c = prev.get(c)!) cells.unshift(c);
  const points: Array<[number, number]> = cells.map((c) => [(c % FR_W) + 0.5, Math.floor(c / FR_W) + 0.5]);
  points[points.length - 1] = [tx, ty];
  // Срезаем углы: из текущей точки идём сразу в самую дальнюю видимую.
  const out: Array<[number, number]> = [];
  let from: [number, number] = [s.x, s.y];
  let k = 0;
  while (k < points.length) {
    let far = k;
    for (let j = points.length - 1; j > k; j--) {
      if (clearLine(s, from[0], from[1], points[j]![0], points[j]![1])) {
        far = j;
        break;
      }
    }
    out.push(points[far]!);
    from = points[far]!;
    k = far + 1;
  }
  return out;
}

const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function frWalkable(s: FrState, x: number, y: number): boolean {
  return inside(x, y) && !BLOCKING.has(s.tiles[frIndex(x, y)]!);
}

/** Ночь ли сейчас (вечер ещё не ночь). */
export function frIsNight(s: FrState): boolean {
  return s.clock >= FR_NIGHT_AT;
}

/** Насколько темно: 0 — день, 1 — глубокая ночь. */
export function frDarkness(s: FrState): number {
  if (s.loc === 'cave') return 0.85;
  if (s.clock < FR_EVENING_AT) return 0;
  if (s.clock < FR_NIGHT_AT) return (s.clock - FR_EVENING_AT) / (FR_NIGHT_AT - FR_EVENING_AT);
  // Перед рассветом светлеет за последние 15 секунд.
  const dawn = FR_DAY_MS - s.clock;
  return dawn < 15_000 ? dawn / 15_000 : 1;
}

/** Под шалашом: 3x3 клетки вокруг костра. */
export function frInShelter(s: FrState, x = s.x, y = s.y): boolean {
  if (s.shelter <= 0) return false;
  const c = frCenter(s);
  return Math.abs(Math.floor(x) - c.x) <= 1 && Math.abs(Math.floor(y) - c.y) <= 1;
}

/** Клетка лежанки: рядом с костром внутри шалаша. */
export function frBedCell(): { x: number; y: number } {
  const c = frCenter();
  return { x: c.x - 1, y: c.y + 1 };
}

/** Стоит ли питомец в свете костра. */
export function frInFireLight(s: FrState): boolean {
  if (s.fire <= 0) return false;
  const c = frCenter(s);
  return Math.hypot(s.x - (c.x + 0.5), s.y - (c.y + 0.5)) <= frFireRadius(s);
}

export function frSlotsUsed(inv: FrState['inv']): number {
  return Object.values(inv).reduce((sum, n) => sum + Math.ceil((n ?? 0) / FR_STACK), 0);
}

function canTake(inv: FrState['inv'], item: FrItem, cap = FR_SLOTS): boolean {
  const n = inv[item] ?? 0;
  return n % FR_STACK !== 0 || frSlotsUsed(inv) < cap;
}

/** Сколько ячеек в рюкзаке: 12 и по 4 за каждый надетый кошелёк. */
export const FR_PURSE_BONUS = 4;
export const FR_GEAR_SLOTS = 3;
export function frCapacity(s: FrState): number {
  return FR_SLOTS + FR_PURSE_BONUS * s.worn.length;
}

// --- Карта ---

type Rand = () => number;
function rand(seed: number): Rand {
  let st = seed;
  return () => {
    const [r, next] = nextRandom(st);
    st = next;
    return r;
  };
}

const DROP_COUNTS: Readonly<Partial<Record<FrItem, number>>> = { branch: 8, stone: 6, flint: 3, mushroom: 5 };

/** Новый поход: случайная поляна с ручьём, костровищем в центре и рассыпанными вещами. */
export function newForest(seed: number): FrState {
  const r = rand(seed);
  const tiles: FrTile[] = new Array(FR_W * FR_H).fill('grass');
  const c = frCenter();
  // Ручей: извилистая полоса сверху вниз в стороне от центра.
  let wx = r() < 0.5 ? 4 + Math.floor(r() * 5) : FR_W - 9 + Math.floor(r() * 5);
  for (let y = 0; y < FR_H; y++) {
    wx = Math.max(2, Math.min(FR_W - 4, wx + (r() < 0.33 ? -1 : r() < 0.5 ? 1 : 0)));
    tiles[frIndex(wx, y)] = 'water';
    tiles[frIndex(wx + 1, y)] = 'water';
  }
  // Деревья по краю (стена леса) и вразброс.
  for (let y = 0; y < FR_H; y++) {
    for (let x = 0; x < FR_W; x++) {
      const i = frIndex(x, y);
      if (tiles[i] === 'water') continue;
      const edge = x === 0 || y === 0 || x === FR_W - 1 || y === FR_H - 1;
      if (edge || r() < 0.11) tiles[i] = 'tree';
      else if (r() < 0.03) tiles[i] = 'bush';
    }
  }
  // Поляна 5×5 вокруг костровища.
  for (let y = c.y - 2; y <= c.y + 2; y++) for (let x = c.x - 2; x <= c.x + 2; x++) tiles[frIndex(x, y)] = 'grass';
  tiles[frIndex(c.x, c.y)] = 'pit';
  const s: FrState = {
    v: 1,
    seed,
    nextId: 1,
    tiles,
    berries: [],
    drops: [],
    x: c.x + 0.5,
    y: c.y + 2.5,
    facing: 1,
    path: [],
    goal: null,
    busy: null,
    inv: {},
    pot: [],
    torch: 0,
    worn: [],
    loc: 'home',
    pit: { x: c.x, y: c.y },
    places: {},
    mobs: [],
    trapNews: [],
    chase: null,
    atkCd: 0,
    dur: {},
    weather: { rain: false, left: FR_DRY_FIRST_MS },
    shelter: 0,
    bed: false,
    chest: {},
    count: {},
    claimed: [],
    notified: [],
    stats: { food: 80, water: 80, warmth: 100, health: 100 },
    clock: 0,
    day: 1,
    fire: 0,
    sleeping: false,
    over: false,
    treats: 0,
  };
  // Всё, до чего нельзя дойти, превращается в деревья — так на карте нет недостижимых мест.
  const reach = reachable(s, c.x, c.y + 1);
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 'grass' && !reach.has(i)) tiles[i] = 'tree';
  }
  // Кусты и вода должны быть доступны хотя бы с одной стороны.
  for (let i = 0; i < tiles.length; i++) {
    if ((tiles[i] === 'bush' || tiles[i] === 'water') && !touchesReach(i, reach)) tiles[i] = tiles[i] === 'bush' ? 'tree' : 'water';
  }
  if (!tiles.some((t, i) => t === 'water' && touchesReach(i, reach))) {
    // Почти невозможно, но на всякий случай: прорубаем тропу к ручью.
    carveToWater(s, c.x, c.y + 1);
  }
  addHomeExits(s);
  // Высокая трава на ~65% свободных клеток (кроме поляны) и большие камни.
  const inClearing = (i: number): boolean => Math.abs((i % FR_W) - c.x) <= 2 && Math.abs(Math.floor(i / FR_W) - c.y) <= 2;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 'grass' && !inClearing(i) && r() < 0.7) tiles[i] = 'tall';
  }
  const rockSpots = tiles.flatMap((t, i) => (t !== 'grass' && t !== 'tall') || inClearing(i) || !reach.has(i) ? [] : [i]);
  for (let k = 0; k < 10 && rockSpots.length; k++) {
    const j = Math.floor(r() * rockSpots.length);
    tiles[rockSpots[j]!] = 'rock';
    rockSpots.splice(j, 1);
  }
  restock(s, r);
  spawnDay(s);
  return s;
}

/** Выходы из дома: на север к озеру и на восток к пещере. Тропа к ним прорубается, ручей пересекает брод. */
function addHomeExits(s: FrState): void {
  const c = { x: Math.floor(FR_W / 2), y: Math.floor(FR_H / 2) };
  for (let y = 1; y <= c.y - 3; y++) s.tiles[frIndex(c.x, y)] = 'grass';
  for (let x = c.x + 3; x <= FR_W - 2; x++) s.tiles[frIndex(x, c.y)] = 'grass';
  for (const e of FR_EXITS.home) s.tiles[frIndex(e.x, e.y)] = 'exit';
}

/** Выходы из локаций: клетка выхода, клетка внутри карты (куда встаёт питомец при входе) и куда ведут. */
export const FR_EXITS: Record<FrPlace, ReadonlyArray<{ x: number; y: number; ix: number; iy: number; to: FrPlace }>> = {
  home: [
    { x: 15, y: 1, ix: 15, iy: 2, to: 'lake' },
    { x: 28, y: 15, ix: 27, iy: 15, to: 'cave' },
  ],
  lake: [{ x: 15, y: 28, ix: 15, iy: 27, to: 'home' }],
  cave: [{ x: 1, y: 15, ix: 2, iy: 15, to: 'home' }],
};

export function frExitAt(s: FrState, cell: number): { to: FrPlace } | null {
  return FR_EXITS[s.loc].find((e) => frIndex(e.x, e.y) === cell) ?? null;
}

/** Светло ли настолько, чтобы работать: вне пещеры всегда, в пещере — с факелом или у костра. */
export function frLit(s: FrState): boolean {
  return s.loc !== 'cave' || s.torch > 0 || frInFireLight(s);
}

type Gen = { tiles: FrTile[]; pit: { x: number; y: number } };

function fillTiles(tiles: FrTile[], pit: { x: number; y: number }): void {
  for (let y = pit.y - 1; y <= pit.y + 1; y++) for (let x = pit.x - 1; x <= pit.x + 1; x++) tiles[frIndex(x, y)] = 'grass';
}

/** Недостижимое от костровища превращается в стену (дерево или камень). */
function sealUnreachable(tiles: FrTile[], pit: { x: number; y: number }, wall: FrTile): void {
  const tmp = { tiles } as FrState;
  const reach = reachable(tmp, pit.x, pit.y);
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if ((t === 'grass' || t === 'tall' || t === 'reed') && !reach.has(i)) tiles[i] = wall;
  }
}

function genLake(seed: number): Gen {
  const r = rand(seed);
  const tiles: FrTile[] = new Array(FR_W * FR_H).fill('grass');
  const pit = { x: 15, y: 26 };
  for (let y = 0; y < FR_H; y++) {
    for (let x = 0; x < FR_W; x++) {
      const i = frIndex(x, y);
      const edge = x === 0 || y === 0 || x === FR_W - 1 || y === FR_H - 1;
      const dx = (x - 15) / 10;
      const dy = (y - 11) / 6.5;
      if (edge) tiles[i] = 'tree';
      else if (dx * dx + dy * dy <= 1 + (r() - 0.5) * 0.25) tiles[i] = 'water';
      else if (r() < 0.07) tiles[i] = 'tree';
      else if (r() < 0.03) tiles[i] = 'bush';
      else if (r() < 0.35) tiles[i] = 'tall';
    }
  }
  for (let y = 18; y < FR_H - 1; y++) tiles[frIndex(15, y)] = 'grass';
  fillTiles(tiles, pit);
  tiles[frIndex(15, 28)] = 'exit';
  tiles[frIndex(15, 27)] = 'grass';
  tiles[frIndex(15, 26)] = 'grass';
  // Тростник у воды.
  const near = (x: number, y: number): boolean => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tiles[frIndex(x + a!, y + b!)] === 'water');
  for (let y = 1; y < FR_H - 1; y++) for (let x = 1; x < FR_W - 1; x++) if ((tiles[frIndex(x, y)] === 'grass' || tiles[frIndex(x, y)] === 'tall') && near(x, y) && r() < 0.7) tiles[frIndex(x, y)] = 'reed';
  for (let k = 0; k < 6; k++) {
    const i = frIndex(2 + Math.floor(r() * 26), 14 + Math.floor(r() * 11));
    if (tiles[i] === 'grass' || tiles[i] === 'tall') tiles[i] = 'rock';
  }
  sealUnreachable(tiles, pit, 'tree');
  return { tiles, pit };
}

function genCave(seed: number): Gen {
  const r = rand(seed);
  const tiles: FrTile[] = new Array(FR_W * FR_H).fill('rock');
  const pit = { x: 3, y: 15 };
  const carve = (x: number, y: number): void => {
    if (x >= 2 && y >= 2 && x <= FR_W - 3 && y <= FR_H - 3) tiles[frIndex(x, y)] = 'grass';
  };
  for (let w = 0; w < 9; w++) {
    let x = pit.x;
    let y = pit.y;
    for (let k = 0; k < 110; k++) {
      const d = r();
      if (d < 0.45) x += 1;
      else if (d < 0.6) x -= 1;
      else if (d < 0.8) y += 1;
      else y -= 1;
      x = Math.max(2, Math.min(FR_W - 3, x));
      y = Math.max(2, Math.min(FR_H - 3, y));
      carve(x, y);
      carve(x + 1, y);
      if (r() < 0.4) carve(x, y + 1);
    }
  }
  fillTiles(tiles, pit);
  tiles[frIndex(1, 15)] = 'exit';
  tiles[frIndex(2, 15)] = 'grass';
  tiles[frIndex(3, 15)] = 'grass';
  // Родник: одна клетка воды вдали от входа, если остальной проход не рвётся.
  const floors = tiles.flatMap((t, i) => (t === 'grass' && Math.abs((i % FR_W) - pit.x) > 9 ? [i] : []));
  if (floors.length) tiles[floors[Math.floor(r() * floors.length)]!] = 'water';
  sealUnreachable(tiles, pit, 'rock');
  // Руда в стенах, прилегающих к проходам.
  let ore = 0;
  for (let y = 2; y < FR_H - 2 && ore < 14; y++) {
    for (let x = 2; x < FR_W - 2 && ore < 14; x++) {
      const i = frIndex(x, y);
      if (tiles[i] === 'rock' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tiles[frIndex(x + a!, y + b!)] === 'grass') && r() < 0.16) {
        tiles[i] = 'ore';
        ore++;
      }
    }
  }
  return { tiles, pit };
}

/** Новый день в локации: на озере снова вырос тростник, в пещере проступила руда. */
function refreshPlace(s: FrState, r: Rand): void {
  const cells: number[] = [];
  for (let y = 2; y < FR_H - 2; y++) {
    for (let x = 2; x < FR_W - 2; x++) {
      const i = frIndex(x, y);
      const t = s.tiles[i];
      const nb = (k: FrTile): boolean => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => s.tiles[frIndex(x + a!, y + b!)] === k);
      if (s.loc === 'lake' && (t === 'grass' || t === 'tall') && nb('water')) cells.push(i);
      if (s.loc === 'cave' && t === 'rock' && nb('grass')) cells.push(i);
    }
  }
  const kind: FrTile = s.loc === 'lake' ? 'reed' : 'ore';
  if (s.loc === 'home') return;
  const want = s.loc === 'lake' ? 10 : 5;
  for (let k = 0; k < want && cells.length; k++) {
    const j = Math.floor(r() * cells.length);
    s.tiles[cells[j]!] = kind;
    cells.splice(j, 1);
  }
}

function savePlace(s: FrState): void {
  s.places[s.loc] = { tiles: s.tiles, drops: s.drops, berries: s.berries, mobs: s.mobs, fire: s.fire, shelter: s.shelter, bed: s.bed, pit: s.pit, day: s.day };
}

/** Перейти в другую локацию: прежняя замирает, пока питомца в ней нет. */
export function frTravel(s: FrState, to: FrPlace): FrEvent[] {
  if (s.over || to === s.loc) return [];
  const from = s.loc;
  savePlace(s);
  const stored = s.places[to];
  delete s.places[to];
  s.loc = to;
  const entry = FR_EXITS[to].find((e) => e.to === from) ?? FR_EXITS[to][0]!;
  s.x = entry.ix + 0.5;
  s.y = entry.iy + 0.5;
  s.path = [];
  s.goal = null;
  s.chase = null;
  s.busy = null;
  s.sleeping = false;
  const r = rand(s.seed + 40_000 + s.day * 977 + (to === 'lake' ? 1 : 2) * 131);
  if (stored) {
    s.tiles = stored.tiles;
    s.drops = stored.drops;
    s.berries = stored.berries;
    s.mobs = stored.mobs;
    s.fire = stored.fire;
    s.shelter = stored.shelter;
    s.bed = stored.bed;
    s.pit = stored.pit;
    if (stored.day !== s.day) {
      refreshPlace(s, r);
      restock(s, r);
      spawnDay(s);
    }
  } else {
    const g = to === 'lake' ? genLake(s.seed * 7 + 1) : to === 'cave' ? genCave(s.seed * 7 + 2) : null;
    if (!g) return [];
    s.tiles = g.tiles;
    s.pit = g.pit;
    s.drops = [];
    s.berries = [];
    s.mobs = [];
    s.fire = 0;
    s.shelter = 0;
    s.bed = false;
    restock(s, r);
    spawnDay(s);
  }
  return [{ type: 'traveled', to }];
}

function touchesReach(i: number, reach: Set<number>): boolean {
  const x = i % FR_W;
  const y = Math.floor(i / FR_W);
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => inside(x + dx!, y + dy!) && reach.has(frIndex(x + dx!, y + dy!)));
}

function carveToWater(s: FrState, x0: number, y0: number): void {
  for (let x = x0; inside(x, y0); x++) {
    const i = frIndex(x, y0);
    if (s.tiles[i] === 'water') return;
    if (s.tiles[i] !== 'pit') s.tiles[i] = 'grass';
  }
}

function reachable(s: FrState, x0: number, y0: number): Set<number> {
  const seen = new Set<number>([frIndex(x0, y0)]);
  const queue = [frIndex(x0, y0)];
  while (queue.length) {
    const i = queue.shift()!;
    const x = i % FR_W;
    const y = Math.floor(i / FR_W);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = frIndex(nx, ny);
      if (frWalkable(s, nx, ny) && !seen.has(ni)) {
        seen.add(ni);
        queue.push(ni);
      }
    }
  }
  return seen;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Утром: вещи снова лежат на земле, на кустах снова ягоды. */
function restock(s: FrState, r: Rand): void {
  const c = frCenter(s);
  const free: number[] = [];
  const taken = new Set(s.drops.map((d) => frIndex(d.x, d.y)));
  const reach = reachable(s, c.x, frWalkable(s, c.x, c.y + 1) ? c.y + 1 : c.y);
  for (const i of reach) {
    const x = i % FR_W;
    const y = Math.floor(i / FR_W);
    if (s.tiles[i] === 'grass' && !taken.has(i) && Math.abs(x - c.x) + Math.abs(y - c.y) > 1) free.push(i);
  }
  for (const kind of Object.keys(DROP_COUNTS) as FrItem[]) {
    const have = s.drops.filter((d) => d.kind === kind).length;
    for (let k = have; k < (DROP_COUNTS[kind] ?? 0) && free.length; k++) {
      // Пару веток и камень кладём прямо у поляны, чтобы первое задание было рядом.
      const near = (kind === 'branch' && k < 3) || (kind === 'flint' && k < 1);
      const pool = near ? free.filter((i) => dist(i, c) <= 4) : free;
      const list = pool.length ? pool : free;
      const pick = list[Math.floor(r() * list.length)]!;
      free.splice(free.indexOf(pick), 1);
      s.drops.push({ id: s.nextId++, kind, x: pick % FR_W, y: Math.floor(pick / FR_W) });
    }
  }
  s.berries = s.tiles.flatMap((t, i) => (t === 'bush' ? [i] : []));
}

function dist(i: number, c: { x: number; y: number }): number {
  return Math.abs((i % FR_W) - c.x) + Math.abs(Math.floor(i / FR_W) - c.y);
}

// --- Ходьба ---

/** Кратчайший путь по клеткам (без стартовой), или null. targets — подходящие конечные клетки. */
export function frPath(s: FrState, from: number, targets: ReadonlySet<number>): number[] | null {
  if (targets.has(from)) return [];
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const i = queue.shift()!;
    const x = i % FR_W;
    const y = Math.floor(i / FR_W);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = frIndex(nx, ny);
      if (!frWalkable(s, nx, ny) || prev.has(ni)) continue;
      prev.set(ni, i);
      if (targets.has(ni)) {
        const path = [ni];
        let p = i;
        while (p !== from) {
          path.unshift(p);
          p = prev.get(p)!;
        }
        return path;
      }
      queue.push(ni);
    }
  }
  return null;
}

function petCell(s: FrState): number {
  return frIndex(Math.floor(s.x), Math.floor(s.y));
}

function neighbours(i: number): number[] {
  const x = i % FR_W;
  const y = Math.floor(i / FR_W);
  return DIRS.filter(([dx, dy]) => inside(x + dx, y + dy)).map(([dx, dy]) => frIndex(x + dx, y + dy));
}

/** Что лежит или стоит в клетке. */
export type FrTarget =
  | { kind: 'ground' }
  | { kind: 'drop'; drop: FrDrop }
  | { kind: 'bush' }
  | { kind: 'water' }
  | { kind: 'tree' }
  | { kind: 'pit' }
  | { kind: 'chest' }
  | { kind: 'loom' }
  | { kind: 'exit' }
  | { kind: 'foundry' }
  | { kind: 'dryer' }
  | { kind: 'reed' }
  | { kind: 'ore' }
  | { kind: 'trap' }
  | { kind: 'trapfull' }
  | { kind: 'rock' }
  | { kind: 'tall'; x: number; y: number };

export type FrAction = 'travel' | 'fish' | 'pick' | 'chop' | 'drink' | 'light' | 'feed' | 'cook' | 'sleep' | 'open' | 'mine' | 'cut' | 'fill';

export function frTargetAt(s: FrState, x: number, y: number): FrTarget | null {
  if (!inside(x, y)) return null;
  const tile = s.tiles[frIndex(x, y)]!;
  if (tile === 'grass') {
    const drop = s.drops.find((d) => d.x === x && d.y === y);
    return drop ? { kind: 'drop', drop } : { kind: 'ground' };
  }
  if (tile === 'tall') return { kind: 'tall', x, y };
  if (tile === 'reed') return { kind: 'reed', x, y } as unknown as FrTarget;
  return { kind: tile };
}

/** Какие кнопки показать у предмета. */
export function frActions(s: FrState, target: FrTarget): FrAction[] {
  switch (target.kind) {
    case 'drop':
    case 'bush':
      return ['pick'];
    case 'tree':
      return ['chop'];
    case 'water':
      return (s.inv.rod ?? 0) > 0 ? ['drink', 'fill', 'fish'] : ['drink', 'fill'];
    case 'exit':
      return ['travel'];
    case 'ore':
      return ['mine'];
    case 'reed':
      return Math.hypot(s.x - (target as unknown as { x: number }).x - 0.5, s.y - (target as unknown as { y: number }).y - 0.5) <= 1.7 ? ['cut'] : [];
    case 'pit':
      return s.fire > 0 ? ['feed', 'cook', 'sleep'] : ['light'];
    case 'chest':
    case 'loom':
    case 'foundry':
    case 'dryer':
    case 'trapfull':
      return ['open'];
    case 'trap':
      return [];
    case 'rock':
      return ['mine'];
    case 'tall':
      // Срезать можно только рядом; издалека нажатие просто ведёт питомца к траве.
      return Math.hypot(s.x - (target.x + 0.5), s.y - (target.y + 0.5)) <= 1.7 ? ['cut'] : [];
    case 'ground':
      return [];
  }
}

/**
 * Пойти к клетке (x, y) и, дойдя, сделать action. point — точное место нажатия (для ходьбы по земле).
 * К дереву, кусту и костру питомец подходит вплотную, к воде — до берега.
 */
export function frDo(s: FrState, x: number, y: number, action: FrAction | null, point?: [number, number]): FrEvent[] {
  return withQuest(s, doAction(s, x, y, action, point));
}

function doAction(s: FrState, x: number, y: number, action: FrAction | null, point?: [number, number]): FrEvent[] {
  if (s.over || !inside(x, y)) return [];
  s.chase = null;
  const i = frIndex(x, y);
  const tile = s.tiles[i];
  const cx = x + 0.5;
  const cy = y + 0.5;
  let dest: [number, number] | null = null;
  if (!action) dest = point ?? [cx, cy];
  else if (tile === 'grass' || tile === 'chest' || tile === 'loom' || tile === 'foundry' || tile === 'dryer' || tile === 'tall' || tile === 'trap' || tile === 'trapfull' || tile === 'exit' || tile === 'reed') dest = [cx, cy];
  else if (tile === 'tree' || tile === 'bush' || tile === 'rock' || tile === 'ore') {
    // Встать рядом, со стороны питомца.
    const d = Math.hypot(s.x - cx, s.y - cy) || 1;
    dest = d <= 0.75 ? [s.x, s.y] : [cx + ((s.x - cx) / d) * 0.6, cy + ((s.y - cy) / d) * 0.6];
  }
  let path = dest && frPassable(s, Math.floor(dest[0]), Math.floor(dest[1])) ? route(s, dest[0], dest[1]) : null;
  if (!path) {
    // Вода, костровище или недоступная точка: ближайшее проходимое место рядом с клеткой.
    const spots = neighbours(i)
      .filter((n) => frPassable(s, n % FR_W, Math.floor(n / FR_W)))
      .map((n): [number, number] => {
        const nx = (n % FR_W) + 0.5;
        const ny = Math.floor(n / FR_W) + 0.5;
        return [nx + (cx - nx) * 0.35, ny + (cy - ny) * 0.35];
      })
      .sort((a, b) => Math.hypot(a[0] - s.x, a[1] - s.y) - Math.hypot(b[0] - s.x, b[1] - s.y));
    for (const spot of spots) {
      path = route(s, spot[0], spot[1]);
      if (path) break;
    }
  }
  if (!path) return [];
  if (s.sleeping) s.sleeping = false;
  const drop = s.drops.find((d) => d.x === x && d.y === y);
  s.path = Math.hypot(path[path.length - 1]![0] - s.x, path[path.length - 1]![1] - s.y) < 0.05 ? [] : path;
  s.goal = action ? { action, cell: i, ...(action === 'pick' && drop ? { id: drop.id } : {}) } : null;
  s.busy = null;
  return s.path.length === 0 ? arrive(s) : [];
}

/** Нажатие без меню: сразу первое действие у предмета (или просто пойти). */
export function frTap(s: FrState, x: number, y: number): FrEvent[] {
  const target = frTargetAt(s, x, y);
  if (!target) return [];
  return frDo(s, x, y, frActions(s, target)[0] ?? null);
}

/** Инструмент, который тратится на событие (или нет). */
function toolFor(ev: FrEvent, s: FrState): FrTool | null {
  if (ev.type === 'chopped') return (s.inv.ironaxe ?? 0) > 0 ? 'ironaxe' : 'axe';
  if (ev.type === 'mined') return (s.inv.ironpick ?? 0) > 0 ? 'ironpick' : 'pickaxe';
  if (ev.type === 'fished' || ev.type === 'noBite') return 'rod';
  if (ev.type === 'cut' || (ev.type === 'picked' && ev.item === 'grass' && s.goal === null)) return (s.inv.ironknife ?? 0) > 0 ? 'ironknife' : 'knife';
  return null;
}

/** Остаток прочности инструмента. */
export function frDurability(s: FrState, tool: FrTool): number {
  return s.dur[tool] ?? frToolUses(tool);
}

function arrive(s: FrState): FrEvent[] {
  const ev = arriveInner(s);
  const tool = ev.map((e) => toolFor(e, s)).find((t) => t);
  if (!tool || !(s.inv[tool] ?? 0)) return ev;
  const left = frDurability(s, tool) - 1;
  if (left > 0) {
    s.dur[tool] = left;
    return ev;
  }
  delete s.dur[tool];
  delete s.inv[tool];
  return [...ev, { type: 'broke', item: tool }];
}

function arriveInner(s: FrState): FrEvent[] {
  const goal = s.goal;
  s.goal = null;
  if (!goal) return [];
  faceTo(s, goal.cell);
  switch (goal.action) {
    case 'pick': {
      if (goal.id !== undefined) {
        const d = s.drops.find((it) => it.id === goal.id);
        if (!d) return [];
        if (d.kind === 'grass' && !hasTool(s, 'knife')) return [{ type: 'needKnife' }];
        if (!canTake(s.inv, d.kind, frCapacity(s))) return [{ type: 'full' }];
        s.drops = s.drops.filter((it) => it.id !== d.id);
        s.inv[d.kind] = (s.inv[d.kind] ?? 0) + 1;
        bump(s, `pick:${d.kind}`);
        s.busy = { kind: 'gather', left: FR_ACTION_MS };
        return [{ type: 'picked', item: d.kind }];
      }
      if (s.tiles[goal.cell] !== 'bush') return [];
      if (!s.berries.includes(goal.cell)) return [{ type: 'empty' }];
      if (!canTake(s.inv, 'berries', frCapacity(s))) return [{ type: 'full' }];
      s.berries = s.berries.filter((b) => b !== goal.cell);
      const nbr = frYield(s, 'pick:berries', 1);
      s.inv.berries = (s.inv.berries ?? 0) + nbr;
      bump(s, 'pick:berries', nbr);
      s.busy = { kind: 'gather', left: FR_ACTION_MS };
      return [{ type: 'picked', item: 'berries' }];
    }
    case 'fill': {
      if (!(s.inv.flask ?? 0)) return [{ type: 'needFlask' }];
      take(s, 'flask', 1);
      s.inv.fullflask = (s.inv.fullflask ?? 0) + 1;
      s.busy = { kind: 'drink', left: FR_ACTION_MS };
      return [{ type: 'filled' }];
    }
    case 'fish': {
      if (!(s.inv.rod ?? 0)) return [{ type: 'needRod' }];
      const tries = (s.count.fishTry ?? 0) + 1;
      s.count.fishTry = tries;
      s.busy = { kind: 'gather', left: FR_ACTION_MS * 2 };
      if (rand(s.seed + 12_000 + tries * 29)() < FISH_CHANCE) {
        const spillFish = give(s, 'fish', 1, goal.cell);
        bump(s, 'pick:fish');
        return spillFish ? [{ type: 'fished' }, { type: 'spilled' }] : [{ type: 'fished' }];
      }
      return [{ type: 'noBite' }];
    }
    case 'travel': {
      const ex = frExitAt(s, goal.cell);
      if (!ex) return [];
      return ex.to === 'home' ? frTravel(s, 'home') : [{ type: 'travelAsk', to: ex.to }];
    }
    case 'drink':
      s.stats.water = Math.min(100, s.stats.water + 30);
      s.busy = { kind: 'drink', left: FR_ACTION_MS };
      return [{ type: 'drank' }];
    case 'chop': {
      if (!hasTool(s, 'axe')) return [{ type: 'needAxe' }];
      if (s.tiles[goal.cell] !== 'tree') return [];
      s.tiles[goal.cell] = 'grass';
      const nb = frYield(s, 'chop', 2);
      let spill = give(s, 'branch', nb, goal.cell);
      bump(s, 'chop');
      s.busy = { kind: 'gather', left: FR_ACTION_MS * 2 };
      const ev: FrEvent[] = [{ type: 'chopped' }];
      if (rand(s.seed + 5000 + s.count.chop! * 13)() < EGG_CHANCE) {
        spill += give(s, 'egg', 1, goal.cell);
        bump(s, 'pick:egg');
        ev.push({ type: 'found', item: 'egg' });
      }
      if (spill) ev.push({ type: 'spilled' });
      return ev;
    }
    case 'open':
      if (s.tiles[goal.cell] === 'trapfull') {
        s.tiles[goal.cell] = 'trap';
        let spill = give(s, 'meat', 1, goal.cell);
        return spill ? [{ type: 'trapEmptied' }, { type: 'spilled' }] : [{ type: 'trapEmptied' }];
      }
      return [{ type: s.tiles[goal.cell] === 'loom' ? 'openLoom' : s.tiles[goal.cell] === 'foundry' ? 'openFoundry' : s.tiles[goal.cell] === 'dryer' ? 'openDryer' : 'openChest' }];
    case 'mine': {
      if (!hasTool(s, 'pickaxe')) return [{ type: 'needPickaxe' }];
      if (!frLit(s)) return [{ type: 'tooDark' }];
      if (s.tiles[goal.cell] === 'ore') {
        s.tiles[goal.cell] = 'grass';
        const spillOre = give(s, 'ore', 2, goal.cell) + give(s, 'stone', 1, goal.cell);
        bump(s, 'pick:ore', 2);
        bump(s, 'mine');
        s.busy = { kind: 'gather', left: FR_ACTION_MS * 2 };
        return spillOre ? [{ type: 'mined' }, { type: 'spilled' }] : [{ type: 'mined' }];
      }
      if (s.tiles[goal.cell] !== 'rock') return [];
      s.tiles[goal.cell] = 'grass';
      const ns = frYield(s, 'pick:stone', 2);
      let spill = give(s, 'stone', ns, goal.cell);
      if ((s.count.mine ?? 0) % 2 === 0) {
        spill += give(s, 'flint', 1, goal.cell);
        bump(s, 'pick:flint');
      }
      bump(s, 'pick:stone', ns);
      if (s.loc === 'cave' && rand(s.seed + 15_000 + (s.count.mine ?? 0) * 11)() < 0.4) {
        spill += give(s, 'salt', 1, goal.cell);
        bump(s, 'pick:salt');
      }
      bump(s, 'mine');
      s.busy = { kind: 'gather', left: FR_ACTION_MS * 2 };
      return spill ? [{ type: 'mined' }, { type: 'spilled' }] : [{ type: 'mined' }];
    }
    case 'cut': {
      if (!hasTool(s, 'knife')) return [{ type: 'needKnife' }];
      if (s.tiles[goal.cell] === 'reed') {
        s.tiles[goal.cell] = 'grass';
        const spillReed = give(s, 'reed', 2, goal.cell);
        bump(s, 'pick:reed', 2);
        s.busy = { kind: 'gather', left: FR_ACTION_MS };
        return spillReed ? [{ type: 'cut' }, { type: 'spilled' }] : [{ type: 'cut' }];
      }
      if (s.tiles[goal.cell] !== 'tall') return [];
      s.tiles[goal.cell] = 'grass';
      const ng = frYield(s, 'pick:grass', 1);
      let spill = give(s, 'grass', ng, goal.cell);
      bump(s, 'pick:grass', ng);
      s.busy = { kind: 'gather', left: FR_ACTION_MS };
      const ev: FrEvent[] = [{ type: 'cut' }];
      if (rand(s.seed + 9000 + (s.count['pick:grass'] ?? 0) * 7)() < SEED_CHANCE) {
        spill += give(s, 'seeds', 1, goal.cell);
        bump(s, 'pick:seeds');
        ev.push({ type: 'found', item: 'seeds' });
      }
      if (spill) ev.push({ type: 'spilled' });
      return ev;
    }
    case 'light':
    case 'feed':
      return tendFire(s);
    case 'cook':
      if (s.fire <= 0) return [{ type: 'needForFire' }];
      return [{ type: 'openCook' }];
    case 'sleep':
      if (!frCanSleep(s)) return [{ type: 'sleepNo' }];
      frSleep(s, true);
      return [{ type: 'fellAsleep' }];
  }
}

function faceTo(s: FrState, cell: number): void {
  const dx = (cell % FR_W) + 0.5 - s.x;
  if (Math.abs(dx) > 0.1) s.facing = dx > 0 ? 1 : -1;
}

/** У костровища: разжечь (3 ветки + кремень) или подкинуть ветку. */
function tendFire(s: FrState): FrEvent[] {
  const branches = s.inv.branch ?? 0;
  if (s.fire > 0) {
    if (branches < 1) return [{ type: 'needBranch' }];
    take(s, 'branch', 1);
    s.fire = Math.min(FR_FIRE_MAX_MS * fireScale(s), s.fire + FR_FIRE_BRANCH_MS * fireScale(s));
    return [{ type: 'fireFed' }];
  }
  if (frRainHere(s) && !frFireSheltered(s)) return [{ type: 'tooWet' }];
  if (branches < 3 || (s.inv.flint ?? 0) < 1) return [{ type: 'needForFire' }];
  take(s, 'branch', 3);
  take(s, 'flint', 1);
  s.fire = FR_FIRE_START_MS * fireScale(s);
  bump(s, 'fire');
  return [{ type: 'fireLit' }];
}

function take(s: FrState, item: FrItem, n: number): void {
  const left = (s.inv[item] ?? 0) - n;
  if (left > 0) s.inv[item] = left;
  else delete s.inv[item];
}

export const FR_POT_SLOTS = 3;

/** Рецепты: что положить в окошко готовки и что получится. Порядок не важен. */
export const FR_RECIPES: ReadonlyArray<{ from: readonly FrItem[]; to: FrItem }> = [
  { from: ['mushroom'], to: 'cooked' },
  { from: ['egg'], to: 'friedegg' },
  { from: ['meat'], to: 'steak' },
  { from: ['fish'], to: 'friedfish' },
  { from: ['fullflask', 'fish'], to: 'fishsoup' },
  { from: ['fullflask', 'seeds', 'fish'], to: 'fishporridge' },
  { from: ['fullflask', 'meat'], to: 'broth' },
  { from: ['fullflask', 'seeds', 'meat'], to: 'meatporridge' },
  { from: ['fullflask', 'berries'], to: 'compote' },
  { from: ['fullflask', 'grass'], to: 'tea' },
  { from: ['fullflask', 'seeds'], to: 'porridge' },
  { from: ['fullflask', 'seeds', 'berries'], to: 'berryporridge' },
];

/** Можно ли положить предмет в окошко: он входит хотя бы в один рецепт. */
export function frCookable(item: FrItem): boolean {
  return FR_RECIPES.some((r) => r.from.includes(item));
}

/** Что получится из того, что лежит в окошке (null — такого рецепта нет). */
export function frRecipe(pot: readonly FrItem[]): FrItem | null {
  const key = [...pot].sort().join();
  const r = FR_RECIPES.find((x) => [...x.from].sort().join() === key);
  return r ? r.to : null;
}

type FrRecipe = (typeof FR_RECIPES)[number];

/** Хватает ли для рецепта ингредиентов (в рюкзаке и в окошке готовки вместе). */
export function frRecipeAvailable(s: FrState, r: FrRecipe): boolean {
  const have: Partial<Record<FrItem, number>> = { ...s.inv };
  for (const p of s.pot) have[p] = (have[p] ?? 0) + 1;
  const need: Partial<Record<FrItem, number>> = {};
  for (const it of r.from) need[it] = (need[it] ?? 0) + 1;
  return (Object.entries(need) as Array<[FrItem, number]>).every(([it, n]) => (have[it] ?? 0) >= n);
}

/** Выбрать рецепт: всё из окошка возвращается в рюкзак, нужные ингредиенты переходят в окошко. */
export function frRecipeFill(s: FrState, r: FrRecipe): boolean {
  if (!frRecipeAvailable(s, r)) return false;
  frPotReturn(s);
  for (const it of r.from) frPotAdd(s, it);
  return true;
}

/** Переложить одну штуку из рюкзака в окошко готовки. */
export function frPotAdd(s: FrState, item: FrItem): boolean {
  if (s.pot.length >= FR_POT_SLOTS || !(s.inv[item] ?? 0) || !frCookable(item)) return false;
  take(s, item, 1);
  s.pot.push(item);
  return true;
}

/** Вернуть штуку из окошка готовки обратно в рюкзак. */
export function frPotRemove(s: FrState, index: number): void {
  const [item] = s.pot.splice(index, 1);
  if (item) s.inv[item] = (s.inv[item] ?? 0) + 1;
}

/** Вернуть в рюкзак всё, что лежит в окошке. */
export function frPotReturn(s: FrState): void {
  while (s.pot.length) frPotRemove(s, 0);
}

/** Приготовить то, что лежит в окошке, на горящем костре. */
/** Кладёт предмет на свободную клетку рядом с костром (по кольцам от центра). */
function dropNearFire(s: FrState, kind: FrItem): boolean {
  const c = frCenter(s);
  return dropNear(s, kind, c.x, c.y, 1);
}

/** Кладёт добычу в рюкзак, а что не влезло — на землю рядом с клеткой. Возвращает, сколько упало на землю. */
function give(s: FrState, item: FrItem, n: number, cell: number): number {
  let spilled = 0;
  for (let k = 0; k < n; k++) {
    if (canTake(s.inv, item, frCapacity(s))) s.inv[item] = (s.inv[item] ?? 0) + 1;
    else if (dropNear(s, item, cell % FR_W, Math.floor(cell / FR_W))) spilled++;
    else s.inv[item] = (s.inv[item] ?? 0) + 1;
  }
  return spilled;
}

/** Кладёт предмет на свободную клетку рядом с (cx, cy), кольцами от `from`. */
function dropNear(s: FrState, kind: FrItem, cx: number, cy: number, from = 0): boolean {
  const c = { x: cx, y: cy };
  for (let r = from; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = c.x + dx;
        const y = c.y + dy;
        if (!inside(x, y) || !frWalkable(s, x, y) || s.drops.some((d) => d.x === x && d.y === y)) continue;
        s.drops.push({ id: s.nextId++, kind, x, y });
        return true;
      }
    }
  }
  return false;
}

export function frPotCook(s: FrState): FrEvent[] {
  if (s.fire <= 0) return [{ type: 'needForFire' }];
  const out = frRecipe(s.pot);
  if (!out) return [{ type: 'nothingToCook' }];
  // Фляга с водой после готовки возвращается пустой.
  if (s.pot.includes('fullflask')) s.inv.flask = (s.inv.flask ?? 0) + 1;
  s.pot = [];
  bump(s, 'cook');
  bump(s, `made:${out}`);
  const ev: FrEvent[] = [{ type: 'cooked', item: out }];
  if (canTake(s.inv, out, frCapacity(s))) s.inv[out] = (s.inv[out] ?? 0) + 1;
  else if (dropNearFire(s, out)) ev.push({ type: 'cookDropped', item: out });
  else s.inv[out] = (s.inv[out] ?? 0) + 1;
  return withQuest(s, ev);
}

/** Что даёт еда и питьё: на сколько растут шкалы. */
export const FR_EFFECTS: Partial<Record<FrItem, Partial<Record<FrStat, number>>>> = {
  berries: { food: 10 },
  mushroom: { food: 5 },
  cooked: { food: 25 },
  egg: { food: 5 },
  friedegg: { food: 30, health: 5 },
  meat: { food: 12 },
  steak: { food: 45, health: 5 },
  fish: { food: 10 },
  friedfish: { food: 40, health: 3 },
  fishsoup: { food: 30, water: 25, health: 8 },
  fishporridge: { food: 55, health: 5 },
  broth: { food: 20, water: 30, health: 10 },
  meatporridge: { food: 60, health: 8 },
  fullflask: { water: 30 },
  tea: { water: 20, warmth: 30, health: 10 },
  compote: { food: 12, water: 25 },
  porridge: { food: 40 },
  berryporridge: { food: 50, health: 5 },
  jerky: { food: 40, health: 3 },
  driedfish: { food: 38, health: 3 },
};

/** Сколько сытости даёт еда (для старых мест кода). */
export const FR_FOOD: Partial<Record<FrItem, number>> = Object.fromEntries(
  Object.entries(FR_EFFECTS).flatMap(([k, v]) => (v?.food ? [[k, v.food]] : [])),
);

export function frEat(s: FrState, item: FrItem): FrEvent[] {
  const fx = FR_EFFECTS[item];
  if (s.over || !fx || !(s.inv[item] ?? 0)) return [];
  take(s, item, 1);
  if (item === 'fullflask') s.inv.flask = (s.inv.flask ?? 0) + 1;
  for (const [k, v] of Object.entries(fx) as Array<[FrStat, number]>) s.stats[k] = Math.min(100, s.stats[k] + v);
  s.busy = { kind: 'eat', left: FR_ACTION_MS };
  s.path = [];
  s.goal = null;
  return [{ type: 'ate', item }];
}

/** Зажечь факел из рюкзака: освещает питомца и не даёт мёрзнуть. */
export function frTorch(s: FrState): FrEvent[] {
  if (s.over || !(s.inv.torch ?? 0)) return [];
  take(s, 'torch', 1);
  s.torch = FR_TORCH_MS;
  return [{ type: 'torchLit' }];
}

export function frThrow(s: FrState, item: FrItem): FrEvent[] {
  if (s.over || !(s.inv[item] ?? 0)) return [];
  take(s, item, 1);
  const here = petCell(s);
  const spots = [here, ...neighbours(here)].filter(
    (c) => frWalkable(s, c % FR_W, Math.floor(c / FR_W)) && !s.drops.some((d) => frIndex(d.x, d.y) === c),
  );
  const spot = spots[0];
  if (spot !== undefined) s.drops.push({ id: s.nextId++, kind: item, x: spot % FR_W, y: Math.floor(spot / FR_W) });
  return [{ type: 'thrown', item }];
}

/** Можно ли лечь спать: ночью или вечером, у горящего костра. */
export function frCanSleep(s: FrState): boolean {
  return !s.over && s.clock >= FR_EVENING_AT && frInFireLight(s);
}

export function frSleep(s: FrState, on: boolean): void {
  if (on && !frCanSleep(s)) return;
  s.sleeping = on;
  if (on) {
    s.path = [];
    s.goal = null;
    s.busy = null;
  }
}

// --- Время ---

/** За игровые сутки сытость и вода падают на столько. */
const FOOD_PER_DAY = 25;
const WATER_PER_DAY = 35;
const LOW = 25;

/** Сдвигает игру на dt реальных миллисекунд. Меняет состояние на месте, возвращает события. */
export function frTick(s: FrState, dt: number): FrEvent[] {
  return withQuest(s, tick(s, dt));
}

function tick(s: FrState, dt: number): FrEvent[] {
  if (s.over) return [];
  const events: FrEvent[] = [];
  const speed = s.sleeping ? FR_SLEEP_SPEED : 1;
  const gdt = dt * speed;

  // Ходьба по пути.
  if (s.busy) {
    s.busy.left -= dt;
    if (s.busy.left <= 0) s.busy = null;
  } else if (s.path.length) {
    let step = (SPEED * dt) / 1000;
    while (step > 0 && s.path.length) {
      const [tx, ty] = s.path[0]!;
      const dx = tx - s.x;
      const dy = ty - s.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) s.facing = dx > 0 ? 1 : -1;
      if (d <= step) {
        s.x = tx;
        s.y = ty;
        s.path.shift();
        step -= d;
      } else {
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        step = 0;
      }
    }
    if (!s.path.length) events.push(...arrive(s));
  }

  // Шкалы.
  const before = { ...s.stats };
  const perDay = gdt / FR_DAY_MS;
  s.stats.food = Math.max(0, s.stats.food - FOOD_PER_DAY * perDay);
  s.stats.water = Math.max(0, s.stats.water - WATER_PER_DAY * perDay);
  const sec = gdt / 1000;
  if (s.torch > 0) {
    s.torch = Math.max(0, s.torch - dt);
    if (s.torch === 0) events.push({ type: 'torchOut' });
  }
  if (frInFireLight(s)) s.stats.warmth = Math.min(100, s.stats.warmth + 5 * sec);
  else if (s.torch > 0) s.stats.warmth = Math.min(100, s.stats.warmth + 1 * sec);
  else if (frIsNight(s) || s.loc === 'cave') s.stats.warmth = Math.max(0, s.stats.warmth - (s.loc === 'cave' ? 0.8 : 2) * sec);
  else s.stats.warmth = Math.min(100, s.stats.warmth + 1 * sec);
  const starving = s.stats.food <= 0 || s.stats.water <= 0 || s.stats.warmth <= 0;
  if (starving) s.stats.health = Math.max(0, s.stats.health - 0.5 * sec);
  else if (s.sleeping) s.stats.health = Math.min(100, s.stats.health + 0.5 * sec * (s.bed && s.shelter > 0 ? FR_BED_HEAL : 1));
  else if (s.stats.food > 30 && s.stats.water > 30) s.stats.health = Math.min(100, s.stats.health + 0.05 * sec);
  for (const k of ['food', 'water', 'warmth'] as const) {
    if (before[k] >= LOW && s.stats[k] < LOW) events.push({ type: 'low', stat: k });
  }

  // Погода. Первые две ночи дождя не бывает: время подготовить шалаш.
  const calm = s.day <= FR_CALM_DAYS && s.clock >= FR_EVENING_AT;
  if (calm && s.weather.rain) {
    s.weather = { rain: false, left: 60_000 };
    events.push({ type: 'rainEnd' });
  }
  s.weather.left -= gdt;
  if (s.weather.left <= 0 && calm) s.weather.left = 1000;
  else if (s.weather.left <= 0) {
    const n = (s.count.rainCycle ?? 0) + 1;
    s.count.rainCycle = n;
    const r = rand(s.seed + 31_000 + n * 101)();
    if (s.weather.rain) {
      s.weather = { rain: false, left: 200_000 + r * 240_000 };
      events.push({ type: 'rainEnd' });
    } else {
      s.weather = { rain: true, left: 40_000 + r * 40_000 };
      bump(s, 'rain');
      events.push({ type: 'rainStart' });
      if (s.shelter > 0) {
        s.shelter -= 1;
        if (s.shelter <= 0) {
          s.bed = false;
          events.push({ type: 'shelterBroke' });
        }
      }
    }
  }
  if (frRainHere(s)) {
    if (s.fire > 0 && !frFireSheltered(s)) {
      s.fire = 0;
      events.push({ type: 'fireDoused' });
      if (s.sleeping) {
        s.sleeping = false;
        events.push({ type: 'woke' });
      }
    }
    if (s.torch > 0 && !frInShelter(s)) s.torch = 0;
    if (!frInShelter(s) && !frInFireLight(s)) s.stats.warmth = Math.max(0, s.stats.warmth - 1 * sec);
  }

  events.push(...tickMobs(s, dt));

  // Костёр.
  if (s.fire > 0) {
    s.fire = Math.max(0, s.fire - gdt);
    if (s.fire === 0) {
      events.push({ type: 'fireOut' });
      if (s.loc !== 'home' && frHasPit(s)) {
        s.tiles[frIndex(s.pit.x, s.pit.y)] = 'grass';
        events.push({ type: 'campGone' });
      }
      if (s.sleeping) {
        s.sleeping = false;
        events.push({ type: 'woke' });
      }
    }
  }

  // Сутки.
  const was = s.clock;
  s.clock += gdt;
  if (was < FR_EVENING_AT && s.clock >= FR_EVENING_AT) {
    events.push({ type: 'evening' });
    spawnWolves(s, events);
  }
  if (s.clock >= FR_DAY_MS) {
    s.clock -= FR_DAY_MS;
    s.day += 1;
    s.treats += FR_NIGHT_REWARD;
    restock(s, rand(s.seed + s.day * 7919));
    spawnDay(s);
    if (s.sleeping) {
      s.sleeping = false;
      events.push({ type: 'woke' });
    }
    events.push({ type: 'morning', day: s.day, reward: FR_NIGHT_REWARD });
  }

  if (s.stats.health <= 0) {
    s.over = true;
    s.sleeping = false;
    s.path = [];
    events.push({ type: 'over' });
  }
  return events;
}

/** Проверяет сохранённый поход; что-то не так — null (начнётся новый). */
export function restoreForest(raw: unknown): FrState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as FrState;
  if (s.v !== 1 || !Array.isArray(s.tiles) || s.tiles.length !== FR_W * FR_H) return null;
  if (!Array.isArray(s.drops) || !Array.isArray(s.berries)) return null;
  // Старые сохранения хранили путь клетками — просто останавливаемся.
  if (!Array.isArray(s.pot)) s.pot = [];
  if (typeof s.torch !== 'number') s.torch = 0;
  if (!s.weather || typeof s.weather.left !== 'number') s.weather = { rain: false, left: FR_DRY_FIRST_MS };
  if (typeof s.shelter !== 'number') s.shelter = 0;
  if (typeof s.bed !== 'boolean') s.bed = false;
  if (!Array.isArray(s.worn)) s.worn = [];
  if (s.loc !== 'home' && s.loc !== 'lake' && s.loc !== 'cave') s.loc = 'home';
  if (!s.pit || typeof s.pit.x !== 'number') s.pit = { x: Math.floor(FR_W / 2), y: Math.floor(FR_H / 2) };
  if (!s.places || typeof s.places !== 'object') s.places = {};
  if (!Array.isArray(s.mobs)) s.mobs = [];
  if (s.loc === 'home' && !s.tiles.includes('exit')) addHomeExits(s);
  if (s.loc === 'home') s.mobs = s.mobs.filter((m) => m.kind !== 'wolf');
  s.trapNews = [];
  if (!s.mobs.length && !s.over) spawnDay(s);
  if (typeof s.chase !== 'number') s.chase = null;
  if (typeof s.atkCd !== 'number') s.atkCd = 0;
  if (!s.dur || typeof s.dur !== 'object') s.dur = {};
  if (!s.chest || typeof s.chest !== 'object') s.chest = {};
  // Старые сохранения (1.32–1.33) считали по-другому — переносим, что можно.
  const old = (s.count && typeof s.count === 'object' ? s.count : {}) as Record<string, number>;
  s.count = { ...old };
  for (const [to, from] of [['chop', 'chopped'], ['cook', 'cooked'], ['mine', 'mined']] as const) {
    const v = old[from];
    if (typeof v === 'number' && v > 0 && s.count[to] === undefined) s.count[to] = v;
    delete s.count[from];
  }
  if (!Array.isArray(s.claimed)) s.claimed = [];
  if (!Array.isArray(s.notified)) s.notified = [];
  if (!Array.isArray(s.path) || s.path.some((p) => !Array.isArray(p))) s.path = [];
  if (typeof s.x !== 'number' || typeof s.y !== 'number' || !s.stats || typeof s.clock !== 'number') return null;
  return s;
}

// --- Крафт, сундук, задания ---

export type FrCraftId = 'knife' | 'axe' | 'pickaxe' | 'flask' | 'torch' | 'chest' | 'loom' | 'trap' | 'rod' | 'ironaxe' | 'ironpick' | 'ironknife' | 'foundry' | 'campfire' | 'dryer';

/** Постройки: ставятся на выбранную клетку у костра. */
export const FR_BUILDINGS: readonly FrCraftId[] = ['chest', 'loom', 'foundry', 'dryer', 'campfire', 'trap'];

export const FR_CRAFT: ReadonlyArray<{ id: FrCraftId; cost: ReadonlyArray<readonly [FrItem, number]> }> = [
  { id: 'knife', cost: [['branch', 1], ['stone', 1]] },
  { id: 'pickaxe', cost: [['branch', 2], ['stone', 3], ['grass', 1]] },
  { id: 'flask', cost: [['grass', 3], ['branch', 1]] },
  { id: 'torch', cost: [['branch', 1], ['grass', 2]] },
  { id: 'axe', cost: [['branch', 2], ['stone', 2], ['grass', 1]] },
  { id: 'rod', cost: [['reed', 3], ['branch', 1]] },
  { id: 'ironknife', cost: [['ingot', 1], ['branch', 2]] },
  { id: 'ironaxe', cost: [['ingot', 3], ['branch', 3]] },
  { id: 'ironpick', cost: [['ingot', 4], ['branch', 3]] },
  { id: 'foundry', cost: [['stone', 15], ['branch', 5]] },
  { id: 'dryer', cost: [['branch', 10], ['cloth', 2], ['grass', 5]] },
  { id: 'campfire', cost: [['branch', 3], ['flint', 1]] },
  { id: 'chest', cost: [['branch', 6], ['grass', 4]] },
  { id: 'loom', cost: [['branch', 10], ['stone', 5], ['grass', 3]] },
  { id: 'trap', cost: [['cloth', 5], ['branch', 10]] },
];

export function frCanCraft(s: FrState, id: FrCraftId): boolean {
  const r = FR_CRAFT.find((x) => x.id === id);
  return !!r && r.cost.every(([item, n]) => (s.inv[item] ?? 0) >= n);
}

/** Клетки возле костровища, куда можно поставить сундук (трава и высокая трава без предметов). */
export function frChestSpots(s: FrState): number[] {
  const c = frCenter();
  const out: number[] = [];
  for (let y = c.y - 5; y <= c.y + 5; y++) {
    for (let x = c.x - 5; x <= c.x + 5; x++) {
      if (!inside(x, y) || Math.hypot(x - c.x, y - c.y) > 5.2 || (x === c.x && y === c.y)) continue;
      const i = frIndex(x, y);
      const tile = s.tiles[i];
      if ((tile === 'grass' || tile === 'tall') && !s.drops.some((d) => d.x === x && d.y === y) && frPassable(s, x, y)) out.push(i);
    }
  }
  return out;
}

/** Куда можно поставить ловушку: любая свободная трава подальше от костра. */
export function frTrapSpots(s: FrState): number[] {
  const c = frCenter(s);
  const out: number[] = [];
  for (let y = 0; y < FR_H; y++) {
    for (let x = 0; x < FR_W; x++) {
      const i = frIndex(x, y);
      const tile = s.tiles[i];
      if ((tile === 'grass' || tile === 'tall') && Math.hypot(x - c.x, y - c.y) > 2.5 && !s.drops.some((d) => d.x === x && d.y === y) && frPassable(s, x, y)) out.push(i);
    }
  }
  return out;
}

/** Свободные клетки рядом с питомцем, где можно развести маленький костёр. */
export function frCampSpots(s: FrState): number[] {
  const out: number[] = [];
  const px = Math.floor(s.x);
  const py = Math.floor(s.y);
  for (let y = py - 6; y <= py + 6; y++) {
    for (let x = px - 6; x <= px + 6; x++) {
      if (!inside(x, y) || Math.hypot(x - px, y - py) > 6.2) continue;
      const tile = s.tiles[frIndex(x, y)];
      if ((tile === 'grass' || tile === 'tall') && !s.drops.some((d) => d.x === x && d.y === y) && frPassable(s, x, y)) out.push(frIndex(x, y));
    }
  }
  return out;
}

/** Стоит ли на карте костровище (дома каменное, в походе — маленький костёр). */
export function frHasPit(s: FrState): boolean {
  return s.tiles[frIndex(s.pit.x, s.pit.y)] === 'pit';
}

/** Клетки для постройки выбранного здания. */
export function frPlaceSpots(s: FrState, id: FrCraftId): number[] {
  return id === 'trap' ? frTrapSpots(s) : id === 'campfire' ? frCampSpots(s) : frChestSpots(s);
}

export function frChestBuilt(s: FrState): boolean {
  return s.tiles.includes('chest');
}

export function frBuilt(s: FrState, id: FrCraftId): boolean {
  return s.tiles.includes(id as FrTile);
}

/** Смастерить предмет из материалов рюкзака. Топор — в рюкзак, сундук — рядом с костром. */
export function frCraft(s: FrState, id: FrCraftId, cell?: number): FrEvent[] {
  const r = FR_CRAFT.find((x) => x.id === id);
  if (!r || s.over) return [];
  if (!FR_BUILDINGS.includes(id) && id !== 'torch' && (s.inv[id as FrItem] ?? 0) + (id === 'flask' ? s.inv.fullflask ?? 0 : 0) > 0) return [{ type: 'haveIt' }];
  if (id === 'torch' && !canTake(s.inv, 'torch', frCapacity(s))) return [{ type: 'full' }];
  if (id === 'campfire') {
    if (s.loc === 'home') return [{ type: 'noPlace' }];
    if (frHasPit(s)) return [{ type: 'haveIt' }];
  } else if (FR_BUILDINGS.includes(id) && id !== 'trap') {
    if (frBuilt(s, id)) return [{ type: 'haveIt' }];
    if (s.loc !== 'home') return [{ type: 'noPlace' }];
  }
  if (!frCanCraft(s, id)) return [{ type: 'needMaterials' }];
  if (FR_BUILDINGS.includes(id) && (cell === undefined || !frPlaceSpots(s, id).includes(cell))) return [{ type: 'noPlace' }];
  for (const [item, n] of r.cost) take(s, item, n);
  if (id === 'torch') s.inv.torch = (s.inv.torch ?? 0) + 1;
  else if (!FR_BUILDINGS.includes(id)) {
    s.inv[id as FrItem] = 1;
    delete s.dur[id as FrTool];
  }
  else if (id === 'campfire') {
    s.tiles[cell!] = 'pit';
    s.pit = { x: cell! % FR_W, y: Math.floor(cell! / FR_W) };
    s.fire = FR_FIRE_START_MS * fireScale(s);
  } else s.tiles[cell!] = id as FrTile;
  bump(s, `craft:${id}`);
  return withQuest(s, [{ type: 'crafted', item: id }]);
}

/** Переложить n штук из рюкзака в сундук; возвращает, сколько переложилось. */
export function frChestPut(s: FrState, item: FrItem, n = 1): number {
  let moved = 0;
  while (moved < n && (s.inv[item] ?? 0) > 0 && canTake(s.chest, item)) {
    take(s, item, 1);
    s.chest[item] = (s.chest[item] ?? 0) + 1;
    moved++;
  }
  return moved;
}

/** Достать n штук из сундука в рюкзак; возвращает, сколько достали. */
export function frChestTake(s: FrState, item: FrItem, n = 1): number {
  let moved = 0;
  while (moved < n && (s.chest[item] ?? 0) > 0 && canTake(s.inv, item, frCapacity(s))) {
    const left = (s.chest[item] ?? 0) - 1;
    if (left > 0) s.chest[item] = left;
    else delete s.chest[item];
    s.inv[item] = (s.inv[item] ?? 0) + 1;
    moved++;
  }
  return moved;
}

function bump(s: FrState, key: string, n = 1): void {
  s.count[key] = (s.count[key] ?? 0) + n;
}

export interface FrQuestPart {
  /** Ключ счётчика: pick:branch, craft:axe, chop, mine, cook, fire, night. */
  key: string;
  need: number;
}

export interface FrQuest {
  id: string;
  /** default — долгие цели, regular — обычные задания. */
  kind: 'default' | 'regular';
  parts: readonly FrQuestPart[];
  /** Награда лакомствами (долгие цели). */
  reward: number;
  /** Награда предметами (обычные задания); забирается кнопкой «Получить». */
  items?: Partial<Record<FrItem, number>>;
}

export const FR_QUESTS: readonly FrQuest[] = [
  { id: 'start', kind: 'regular', reward: 0, items: { berries: 3 }, parts: [{ key: 'pick:branch', need: 3 }, { key: 'pick:flint', need: 1 }] },
  { id: 'fire', kind: 'regular', reward: 0, items: { stone: 2 }, parts: [{ key: 'fire', need: 1 }] },
  { id: 'knife', kind: 'regular', reward: 0, items: { berries: 2 }, parts: [{ key: 'craft:knife', need: 1 }] },
  { id: 'grass', kind: 'regular', reward: 0, items: { grass: 3 }, parts: [{ key: 'pick:grass', need: 2 }] },
  { id: 'axe', kind: 'regular', reward: 0, items: { stone: 3 }, parts: [{ key: 'craft:axe', need: 1 }] },
  { id: 'chop', kind: 'regular', reward: 0, items: { berries: 4 }, parts: [{ key: 'chop', need: 2 }] },
  { id: 'pickaxe', kind: 'regular', reward: 0, items: { stone: 2, grass: 2 }, parts: [{ key: 'craft:pickaxe', need: 1 }] },
  { id: 'mine', kind: 'regular', reward: 0, items: { mushroom: 3 }, parts: [{ key: 'mine', need: 1 }] },
  { id: 'flask', kind: 'regular', reward: 0, items: { berries: 3 }, parts: [{ key: 'craft:flask', need: 1 }] },
  { id: 'torch', kind: 'regular', reward: 0, items: { mushroom: 2 }, parts: [{ key: 'craft:torch', need: 1 }] },
  { id: 'porridge', kind: 'regular', reward: 0, items: { egg: 2 }, parts: [{ key: 'made:porridge', need: 1 }] },
  { id: 'loom', kind: 'regular', reward: 0, items: { stone: 2, branch: 3 }, parts: [{ key: 'craft:loom', need: 1 }] },
  { id: 'purse', kind: 'regular', reward: 0, items: { berries: 4 }, parts: [{ key: 'craft:purse', need: 1 }] },
  { id: 'shelter', kind: 'regular', reward: 1, parts: [{ key: 'craft:shelter', need: 1 }] },
  { id: 'rod', kind: 'regular', reward: 0, items: { berries: 3 }, parts: [{ key: 'craft:rod', need: 1 }] },
  { id: 'fish', kind: 'regular', reward: 0, items: { stone: 2 }, parts: [{ key: 'pick:fish', need: 2 }] },
  { id: 'foundry', kind: 'regular', reward: 0, items: { branch: 3 }, parts: [{ key: 'craft:foundry', need: 1 }] },
  { id: 'ironpick', kind: 'regular', reward: 0, items: { ingot: 3 }, parts: [{ key: 'craft:ironpick', need: 1 }] },
  { id: 'hunt', kind: 'regular', reward: 0, items: { cooked: 1 }, parts: [{ key: 'kill', need: 2 }] },
  { id: 'cook', kind: 'regular', reward: 0, items: { cooked: 2 }, parts: [{ key: 'cook', need: 1 }] },
  { id: 'chest', kind: 'regular', reward: 0, items: { stone: 3, berries: 3 }, parts: [{ key: 'craft:chest', need: 1 }] },
  { id: 'cook5', kind: 'default', reward: 3, parts: [{ key: 'cook', need: 5 }] },
  { id: 'rocks5', kind: 'default', reward: 3, parts: [{ key: 'mine', need: 5 }] },
  { id: 'nights5', kind: 'default', reward: 5, parts: [{ key: 'night', need: 5 }] },
];

/** Сколько сделано по пункту задания (без ограничения сверху). */
export function frCounter(s: FrState, key: string): number {
  return key === 'night' ? s.day - 1 : s.count[key] ?? 0;
}

export function frQuestDone(s: FrState, q: FrQuest): boolean {
  return q.parts.every((p) => frCounter(s, p.key) >= p.need);
}

export type FrQuestState = 'progress' | 'ready' | 'claimed';

export function frQuestState(s: FrState, q: FrQuest): FrQuestState {
  if (s.claimed.includes(q.id)) return 'claimed';
  return frQuestDone(s, q) ? 'ready' : 'progress';
}

/** Забрать награду за выполненное задание. */
export function frClaim(s: FrState, id: string): FrEvent[] {
  const q = FR_QUESTS.find((x) => x.id === id);
  if (!q || frQuestState(s, q) !== 'ready') return [];
  // Награда предметами должна поместиться в рюкзак.
  const probe: FrState['inv'] = { ...s.inv };
  for (const [it, n] of Object.entries(q.items ?? {}) as Array<[FrItem, number]>) {
    for (let k = 0; k < n; k++) {
      if (!canTake(probe, it, frCapacity(s))) return [{ type: 'full' }];
      probe[it] = (probe[it] ?? 0) + 1;
    }
  }
  s.inv = probe;
  s.claimed.push(id);
  s.treats += q.reward;
  return [{ type: 'questDone', id, reward: q.reward }];
}

/** Сообщает о заданиях, которые только что стали выполненными. */
function withQuest(s: FrState, events: FrEvent[]): FrEvent[] {
  for (const q of FR_QUESTS) {
    if (s.notified.includes(q.id) || !frQuestDone(s, q)) continue;
    s.notified.push(q.id);
    events.push({ type: 'questReady', id: q.id });
  }
  return events;
}

// --- Ткацкий станок и кошелёк ---

/** Что нужно для пункта задания «изготовь / построй / приготовь»: список материалов или null. */
export function frPartCost(key: string): ReadonlyArray<readonly [FrItem, number]> | null {
  if (key.startsWith('craft:')) {
    const id = key.slice(6);
    return FR_CRAFT.find((r) => r.id === id)?.cost ?? FR_LOOM.find((r) => r.id === id)?.cost ?? null;
  }
  if (key.startsWith('made:')) {
    const out = key.slice(5);
    const r = FR_RECIPES.find((x) => x.to === out);
    if (!r) return null;
    const cost: Array<[FrItem, number]> = [];
    for (const it of r.from) {
      const e = cost.find((c) => c[0] === it);
      if (e) e[1]++;
      else cost.push([it, 1]);
    }
    return cost;
  }
  return null;
}

/** Скоро ли дождь: за полминуты до начала (в безопасные ночи дождя нет). */
export const FR_RAIN_WARN_MS = 30_000;
export function frRainSoon(s: FrState): boolean {
  const calm = s.day <= FR_CALM_DAYS && s.clock >= FR_EVENING_AT;
  return s.loc !== 'cave' && !s.weather.rain && !calm && s.weather.left <= FR_RAIN_WARN_MS;
}

export type FrLoomId = 'cloth' | 'purse' | 'shelter' | 'bed';

export const FR_LOOM: ReadonlyArray<{ id: FrLoomId; cost: ReadonlyArray<readonly [FrItem, number]> }> = [
  { id: 'cloth', cost: [['grass', 3]] },
  { id: 'purse', cost: [['cloth', 3], ['grass', 5]] },
  { id: 'shelter', cost: [['cloth', 10], ['branch', 5], ['stone', 3], ['grass', 5]] },
  { id: 'bed', cost: [['cloth', 5], ['grass', 5]] },
];

/** Уже есть то, что делать второй раз не нужно (шалаш, лежанка). */
export function frLoomDone(s: FrState, id: FrLoomId): boolean {
  if (id === 'shelter') return s.shelter > 0;
  if (id === 'bed') return s.bed;
  return false;
}

export function frCanWeave(s: FrState, id: FrLoomId): boolean {
  const r = FR_LOOM.find((x) => x.id === id);
  if (id === 'bed' && s.shelter <= 0) return false;
  if (frLoomDone(s, id)) return false;
  return !!r && r.cost.every(([item, n]) => (s.inv[item] ?? 0) >= n);
}

/** Соткать ткань или сшить кошелёк на станке. */
export function frWeave(s: FrState, id: FrLoomId): FrEvent[] {
  const r = FR_LOOM.find((x) => x.id === id);
  if (!r || s.over || !frBuilt(s, 'loom')) return [];
  if (!frCanWeave(s, id)) return [{ type: 'needMaterials' }];
  if (id === 'shelter' || id === 'bed') {
    for (const [item, n] of r.cost) take(s, item, n);
    if (id === 'shelter') s.shelter = FR_SHELTER_RAINS;
    else s.bed = true;
    bump(s, `craft:${id}`);
    return withQuest(s, [{ type: 'crafted', item: id }]);
  }
  for (const [item, n] of r.cost) take(s, item, n);
  if (!canTake(s.inv, id, frCapacity(s))) {
    for (const [item, n] of r.cost) s.inv[item] = (s.inv[item] ?? 0) + n;
    return [{ type: 'full' }];
  }
  s.inv[id] = (s.inv[id] ?? 0) + 1;
  bump(s, `craft:${id}`);
  return withQuest(s, [{ type: 'crafted', item: id }]);
}

/** Надеть кошелёк в свободный верхний слот: рюкзак растёт на 4 ячейки. */
export function frWear(s: FrState, item: FrItem): FrEvent[] {
  if (s.over || item !== 'purse' || !(s.inv.purse ?? 0) || s.worn.length >= FR_GEAR_SLOTS) return [];
  take(s, 'purse', 1);
  s.worn.push('purse');
  return [{ type: 'worn', item }];
}

/** Снять кошелёк обратно в рюкзак; нужно, чтобы вещи поместились в уменьшенный рюкзак. */
export function frUnwear(s: FrState, index: number): FrEvent[] {
  const item = s.worn[index];
  if (!item) return [];
  const rest: FrState['inv'] = { ...s.inv, [item]: (s.inv[item] ?? 0) + 1 };
  if (frSlotsUsed(rest) > frCapacity(s) - FR_PURSE_BONUS) return [{ type: 'noRoom' }];
  s.worn.splice(index, 1);
  s.inv = rest;
  return [];
}

// --- Монстры ---

export type FrMobKind = 'mouse' | 'rabbit' | 'wolf';

export interface FrMob {
  id: number;
  kind: FrMobKind;
  x: number;
  y: number;
  hp: number;
  /** Питомец уже ударил: мышь и кролик перестают убегать и дерутся. */
  provoked: boolean;
  /** Волк заметил питомца. */
  angry: boolean;
  /** Перезарядка удара, мс. */
  cd: number;
  /** Куда бредёт, пока никого не боится. */
  wx: number;
  wy: number;
}

export const FR_MOBS: Record<FrMobKind, { hp: number; dmg: number; speed: number; flee: boolean; meat: number }> = {
  mouse: { hp: 6, dmg: 2, speed: 2.2, flee: true, meat: 0 },
  rabbit: { hp: 12, dmg: 4, speed: 2.6, flee: true, meat: 1 },
  wolf: { hp: 30, dmg: 9, speed: 2.8, flee: false, meat: 2 },
};

const MOB_SCARE = 3;
const MOB_HIT_MS = 1200;
const WOLF_NOTICE = 4;
const WOLF_NOTICE_GRASS = 2;
const PET_HIT_MS = 800;
export const FR_PET_DMG = 5;
export const FR_AXE_DMG = 8;
export const FR_IRON_DMG = 12;

/** Монстры к костру не подходят: рядом с горящим костром — весь круг света. */
function mobBlocked(s: FrState, x: number, y: number): boolean {
  const c = frCenter(s);
  const r = s.fire > 0 ? frFireRadius(s) : 1.5;
  if (frHasPit(s) && Math.hypot(x - (c.x + 0.5), y - (c.y + 0.5)) <= r) return true;
  return !frWalkable(s, Math.floor(x), Math.floor(y));
}

function spawnSpot(s: FrState, r: Rand): { x: number; y: number } | null {
  const c = frCenter(s);
  for (let k = 0; k < 60; k++) {
    const x = 1 + Math.floor(r() * (FR_W - 2));
    const y = 1 + Math.floor(r() * (FR_H - 2));
    if (Math.hypot(x - c.x, y - c.y) < 8 || Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) < 5) continue;
    if (!frWalkable(s, x, y) || s.mobs.some((m) => Math.floor(m.x) === x && Math.floor(m.y) === y)) continue;
    return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

function addMob(s: FrState, kind: FrMobKind, r: Rand): FrMob | null {
  const p = spawnSpot(s, r);
  if (!p) return null;
  const m: FrMob = { id: s.nextId++, kind, x: p.x, y: p.y, hp: FR_MOBS[kind].hp, provoked: false, angry: false, cd: 0, wx: p.x, wy: p.y };
  s.mobs.push(m);
  return m;
}

/** Новый день: волки уходят, остаются мыши и кролики. */
function spawnDay(s: FrState): void {
  const r = rand(s.seed + 77_000 + s.day * 131);
  s.mobs = s.mobs.filter((m) => m.kind !== 'wolf' && m.provoked);
  if (s.chase !== null && !s.mobs.some((m) => m.id === s.chase)) s.chase = null;
  const have = (k: FrMobKind): number => s.mobs.filter((m) => m.kind === k).length;
  const mice = s.loc === 'lake' ? 2 : 3;
  const rabbits = s.loc === 'lake' ? 3 : s.loc === 'cave' ? 0 : 2;
  while (have('mouse') < mice) if (!addMob(s, 'mouse', r)) break;
  while (have('rabbit') < rabbits) if (!addMob(s, 'rabbit', r)) break;
  if (s.loc === 'cave') while (have('wolf') < 1) if (!addMob(s, 'wolf', r)) break;
}

/** Вечером приходят волки: один, со временем два. */
function spawnWolves(s: FrState, events: FrEvent[]): void {
  // Дома волков нет вообще; в пещере волк живёт и днём.
  if (s.loc === 'home' || s.loc === 'cave') return;
  const r = rand(s.seed + 88_000 + s.day * 17);
  const n = s.day >= 4 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    if (s.mobs.filter((m) => m.kind === 'wolf').length >= n) break;
    if (addMob(s, 'wolf', r)) events.push({ type: 'mobAppeared', kind: 'wolf' });
  }
}

/** Ударить монстра: питомец идёт к нему и бьёт, пока тот жив. */
export function frAttack(s: FrState, id: number): FrEvent[] {
  const m = s.mobs.find((x) => x.id === id);
  if (!m || s.over) return [];
  s.chase = id;
  s.goal = null;
  s.busy = null;
  if (s.sleeping) s.sleeping = false;
  return [];
}

/** Монстр под пальцем (в пределах клетки). */
export function frMobAt(s: FrState, x: number, y: number): FrMob | null {
  let best: FrMob | null = null;
  let bd = 0.9;
  for (const m of s.mobs) {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

function moveMob(s: FrState, m: FrMob, dx: number, dy: number, dt: number): boolean {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return false;
  const step = (FR_MOBS[m.kind].speed * dt) / 1000;
  const angles = [0, 0.6, -0.6, 1.2, -1.2];
  for (const a of angles) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ux = (dx * ca - dy * sa) / len;
    const uy = (dx * sa + dy * ca) / len;
    const nx = m.x + ux * step;
    const ny = m.y + uy * step;
    if (!mobBlocked(s, nx, ny)) {
      m.x = nx;
      m.y = ny;
      const ti = frIndex(Math.floor(nx), Math.floor(ny));
      if (s.tiles[ti] === 'trap' && FR_MOBS[m.kind].flee) {
        s.tiles[ti] = 'trapfull';
        s.mobs = s.mobs.filter((x) => x.id !== m.id);
        if (s.chase === m.id) s.chase = null;
        s.trapNews.push(m.kind);
      }
      return true;
    }
  }
  return false;
}

function tickMobs(s: FrState, dt: number): FrEvent[] {
  const ev: FrEvent[] = [];
  s.trapNews = [];
  if (s.atkCd > 0) s.atkCd = Math.max(0, s.atkCd - dt);

  // Питомец бьёт того, за кем гонится.
  if (s.chase !== null) {
    const m = s.mobs.find((x) => x.id === s.chase);
    if (!m) s.chase = null;
    else {
      const d = Math.hypot(m.x - s.x, m.y - s.y);
      if (d <= 1.15) {
        s.path = [];
        s.facing = m.x >= s.x ? 1 : -1;
        if (s.atkCd <= 0) {
          const dmg = (s.inv.ironaxe ?? 0) > 0 ? FR_IRON_DMG : (s.inv.axe ?? 0) > 0 ? FR_AXE_DMG : FR_PET_DMG;
          m.hp -= dmg;
          m.provoked = true;
          m.angry = true;
          s.atkCd = PET_HIT_MS;
          ev.push({ type: 'petHit', kind: m.kind, dmg });
          if (m.hp <= 0) {
            s.mobs = s.mobs.filter((x) => x.id !== m.id);
            s.chase = null;
            bump(s, 'kill');
            const meat = FR_MOBS[m.kind].meat;
            for (let k = 0; k < meat; k++) {
              if (canTake(s.inv, 'meat', frCapacity(s))) s.inv.meat = (s.inv.meat ?? 0) + 1;
              else dropNear(s, 'meat', Math.floor(m.x), Math.floor(m.y));
            }
            ev.push({ type: 'mobKilled', kind: m.kind });
          }
        }
      } else if (!s.path.length || Math.hypot(s.path[s.path.length - 1]![0] - m.x, s.path[s.path.length - 1]![1] - m.y) > 1) {
        const path = route(s, m.x, m.y);
        if (path) s.path = path;
      }
    }
  }

  // В высокой траве питомца не видно: мыши и кролики не замечают его.
  const hidden = s.tiles[frIndex(Math.floor(s.x), Math.floor(s.y))] === 'tall';
  for (const m of s.mobs) {
    const def = FR_MOBS[m.kind];
    if (m.cd > 0) m.cd = Math.max(0, m.cd - dt);
    const d = Math.hypot(s.x - m.x, s.y - m.y);
    const safe = frInFireLight(s) || (s.fire <= 0 && frInShelter(s));
    if (m.kind === 'wolf' && !m.angry && d <= (hidden ? WOLF_NOTICE_GRASS : WOLF_NOTICE) && !safe) m.angry = true;
    if (safe) m.angry = m.provoked = false;
    if (m.angry && d > 9) m.angry = false;
    const fights = (def.flee ? m.provoked : m.angry) && !safe;
    if (fights) {
      if (d > 0.95) moveMob(s, m, s.x - m.x, s.y - m.y, dt);
      else if (m.cd <= 0 && !s.over) {
        m.cd = MOB_HIT_MS;
        s.stats.health = Math.max(0, s.stats.health - def.dmg);
        ev.push({ type: 'hurt', kind: m.kind, dmg: def.dmg });
      }
    } else if (def.flee && d <= MOB_SCARE && !safe && !hidden) {
      moveMob(s, m, m.x - s.x, m.y - s.y, dt);
    } else {
      // Бродит без дела.
      if (Math.hypot(m.wx - m.x, m.wy - m.y) < 0.3 || mobBlocked(s, m.wx, m.wy)) {
        const r = rand(s.seed + Math.floor(m.x * 91 + m.y * 37 + m.id * 13 + s.clock / 700))();
        m.wx = m.x + (r - 0.5) * 6;
        m.wy = m.y + (rand(s.seed + Math.floor(r * 1e6))() - 0.5) * 6;
      }
      const slow = s.sleeping ? 0.3 : 0.45;
      const saved = def.speed;
      def.speed = saved * slow;
      moveMob(s, m, m.wx - m.x, m.wy - m.y, dt);
      def.speed = saved;
    }
  }
  for (const k of s.trapNews) ev.push({ type: 'trapped', kind: k });
  return ev;
}

// --- Сушилка ---

/** Что сушится: сырьё + 1 соль → вяленое. */
export const FR_DRY: ReadonlyArray<{ from: FrItem; to: FrItem }> = [
  { from: 'meat', to: 'jerky' },
  { from: 'fish', to: 'driedfish' },
];

export function frCanDry(s: FrState, from: FrItem): boolean {
  return frBuilt(s, 'dryer') && (s.inv[from] ?? 0) >= 1 && (s.inv.salt ?? 0) >= 1 && FR_DRY.some((d) => d.from === from);
}

/** Засушить одну штуку мяса или рыбы с солью. */
export function frDry(s: FrState, from: FrItem): FrEvent[] {
  const d = FR_DRY.find((x) => x.from === from);
  if (s.over || !d || !frBuilt(s, 'dryer')) return [];
  if (!frCanDry(s, from)) return [{ type: 'needMaterials' }];
  take(s, from, 1);
  take(s, 'salt', 1);
  s.inv[d.to] = (s.inv[d.to] ?? 0) + 1;
  bump(s, `pick:${d.to}`);
  return [{ type: 'dried' }];
}

// --- Литейная ---

/** Сколько руды нужно на один слиток. */
export const FR_SMELT_ORE = 2;

export function frCanSmelt(s: FrState): boolean {
  return frBuilt(s, 'foundry') && (s.inv.ore ?? 0) >= FR_SMELT_ORE;
}

/** Переплавить руду в железный слиток. */
export function frSmelt(s: FrState): FrEvent[] {
  if (s.over || !frBuilt(s, 'foundry')) return [];
  if (!frCanSmelt(s)) return [{ type: 'needMaterials' }];
  take(s, 'ore', FR_SMELT_ORE);
  if (!canTake(s.inv, 'ingot', frCapacity(s))) {
    s.inv.ore = (s.inv.ore ?? 0) + FR_SMELT_ORE;
    return [{ type: 'full' }];
  }
  s.inv.ingot = (s.inv.ingot ?? 0) + 1;
  bump(s, 'pick:ingot');
  return withQuest(s, [{ type: 'smelted' }]);
}
