import { getMood, getNeeds } from '../core/pet';
import type { ActionType, AdultForm, LifeStage, Pet, Species } from '../core/types';
import { bodyStage, SPECIES_LOOKS, TAIL_OVERLAP } from './species';
import { SPRITES, type SpriteName } from './sprites';

// Чистая функция «что нарисовать в момент t»: без DOM и без часов,
// поэтому анимации можно проверять тестами. Координаты — в логических пикселях экрана.

// Сетка экрана: чем она меньше, тем крупнее питомец на том же LCD.
export const SCREEN_W = 40;
export const SCREEN_H = 30;
export const GROUND_Y = SCREEN_H - 2;

/** Сколько длится анимация действия. У сна своей анимации нет — он состояние. */
export const ACTION_ANIM_MS: Readonly<Record<ActionType, number>> = {
  feed: 5600,
  snack: 2600,
  play: 2400,
  sleep: 0,
  clean: 1800,
  medicine: 1800,
};

const BOB_MS = 500;
/** Подход питомца к миске, мс. */
const FEED_WALK_MS = 2200;
/** Сколько летит брошенное лакомство, мс. */
const TREAT_FLIGHT_MS = 520;
/** Раз в сколько мс спящий питомец шевелит ухом или хвостом. */
const SLEEP_CYCLE_MS = 9000;
const BLINK_EVERY_MS = 4000;
const BLINK_MS = 160;
const EGG_WOBBLE = [0, 1, 0, -1] as const;
/** Места какашек на полу: сначала по краям, потом ближе к центру. */
export const POOP_SLOTS = [1, 34, 7, 28, 13, 22] as const;

export type AnimState =
  | 'egg'
  | 'idle'
  | 'sad'
  | 'sick'
  | 'sleeping'
  | 'dead'
  | 'eating'
  | 'snacking'
  | 'playing'
  | 'cleaning'
  | 'medicine'
  | 'hatching'
  | 'evolving'
  | 'dying';

export interface ActiveAction {
  action: ActionType;
  startedAt: number;
}

/**
 * Строка листа анимаций питомца: какую анимацию играть.
 * Первые шесть — прежние (9 кадров), остальные — плавные (17 кадров); если у стадии строки нет,
 * петArt подставляет ближайшую прежнюю.
 */
export type AnimRow =
  | 'idle'
  | 'sleep'
  | 'eat'
  | 'sick'
  | 'hungry'
  | 'tired'
  | 'idle_smooth'
  | 'catch'
  | 'walk'
  | 'eat_side'
  | 'lie_wag'
  | 'roll'
  | 'sleep_twitch';

/** Кадров в прежних строках листа. */
export const SHEET_FRAMES = 9;
/** Кадров в новых (плавных) строках. */
export const SMOOTH_FRAMES = 17;

export const ROW_FRAMES: Readonly<Record<AnimRow, number>> = {
  idle: SHEET_FRAMES,
  sleep: SHEET_FRAMES,
  eat: SHEET_FRAMES,
  sick: SHEET_FRAMES,
  hungry: SHEET_FRAMES,
  tired: SHEET_FRAMES,
  idle_smooth: SMOOTH_FRAMES,
  catch: SMOOTH_FRAMES,
  walk: SMOOTH_FRAMES,
  eat_side: SMOOTH_FRAMES,
  lie_wag: SMOOTH_FRAMES,
  roll: SMOOTH_FRAMES,
  sleep_twitch: SMOOTH_FRAMES,
};

const ANIM_FRAME_MS: Readonly<Record<AnimRow, number>> = {
  idle: 110,
  sleep: 200,
  eat: 130,
  sick: 140,
  hungry: 170,
  tired: 200,
  idle_smooth: 170,
  catch: 150,
  walk: 120,
  eat_side: 200,
  lie_wag: 160,
  roll: 200,
  sleep_twitch: 200,
};

/** Кадр анимации в момент t (мс от её начала); цикличный. */
export function animFrame(row: AnimRow, t: number, motion: number): number {
  return motion ? Math.floor(t / ANIM_FRAME_MS[row]) % ROW_FRAMES[row] : 0;
}

/** Кадр однократной анимации: после последнего кадра остаётся на нём. */
export function animFrameOnce(row: AnimRow, e: number, motion: number): number {
  return motion ? Math.min(ROW_FRAMES[row] - 1, Math.floor(Math.max(0, e) / ANIM_FRAME_MS[row])) : 0;
}

