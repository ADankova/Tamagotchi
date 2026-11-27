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
export const FR_STACK = 10;
/** Скорость ходьбы, клеток в секунду. */
const SPEED = 3;
/** Сколько длится сбор или еда, мс. */
export const FR_ACTION_MS = 700;
/** Огонь: сколько горит после разжигания, сколько добавляет ветка, предел. */
export const FR_FIRE_START_MS = 120_000;
export const FR_FIRE_BRANCH_MS = 40_000;
export const FR_FIRE_MAX_MS = 240_000;
/** Радиус света костра, клеток. */
export const FR_FIRE_RADIUS = 3.5;
/** Лакомств за прожитую ночь. */
export const FR_NIGHT_REWARD = 2;

export type FrTile = 'grass' | 'water' | 'tree' | 'bush' | 'pit' | 'chest' | 'tall' | 'rock';
export type FrItem = 'branch' | 'stone' | 'flint' | 'grass' | 'mushroom' | 'berries' | 'cooked' | 'axe' | 'knife' | 'pickaxe';
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
  | { type: 'chopped' }
  | { type: 'crafted'; item: FrCraftId }
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
  | { type: 'needPickaxe' }
  | { type: 'mined' }
  | { type: 'cut' }
  | { type: 'evening' }
  | { type: 'morning'; day: number; reward: number }
  | { type: 'woke' }
  | { type: 'low'; stat: FrStat }
  | { type: 'over' };

const BLOCKING: ReadonlySet<FrTile> = new Set(['water', 'tree', 'bush', 'pit', 'rock']);

export const frIndex = (x: number, y: number): number => y * FR_W + x;
const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < FR_W && y < FR_H;
export const frCenter = (): { x: number; y: number } => ({ x: Math.floor(FR_W / 2), y: Math.floor(FR_H / 2) });

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
  if (s.clock < FR_EVENING_AT) return 0;
  if (s.clock < FR_NIGHT_AT) return (s.clock - FR_EVENING_AT) / (FR_NIGHT_AT - FR_EVENING_AT);
  // Перед рассветом светлеет за последние 15 секунд.
  const dawn = FR_DAY_MS - s.clock;
  return dawn < 15_000 ? dawn / 15_000 : 1;
}

/** Стоит ли питомец в свете костра. */
export function frInFireLight(s: FrState): boolean {
  if (s.fire <= 0) return false;
  const c = frCenter();
  return Math.hypot(s.x - (c.x + 0.5), s.y - (c.y + 0.5)) <= FR_FIRE_RADIUS;
}

export function frSlotsUsed(inv: FrState['inv']): number {
  return Object.values(inv).reduce((sum, n) => sum + Math.ceil((n ?? 0) / FR_STACK), 0);
}

