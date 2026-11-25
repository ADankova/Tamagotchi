import { NEED_ALERT_THRESHOLD } from '../core/config';
import { getMood } from '../core/pet';
import type { ActionType, Pet } from '../core/types';
import { SPRITES, type SpriteName } from './sprites';

// Чистая функция «что нарисовать в момент t»: без DOM и без часов,
// поэтому анимации можно проверять тестами. Координаты — в логических пикселях экрана.

export const SCREEN_W = 48;
export const SCREEN_H = 36;
export const GROUND_Y = SCREEN_H - 2;

/** Сколько длится анимация действия. У сна своей анимации нет — он состояние. */
export const ACTION_ANIM_MS: Readonly<Record<ActionType, number>> = {
  feed: 2400,
  snack: 1800,
  play: 2400,
  sleep: 0,
  clean: 1800,
  medicine: 1800,
};

const WALK_PERIOD_MS = 9600;
const WALK_RANGE = 12;
const STEP_MS = 400;
const BOB_MS = 500;
const BLINK_EVERY_MS = 4000;
const BLINK_MS = 160;
const EGG_WOBBLE = [0, 1, 0, -1] as const;

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
  | 'medicine';

export interface ActiveAction {
  action: ActionType;
  startedAt: number;
}

export interface Placed {
  sprite: SpriteName;
  x: number;
  y: number;
  eyesClosed?: boolean;
}

export interface Scene {
  state: AnimState;
  /** Сон: экран притушен. */
  dim: boolean;
  /** Порядок отрисовки: первые — снизу. */
  items: Placed[];
}

export function petSprite(pet: Pet): SpriteName {
  switch (pet.stage) {
    case 'egg':
      return 'egg';
    case 'baby':
      return 'baby';
    case 'child':
      return 'child';
    case 'teen':
      return 'teen';
    case 'adult':
      return pet.form === 'good' ? 'adultGood' : pet.form === 'naughty' ? 'adultNaughty' : 'adultNormal';
    case 'elder':
      return 'elder';
    case 'dead':
      return 'grave';
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
): Scene {
  const state = animState(pet, active, t);
  const motion = reducedMotion ? 0 : 1;
  const elapsed = active ? Math.max(0, t - active.startedAt) : 0;
  const name = petSprite(pet);
  const blink = motion === 1 && t % BLINK_EVERY_MS < BLINK_MS;
  const bob = motion * (step(t, BOB_MS) % 2);
  const items: Placed[] = [];
  const mid = SCREEN_W / 2;

  const petAt = (cx: number, dy = 0, eyesClosed = blink): Placed => ({
    sprite: name,
    x: center(name, cx),
    y: onGround(name) + dy,
    eyesClosed,
  });

  // Грязь лежит на полу, пока не уберут.
  if (state !== 'dead' && state !== 'egg' && state !== 'cleaning') {
    if (pet.stats.hygiene < NEED_ALERT_THRESHOLD) items.push({ sprite: 'poop', x: SCREEN_W - 9, y: onGround('poop') });
    if (pet.stats.hygiene < NEED_ALERT_THRESHOLD / 2) items.push({ sprite: 'poop', x: 2, y: onGround('poop') });
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
      // Ходит туда-обратно рывками по 2 пикселя, как на настоящем LCD.
      const walkPhase = motion ? (step(t % WALK_PERIOD_MS, STEP_MS) * STEP_MS) / WALK_PERIOD_MS : 0.25;
      const offset = Math.round((triangle(walkPhase) - 0.5) * WALK_RANGE) * 2;
      items.push(petAt(mid + offset, bob));
      break;
    }

    case 'sad': {
      const p = petAt(mid, motion * (step(t, BOB_MS * 2) % 2));
      items.push(p);
      const cycle = t % 3000;
      if (cycle < 1200) {
        items.push({ sprite: 'tear', x: p.x - 1, y: p.y + 6 + motion * step(cycle, 300) });
      }
      break;
    }

    case 'sick': {
      const jitter = motion * (step(t, 200) % 2);
      const p = petAt(mid + jitter, 0);
      items.push(p);
      items.push({ sprite: 'skull', x: p.x - 6, y: p.y - 2 - motion * (step(t, BOB_MS) % 2) });
      break;
    }

    case 'sleeping': {
      const p = petAt(mid, motion * (step(t, BOB_MS * 3) % 2), true);
      items.push(p);
      const right = p.x + SPRITES[name].w;
      for (let i = 0; i < 2; i++) {
        const rise = motion ? ((t + i * 1200) % 2400) / 2400 : i * 0.5;
        items.push({ sprite: 'zed', x: right + 1 + i * 4, y: p.y - 2 - Math.round(rise * 8) });
      }
      break;
    }

    case 'eating': {
      items.push(petAt(mid - 8, motion * (step(t, BOB_MS / 2) % 2)));
      if (elapsed < ACTION_ANIM_MS.feed * 0.85) items.push({ sprite: 'bowl', x: mid + 8, y: onGround('bowl') });
      break;
    }

    case 'snacking': {
      const p = petAt(mid - 6, motion * (step(t, BOB_MS / 2) % 2));
      items.push(p);
      if (elapsed < ACTION_ANIM_MS.snack / 2) {
        items.push({ sprite: 'candy', x: mid + 8, y: onGround('candy') - 2 });
      } else {
        items.push({ sprite: 'heart', x: p.x + SPRITES[name].w, y: p.y - 4 });
      }
      break;
    }

    case 'playing': {
      const hop = motion * -3 * (step(t, 300) % 2);
      items.push(petAt(mid - 11, hop));
      const phase = motion ? (elapsed % 1200) / 1200 : 0.5;
      const bx = Math.round(mid - 1 + triangle(phase) * 15);
      const by = Math.round(onGround('ball') - Math.sin(Math.PI * ((phase * 2) % 1)) * 10);
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
        const drop = motion ? Math.round((elapsed / (ACTION_ANIM_MS.medicine / 2)) * 6) : 3;
        items.push({ sprite: 'pill', x: center('pill', mid), y: Math.max(1, p.y - 10 + drop) });
      } else {
        items.push({ sprite: 'heart', x: center('heart', mid), y: Math.max(1, p.y - 8) });
      }
      break;
    }
  }

  return { state, dim: state === 'sleeping', items };
}