/** Длина одного прохода анимации, мс. */
export const animLength = (row: AnimRow): number => ROW_FRAMES[row] * ANIM_FRAME_MS[row];

export interface Placed {
  sprite: SpriteName;
  x: number;
  y: number;
  eyesClosed?: boolean;
  /** Только у тела питомца: строка и кадр цветной анимации. */
  anim?: AnimRow;
  frame?: number;
  /** Отразить картинку по горизонтали (боковые позы смотрят влево). */
  flip?: boolean;
}

/** Облачко запаха над какашкой: положение в клетках, размер и прозрачность. */
export interface Puff {
  x: number;
  y: number;
  r: number;
  a: number;
}

export interface Butterfly {
  /** Левый верхний угол в клетках; бабочка занимает около 8×8 клеток. */
  x: number;
  y: number;
  frame: number;
}

export const BUTTERFLY_FRAMES = 5;

export interface Scene {
  state: AnimState;
  /** Сон: экран притушен. */
  dim: boolean;
  /** Порядок отрисовки: первые — снизу. */
  items: Placed[];
  /** Бабочка из режима ожидания: питомец за ней гоняется. */
  butterfly?: Butterfly;
  /** Зеленоватый дымок над какашками. */
  puffs?: Puff[];
}

// --- Режим ожидания: неспешный распорядок, раз в минуту с лишним — охота на бабочку ---

/** Боковые позы нарисованы мордой вправо (если false) или влево (если true). */
const SIDE_FACES_LEFT = false as boolean;
/** Нужно ли отразить боковую позу, чтобы питомец смотрел вправо (heading) или влево. */
const flipFor = (headingRight: boolean): boolean => SIDE_FACES_LEFT === headingRight;

type IdleKind = 'stand' | 'walk' | 'lie' | 'roll';
interface IdleSeg {
  kind: IdleKind;
  ms: number;
  /** Смещение центра от середины экрана в начале и в конце отрезка, клетки. */
  from: number;
  to: number;
}

/** Скорость прогулки: 10 клеток за 3 секунды. */
const WALK_CELLS_PER_MS = 10 / 3000;
const walkSeg = (from: number, to: number): IdleSeg => ({ kind: 'walk', ms: Math.round(Math.abs(to - from) / WALK_CELLS_PER_MS), from, to });
const stay = (kind: IdleKind, ms: number, at: number): IdleSeg => ({ kind, ms, from: at, to: at });

const IDLE_PLAN: readonly IdleSeg[] = [
  stay('stand', 5000, 0),
  walkSeg(0, 8),
  stay('stand', 4000, 8),
  walkSeg(8, -8),
  stay('lie', 6000, -8),
  stay('roll', animLength('roll'), -8),
  stay('lie', 4000, -8),
  stay('stand', 3000, -8),
  walkSeg(-8, -3),
  stay('stand', 5000, -3),
  walkSeg(-3, 6),
  stay('lie', 7000, 6),
  stay('stand', 4000, 6),
  walkSeg(6, 0),
  stay('stand', 3000, 0),
];

const WALK_SPAN_MS = IDLE_PLAN.reduce((sum, seg) => sum + seg.ms, 0);
const CHASE_MS = 8000;
const IDLE_CYCLE_MS = WALK_SPAN_MS + CHASE_MS;

/** Идёт ли сейчас охота на бабочку (в миллисекундах от её начала). */
export function chaseTime(t: number): number | null {
  const c = t % IDLE_CYCLE_MS;
  return c >= WALK_SPAN_MS ? c - WALK_SPAN_MS : null;
}

interface IdlePose {
  kind: IdleKind;
  /** Смещение центра от середины, клетки. */
  offset: number;
  /** Сколько мс идёт текущий отрезок. */
  e: number;
  /** Идёт вправо. */
  right: boolean;
}

/** Где питомец и что делает в момент t вне охоты на бабочку. */
export function idlePose(t: number): IdlePose {
  let c = t % IDLE_CYCLE_MS;
  for (const seg of IDLE_PLAN) {
    if (c < seg.ms) {
      const k = seg.ms > 0 ? c / seg.ms : 0;
      return { kind: seg.kind, offset: seg.from + (seg.to - seg.from) * k, e: c, right: seg.to > seg.from };
    }
    c -= seg.ms;
  }
  return { kind: 'stand', offset: 0, e: 0, right: false };
}

interface Chase {
  /** Центр питомца по горизонтали, клетки. */
  cx: number;
  /** Подъём над полом, клетки (отрицательный dy). */
  lift: number;
  butterfly: Butterfly;
}