function canTake(inv: FrState['inv'], item: FrItem): boolean {
  const n = inv[item] ?? 0;
  return n % FR_STACK !== 0 || frSlotsUsed(inv) < FR_SLOTS;
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
  return s;
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
  const c = frCenter();
  const free: number[] = [];
  const taken = new Set(s.drops.map((d) => frIndex(d.x, d.y)));
  const reach = reachable(s, c.x, c.y + 1);
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
  | { kind: 'rock' }
  | { kind: 'tall'; x: number; y: number };

export type FrAction = 'pick' | 'chop' | 'drink' | 'light' | 'feed' | 'cook' | 'sleep' | 'open' | 'mine' | 'cut';

export function frTargetAt(s: FrState, x: number, y: number): FrTarget | null {
  if (!inside(x, y)) return null;
  const tile = s.tiles[frIndex(x, y)]!;
  if (tile === 'grass') {
    const drop = s.drops.find((d) => d.x === x && d.y === y);
    return drop ? { kind: 'drop', drop } : { kind: 'ground' };
  }
  if (tile === 'tall') return { kind: 'tall', x, y };
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
      return ['drink'];
    case 'pit':
      return s.fire > 0 ? ['feed', 'cook', 'sleep'] : ['light'];
    case 'chest':
      return ['open'];
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
  const i = frIndex(x, y);
  const tile = s.tiles[i];
  const cx = x + 0.5;
  const cy = y + 0.5;
  let dest: [number, number] | null = null;
  if (!action) dest = point ?? [cx, cy];
  else if (tile === 'grass' || tile === 'chest' || tile === 'tall') dest = [cx, cy];
  else if (tile === 'tree' || tile === 'bush' || tile === 'rock') {
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

function arrive(s: FrState): FrEvent[] {
  const goal = s.goal;
  s.goal = null;
  if (!goal) return [];
  faceTo(s, goal.cell);
  switch (goal.action) {
    case 'pick': {
      if (goal.id !== undefined) {
        const d = s.drops.find((it) => it.id === goal.id);
        if (!d) return [];
        if (d.kind === 'grass' && !(s.inv.knife ?? 0)) return [{ type: 'needKnife' }];
        if (!canTake(s.inv, d.kind)) return [{ type: 'full' }];
        s.drops = s.drops.filter((it) => it.id !== d.id);
        s.inv[d.kind] = (s.inv[d.kind] ?? 0) + 1;
        bump(s, `pick:${d.kind}`);
        s.busy = { kind: 'gather', left: FR_ACTION_MS };
        return [{ type: 'picked', item: d.kind }];
      }
      if (s.tiles[goal.cell] !== 'bush') return [];
      if (!s.berries.includes(goal.cell)) return [{ type: 'empty' }];
      if (!canTake(s.inv, 'berries')) return [{ type: 'full' }];
      s.berries = s.berries.filter((b) => b !== goal.cell);
      s.inv.berries = (s.inv.berries ?? 0) + 2;
      bump(s, 'pick:berries', 2);
      s.busy = { kind: 'gather', left: FR_ACTION_MS };
      return [{ type: 'picked', item: 'berries' }];
    }
    case 'drink':
      s.stats.water = Math.min(100, s.stats.water + 30);
      s.busy = { kind: 'drink', left: FR_ACTION_MS };
      return [{ type: 'drank' }];
    case 'chop': {
      if (!(s.inv.axe ?? 0)) return [{ type: 'needAxe' }];
      if (s.tiles[goal.cell] !== 'tree') return [];
      if (!canTake(s.inv, 'branch')) return [{ type: 'full' }];
      s.tiles[goal.cell] = 'grass';
      s.inv.branch = (s.inv.branch ?? 0) + 2;
      bump(s, 'chop');
      s.busy = { kind: 'gather', left: FR_ACTION_MS * 2 };
      return [{ type: 'chopped' }];
    }
    case 'open':
      return [{ type: 'openChest' }];
    case 'mine': {
      if (!(s.inv.pickaxe ?? 0)) return [{ type: 'needPickaxe' }];
      if (s.tiles[goal.cell] !== 'rock') return [];
      if (!canTake(s.inv, 'stone')) return [{ type: 'full' }];
      s.tiles[goal.cell] = 'grass';
      s.inv.stone = (s.inv.stone ?? 0) + 3;
      if ((s.count.mine ?? 0) % 2 === 0 && canTake(s.inv, 'flint')) {
        s.inv.flint = (s.inv.flint ?? 0) + 1;
        bump(s, 'pick:flint');
      }
      bump(s, 'pick:stone', 3);
      bump(s, 'mine');
      s.busy = { kind: 'gather', left: FR_ACTION_MS * 2 };
      return [{ type: 'mined' }];
    }
    case 'cut': {
      if (!(s.inv.knife ?? 0)) return [{ type: 'needKnife' }];
      if (s.tiles[goal.cell] !== 'tall') return [];
      if (!canTake(s.inv, 'grass')) return [{ type: 'full' }];
      s.tiles[goal.cell] = 'grass';
      s.inv.grass = (s.inv.grass ?? 0) + 1;
      bump(s, 'pick:grass');
      s.busy = { kind: 'gather', left: FR_ACTION_MS };
      return [{ type: 'cut' }];
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
    s.fire = Math.min(FR_FIRE_MAX_MS, s.fire + FR_FIRE_BRANCH_MS);
    return [{ type: 'fireFed' }];
  }
  if (branches < 3 || (s.inv.flint ?? 0) < 1) return [{ type: 'needForFire' }];
  take(s, 'branch', 3);
  take(s, 'flint', 1);
  s.fire = FR_FIRE_START_MS;
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
export const FR_RECIPES: ReadonlyArray<{ from: readonly FrItem[]; to: FrItem }> = [{ from: ['mushroom'], to: 'cooked' }];

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
export function frPotCook(s: FrState): FrEvent[] {
  if (s.fire <= 0) return [{ type: 'needForFire' }];
  const out = frRecipe(s.pot);
  if (!out) return [{ type: 'nothingToCook' }];
  s.pot = [];
  s.inv[out] = (s.inv[out] ?? 0) + 1;
  bump(s, 'cook');
  return withQuest(s, [{ type: 'cooked', item: out }]);
}

/** Сколько сытости даёт еда из рюкзака. */
export const FR_FOOD: Partial<Record<FrItem, number>> = { berries: 10, mushroom: 5, cooked: 25 };

export function frEat(s: FrState, item: FrItem): FrEvent[] {
  const value = FR_FOOD[item];
  if (s.over || !value || !(s.inv[item] ?? 0)) return [];
  take(s, item, 1);
  s.stats.food = Math.min(100, s.stats.food + value);
  s.busy = { kind: 'eat', left: FR_ACTION_MS };
  s.path = [];
  s.goal = null;
  return [{ type: 'ate', item }];
}

/** Выбросить одну штуку: кладётся на землю рядом с питомцем (если есть свободное место). */
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
  if (frInFireLight(s)) s.stats.warmth = Math.min(100, s.stats.warmth + 5 * sec);
  else if (frIsNight(s)) s.stats.warmth = Math.max(0, s.stats.warmth - 2 * sec);
  else s.stats.warmth = Math.min(100, s.stats.warmth + 1 * sec);
  const starving = s.stats.food <= 0 || s.stats.water <= 0 || s.stats.warmth <= 0;
  if (starving) s.stats.health = Math.max(0, s.stats.health - 0.5 * sec);
  else if (s.sleeping) s.stats.health = Math.min(100, s.stats.health + 0.5 * sec);
  else if (s.stats.food > 30 && s.stats.water > 30) s.stats.health = Math.min(100, s.stats.health + 0.05 * sec);
  for (const k of ['food', 'water', 'warmth'] as const) {
    if (before[k] >= LOW && s.stats[k] < LOW) events.push({ type: 'low', stat: k });
  }

  // Костёр.
  if (s.fire > 0) {
    s.fire = Math.max(0, s.fire - gdt);
    if (s.fire === 0) {
      events.push({ type: 'fireOut' });
      if (s.sleeping) {
        s.sleeping = false;
        events.push({ type: 'woke' });
      }
    }
  }

  // Сутки.
  const was = s.clock;
  s.clock += gdt;
  if (was < FR_EVENING_AT && s.clock >= FR_EVENING_AT) events.push({ type: 'evening' });
  if (s.clock >= FR_DAY_MS) {
    s.clock -= FR_DAY_MS;
    s.day += 1;
    s.treats += FR_NIGHT_REWARD;
    restock(s, rand(s.seed + s.day * 7919));
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

export type FrCraftId = 'knife' | 'axe' | 'pickaxe' | 'chest';

export const FR_CRAFT: ReadonlyArray<{ id: FrCraftId; cost: ReadonlyArray<readonly [FrItem, number]> }> = [
  { id: 'knife', cost: [['branch', 1], ['stone', 1]] },
  { id: 'pickaxe', cost: [['branch', 2], ['stone', 3], ['grass', 1]] },
  { id: 'axe', cost: [['branch', 2], ['stone', 2], ['grass', 1]] },
  { id: 'chest', cost: [['branch', 6], ['stone', 4], ['grass', 2]] },
];

export function frCanCraft(s: FrState, id: FrCraftId): boolean {
  const r = FR_CRAFT.find((x) => x.id === id);
  return !!r && r.cost.every(([item, n]) => (s.inv[item] ?? 0) >= n);
}

/** Клетка, где встанет сундук: рядом с костровищем. */
function chestSpot(s: FrState): number | null {
  const c = frCenter();
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [2, 1], [-2, 1], [2, -1], [-2, -1], [1, -2], [-1, -2]] as const) {
    const i = frIndex(c.x + dx, c.y + dy);
    if (s.tiles[i] === 'grass' && !s.drops.some((d) => d.x === c.x + dx && d.y === c.y + dy)) return i;
  }
  return null;
}

export function frChestBuilt(s: FrState): boolean {
  return s.tiles.includes('chest');
}

/** Смастерить предмет из материалов рюкзака. Топор — в рюкзак, сундук — рядом с костром. */
export function frCraft(s: FrState, id: FrCraftId): FrEvent[] {
  const r = FR_CRAFT.find((x) => x.id === id);
  if (!r || s.over) return [];
  if (id !== 'chest' && (s.inv[id] ?? 0) > 0) return [{ type: 'haveIt' }];
  if (id === 'chest' && frChestBuilt(s)) return [{ type: 'haveIt' }];
  if (!frCanCraft(s, id)) return [{ type: 'needMaterials' }];
  let spot: number | null = null;
  if (id === 'chest') {
    spot = chestSpot(s);
    if (spot === null) return [{ type: 'noPlace' }];
  }
  for (const [item, n] of r.cost) take(s, item, n);
  if (id !== 'chest') s.inv[id] = 1;
  else s.tiles[spot!] = 'chest';
  bump(s, `craft:${id}`);
  return withQuest(s, [{ type: 'crafted', item: id }]);
}

/** Переложить одну штуку из рюкзака в сундук. */
export function frChestPut(s: FrState, item: FrItem): boolean {
  if (!(s.inv[item] ?? 0) || !canTake(s.chest, item)) return false;
  take(s, item, 1);
  s.chest[item] = (s.chest[item] ?? 0) + 1;
  return true;
}

/** Достать одну штуку из сундука в рюкзак. */
export function frChestTake(s: FrState, item: FrItem): boolean {
  if (!(s.chest[item] ?? 0) || !canTake(s.inv, item)) return false;
  const left = (s.chest[item] ?? 0) - 1;
  if (left > 0) s.chest[item] = left;
  else delete s.chest[item];
  s.inv[item] = (s.inv[item] ?? 0) + 1;
  return true;
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
  /** Награда — лакомства; забирается кнопкой «Получить». */
  reward: number;
}

export const FR_QUESTS: readonly FrQuest[] = [
  { id: 'start', kind: 'regular', reward: 1, parts: [{ key: 'pick:branch', need: 3 }, { key: 'pick:flint', need: 1 }] },
  { id: 'fire', kind: 'regular', reward: 1, parts: [{ key: 'fire', need: 1 }] },
  { id: 'knife', kind: 'regular', reward: 1, parts: [{ key: 'craft:knife', need: 1 }, { key: 'pick:grass', need: 2 }] },
  { id: 'axe', kind: 'regular', reward: 2, parts: [{ key: 'craft:axe', need: 1 }] },
  { id: 'chop', kind: 'regular', reward: 2, parts: [{ key: 'chop', need: 2 }] },
  { id: 'pickaxe', kind: 'regular', reward: 2, parts: [{ key: 'craft:pickaxe', need: 1 }] },
  { id: 'mine', kind: 'regular', reward: 2, parts: [{ key: 'mine', need: 1 }] },
  { id: 'cook', kind: 'regular', reward: 1, parts: [{ key: 'cook', need: 1 }] },
  { id: 'chest', kind: 'regular', reward: 2, parts: [{ key: 'craft:chest', need: 1 }] },
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