/** Где бабочка и питомец в момент e мс охоты. Кошка прыгает, собака хватает зубами, пушистик бегает кругами. */
export function chaseFrame(species: Species, e: number, t: number): Chase {
  const mid = SCREEN_W / 2;
  const tau = Math.PI * 2;
  const wave = (v: number) => Math.sin(tau * v);
  // Влёт справа и вылет вверх в конце.
  const entering = Math.max(0, 1 - e / 900);
  const leaving = Math.max(0, (e - (CHASE_MS - 900)) / 900);
  const fly = (x: number): Butterfly => ({
    x: Math.round(x - 4 + entering * 18),
    y: Math.round(5 + 2.5 * wave(e / 1100) - leaving * 14),
    frame: Math.floor(t / 90) % BUTTERFLY_FRAMES,
  });
  switch (species) {
    case 'cat': {
      const bx = mid + 9 * wave(e / 4200 + 0.1);
      const ph = (e % 1500) / 1500;
      const lift = ph < 0.6 ? Math.round(7 * Math.sin((Math.PI * ph) / 0.6)) : 0;
      return { cx: bx, lift, butterfly: fly(bx) };
    }
    case 'dog': {
      const bx = mid + 9 * wave(e / 4200 + 0.1);
      const px = mid + 9 * wave((e - 350) / 4200 + 0.1);
      const ph = (e % 2000) / 2000;
      const lift = ph < 0.25 ? Math.round(5 * Math.sin((Math.PI * ph) / 0.25)) : 0;
      return { cx: px, lift, butterfly: fly(bx) };
    }
    case 'blob': {
      const cx = mid + 12 * wave(e / 2000);
      const bx = mid + 3 * wave(e / 3000);
      return { cx, lift: 0, butterfly: fly(bx) };
    }
  }
}

export function stageSprite(stage: LifeStage, form?: AdultForm, species: Species = 'blob'): SpriteName {
  if (stage === 'egg') return 'egg';
  if (stage === 'dead') return 'grave';
  return SPECIES_LOOKS[species].bodies[bodyStage(stage, form)];
}

export function petSprite(pet: Pet): SpriteName {
  return stageSprite(pet.stage, pet.form, pet.species);
}

/** Кадры хвоста питомца, если он у него сейчас есть (у малыша, в яйце и после смерти — нет). */
export function petTail(pet: Pet): readonly [SpriteName, SpriteName] | null {
  if (pet.stage === 'egg' || pet.stage === 'baby' || pet.stage === 'dead') return null;
  return SPECIES_LOOKS[pet.species].tail ?? null;
}

/** Как часто виляет хвост: быстро — когда весело, никак — когда грустно, больно или сон. */
const WAG_MS: Partial<Record<AnimState, number>> = {
  idle: 400,
  eating: 180,
  snacking: 180,
  playing: 160,
  cleaning: 250,
  medicine: 300,
};

// --- Сценки смены стадии ---

export type CutsceneKind = 'hatch' | 'evolve' | 'death';

export interface Cutscene {
  kind: CutsceneKind;
  startedAt: number;
  from: SpriteName;
  to: SpriteName;
}

export const CUTSCENE_MS: Readonly<Record<CutsceneKind, number>> = {
  hatch: 2400,
  evolve: 2400,
  death: 2600,
};

/** Сценка, если между двумя состояниями одного питомца сменилась стадия. */
export function cutsceneFor(prev: Pet, next: Pet, t: number): Cutscene | null {
  if (prev.bornAt !== next.bornAt || prev.stage === next.stage || prev.stage === 'dead') return null;
  const kind: CutsceneKind = next.stage === 'dead' ? 'death' : prev.stage === 'egg' ? 'hatch' : 'evolve';
  return { kind, startedAt: t, from: petSprite(prev), to: petSprite(next) };
}

export function isCutscenePlaying(c: Cutscene | null, t: number): c is Cutscene {
  if (!c) return false;
  const elapsed = t - c.startedAt;
  return elapsed >= 0 && elapsed < CUTSCENE_MS[c.kind];
}

function composeCutscene(c: Cutscene, t: number, motion: number): Scene {
  const e = t - c.startedAt;
  const mid = SCREEN_W / 2;
  const items: Placed[] = [];
  const sparkles = (name: SpriteName, flicker: boolean) => {
    const s = SPRITES[name];
    const x = center(name, mid);
    const y = onGround(name);
    if (!flicker || step(t, 200) % 2 === 0) {
      items.push({ sprite: 'sparkle', x: x - 7, y: y + 2 });
      items.push({ sprite: 'sparkle', x: x + s.w + 2, y: y - 2 });
    }
    if (!flicker || step(t, 200) % 2 === 1) items.push({ sprite: 'sparkle', x: center('sparkle', mid), y: Math.max(0, y - 7) });
  };

  switch (c.kind) {
    case 'hatch':
      if (e < 1200) {
        const shake = motion * (step(t, 120) % 2 === 0 ? -1 : 1);
        items.push({ sprite: 'egg', x: center('egg', mid) + shake, y: onGround('egg') });
      } else if (e < 1800) {
        items.push({ sprite: 'eggCracked', x: center('eggCracked', mid), y: onGround('eggCracked') });
      } else {
        items.push({ sprite: c.to, x: center(c.to, mid), y: onGround(c.to), anim: 'idle', frame: animFrame('idle', t, motion) });
        sparkles(c.to, motion === 1);
      }
      return { state: 'hatching', dim: false, items };

    case 'evolve': {
      const swapping = e < 1800;
      const shown = swapping && motion === 1 && step(e, 200) % 2 === 0 ? c.from : c.to;
      items.push({ sprite: shown, x: center(shown, mid), y: onGround(shown), anim: 'idle', frame: animFrame('idle', t, motion) });
      sparkles(shown, motion === 1);
      return { state: 'evolving', dim: false, items };
    }

    case 'death':
      if (e < 800) {
        items.push({ sprite: c.from, x: center(c.from, mid), y: onGround(c.from), eyesClosed: true, anim: 'sleep', frame: 0 });
      } else {
        const rise = motion ? Math.round(((e - 800) / (CUTSCENE_MS.death - 800)) * 16) : 6;
        items.push({ sprite: 'ghost', x: center('ghost', mid), y: Math.max(0, onGround('ghost') - rise) });
      }
      return { state: 'dying', dim: true, items };
  }
}

const ACTION_STATE: Readonly<Record<ActionType, AnimState>> = {
  feed: 'eating',
  snack: 'snacking',
  play: 'playing',
  sleep: 'sleeping',
  clean: 'cleaning',
  medicine: 'medicine',
};

export function isActionPlaying(active: ActiveAction | null, t: number): active is ActiveAction {
  if (!active) return false;
  const elapsed = t - active.startedAt;
  return elapsed >= 0 && elapsed < ACTION_ANIM_MS[active.action];
}

export function animState(pet: Pet, active: ActiveAction | null, t: number): AnimState {
  if (pet.stage === 'dead') return 'dead';
  if (pet.stage === 'egg') return 'egg';
  if (isActionPlaying(active, t) && !pet.isSleeping) return ACTION_STATE[active.action];
  if (pet.isSleeping) return 'sleeping';
  if (pet.isSick) return 'sick';
  if (getMood(pet) === 'sad') return 'sad';
  return 'idle';
}

const step = (t: number, period: number) => Math.floor(t / period);
const center = (name: SpriteName, cx: number) => Math.round(cx - SPRITES[name].w / 2);
const onGround = (name: SpriteName) => GROUND_Y - SPRITES[name].h;

/** Треугольная волна 0→1→0 по фазе 0..1. */
function triangle(phase: number): number {
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

export function composeScene(
  pet: Pet,
  active: ActiveAction | null,
  t: number,
  reducedMotion = false,
  cutscene: Cutscene | null = null,
): Scene {
  const motion = reducedMotion ? 0 : 1;
  if (isCutscenePlaying(cutscene, t)) return composeCutscene(cutscene, t, motion);
  const state = animState(pet, active, t);
  const elapsed = active ? Math.max(0, t - active.startedAt) : 0;
  const name = petSprite(pet);
  const blink = motion === 1 && t % BLINK_EVERY_MS < BLINK_MS;
  const items: Placed[] = [];
  const mid = SCREEN_W / 2;

  const tail = petTail(pet);
  const tailExtra = tail ? SPRITES[tail[0]].w - TAIL_OVERLAP : 0;
  // Тело вместе с хвостом всегда целиком на экране.
  const maxX = SCREEN_W - 1 - SPRITES[name].w - tailExtra;
  /** clock — время анимации, мс (по умолчанию общее); once — не зацикливать. */
  const petAt = (cx: number, dy = 0, eyesClosed = blink, anim: AnimRow = 'idle', clock = t, once = false, flip = false): Placed => ({
    sprite: name,
    x: Math.max(1, Math.min(maxX, center(name, cx))),
    y: onGround(name) + dy,
    eyesClosed,
    anim,
    frame: once ? animFrameOnce(anim, clock, motion) : animFrame(anim, clock, motion),
    ...(flip ? { flip } : {}),
  });
  let butterfly: Butterfly | undefined;
  const puffs: Puff[] = [];

  // Какашки лежат на полу, пока их не уберут; питомец ходит перед ними.
  if (state !== 'dead' && state !== 'egg' && state !== 'cleaning') {
    const shown = Math.min(pet.poops, POOP_SLOTS.length);
    for (let i = 0; i < shown; i++) {
      const px = POOP_SLOTS.at(i) ?? 0;
      items.push({ sprite: 'poopSmall', x: px, y: onGround('poopSmall') });
      // Зеленоватый дымок: три облачка поднимаются и расплываются.
      for (let k = 0; k < 3; k++) {
        const rise = motion ? ((t + k * 700 + i * 310) % 2100) / 2100 : k / 3;
        puffs.push({
          x: px + 3 + Math.sin((rise + k * 0.4) * Math.PI * 2) * 1.6,
          y: onGround('poopSmall') - 1 - rise * 9,
          r: 0.9 + rise * 1.6,
          a: 0.7 * (1 - rise),
        });
      }
    }
  }

  switch (state) {
    case 'dead':
      items.push({ sprite: 'grave', x: center('grave', mid), y: onGround('grave') });
      break;

    case 'egg': {
      const wobble = motion * (EGG_WOBBLE[step(t, 600) % EGG_WOBBLE.length] ?? 0);
      items.push({ sprite: 'egg', x: center('egg', mid) + wobble, y: onGround('egg') });
      break;
    }

    case 'idle': {
      const e = motion ? chaseTime(t) : null;
      if (e !== null) {
        const chase = chaseFrame(pet.species, e, t);
        // Первые полсекунды питомец плавно идёт от своего места к месту охоты.
        const startX = mid + idlePose(0).offset;
        const k = Math.min(1, e / 500);
        items.push(petAt(startX + (chase.cx - startX) * k, -chase.lift));
        butterfly = chase.butterfly;
        break;
      }
      if (!motion) {
        items.push(petAt(mid, 0, false, 'idle_smooth'));
        break;
      }
      const pose = idlePose(t);
      const cx = mid + pose.offset;
      switch (pose.kind) {
        case 'walk':
          items.push(petAt(cx, 0, false, 'walk', pose.e, false, flipFor(pose.right)));
          break;
        case 'lie':
          items.push(petAt(cx, 0, false, 'lie_wag', pose.e));
          break;
        case 'roll':
          items.push(petAt(cx, 0, false, 'roll', pose.e, true));
          break;
        default:
          items.push(petAt(cx, 0, blink, 'idle_smooth'));
      }
      break;
    }

    case 'sad': {
      const needs = getNeeds(pet);
      const row: AnimRow = needs.includes('hunger') ? 'hungry' : needs.includes('energy') ? 'tired' : 'idle';
      const p = petAt(mid, motion * (step(t, BOB_MS * 2) % 2), blink, row);
      items.push(p);
      const cycle = t % 3000;
      if (cycle < 1200) {
        items.push({ sprite: 'tear', x: p.x - 1, y: p.y + 6 + motion * step(cycle, 300) });
      }
      break;
    }

    case 'sick': {
      const jitter = motion * (step(t, 200) % 2);
      const p = petAt(mid + jitter, 0, blink, 'sick');
      items.push(p);
      items.push({ sprite: 'skull', x: p.x - 6, y: p.y - 2 - motion * (step(t, BOB_MS) % 2) });
      break;
    }

    case 'sleeping': {
      // Спит клубочком; раз в 9 секунд дёргает ухом или хвостом.
      const twitch = t % SLEEP_CYCLE_MS;
      const p = petAt(mid, 0, true, 'sleep_twitch', twitch, true);
      items.push(p);
      const right = p.x + SPRITES[name].w;
      for (let i = 0; i < 2; i++) {
        const rise = motion ? ((t + i * 1200) % 2400) / 2400 : i * 0.5;
        items.push({ sprite: 'zed', x: right + 1 + i * 4, y: p.y - 2 - Math.round(rise * 8) });
      }
      break;
    }

    case 'eating': {
      // Подходит к миске боком, наклоняется и ест.
      const d = SIDE_FACES_LEFT ? -1 : 1; // куда смотрит питомец в боковой позе
      const bowlX = d > 0 ? mid + 8 : mid - 8 - SPRITES.bowl.w;
      const stopX = d > 0 ? bowlX - 8 : bowlX + SPRITES.bowl.w + 8;
      const startX = mid - d * 12;
      const walking = elapsed < FEED_WALK_MS;
      if (walking) {
        const k = motion ? elapsed / FEED_WALK_MS : 1;
        items.push(petAt(startX + (stopX - startX) * k, 0, false, 'walk', elapsed, false, flipFor(d > 0)));
      } else {
        items.push(petAt(stopX, 0, false, 'eat_side', elapsed - FEED_WALK_MS, true, flipFor(d > 0)));
      }
      if (elapsed < ACTION_ANIM_MS.feed * 0.9) items.push({ sprite: 'bowl', x: bowlX, y: onGround('bowl') });
      break;
    }

    case 'snacking': {
      // Лакомство летит дугой, питомец ловит его в прыжке и съедает.
      const px = mid - 2;
      const p = petAt(px, 0, false, 'catch', elapsed, true);
      items.push(p);
      const mouth = { x: p.x + SPRITES[name].w / 2 - SPRITES.candy.w / 2, y: p.y + 4 };
      if (elapsed < TREAT_FLIGHT_MS) {
        const k = motion ? elapsed / TREAT_FLIGHT_MS : 1;
        const x0 = mid + 16;
        const y0 = GROUND_Y - 6;
        items.push({
          sprite: 'candy',
          x: Math.round(x0 + (mouth.x - x0) * k),
          y: Math.round(y0 + (mouth.y - y0) * k - Math.sin(Math.PI * k) * 8),
        });
      } else if (elapsed > ACTION_ANIM_MS.snack / 2) {
        const rise = motion ? Math.min(1, (elapsed - ACTION_ANIM_MS.snack / 2) / 700) : 0;
        items.push({ sprite: 'heart', x: p.x + SPRITES[name].w, y: p.y - 2 - Math.round(rise * 3) });
      }
      break;
    }

    case 'playing': {
      const hop = motion * -3 * (step(t, 300) % 2);
      items.push(petAt(mid - 11, hop));
      const phase = motion ? (elapsed % 1200) / 1200 : 0.5;
      const bx = Math.round(mid - 1 + triangle(phase) * 12);
      const by = Math.round(onGround('ball') - Math.sin(Math.PI * ((phase * 2) % 1)) * 9);
      items.push({ sprite: 'ball', x: bx, y: by });
      break;
    }

    case 'cleaning': {
      const p = petAt(mid, 0, true);
      items.push(p);
      const w = SPRITES[name].w;
      for (let i = 0; i < 4; i++) {
        const rise = motion ? ((elapsed + i * 450) % 1800) / 1800 : i * 0.25;
        const x = p.x - 4 + Math.round((i * (w + 8)) / 3);
        items.push({ sprite: 'bubble', x, y: GROUND_Y - 4 - Math.round(rise * 16) });
      }
      items.push({ sprite: 'sparkle', x: p.x + w - 2, y: p.y - 6 + motion * (step(t, 300) % 2) });
      break;
    }

    case 'medicine': {
      const p = petAt(mid, 0);
      items.push(p);
      if (elapsed < ACTION_ANIM_MS.medicine / 2) {
        const drop = motion ? Math.round((elapsed / (ACTION_ANIM_MS.medicine / 2)) * 9) : 5;
        items.push({ sprite: 'pill', x: center('pill', mid), y: Math.max(1, p.y - 13 + drop) });
      } else {
        items.push({ sprite: 'heart', x: center('heart', mid), y: Math.max(1, p.y - 8) });
      }
      break;
    }
  }

  const body = items.findIndex((i) => i.sprite === name);
  const bodyItem = items[body];
  if (tail && bodyItem) {
    const wag = WAG_MS[state];
    const frame = tail[motion && wag ? step(t, wag) % 2 : 0];
    const b = SPRITES[name];
    const tailItem: Placed = {
      sprite: frame,
      x: bodyItem.x + b.w - TAIL_OVERLAP,
      y: bodyItem.y + b.h - SPRITES[frame].h - 2,
    };
    items.splice(body, 0, tailItem);
  }

  return { state, dim: state === 'sleeping', items, ...(butterfly ? { butterfly } : {}), ...(puffs.length > 0 ? { puffs } : {}) };
}
