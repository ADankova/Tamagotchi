import { NEED_ALERT_THRESHOLD } from '../core/config';
import { getMood } from '../core/pet';
import type { ActionType, AdultForm, LifeStage, Pet, Species } from '../core/types';
import { bodyStage, SPECIES_LOOKS, TAIL_OVERLAP } from './species';
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
  | 'medicine'
  | 'hatching'
  | 'evolving'
  | 'dying';

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
        items.push({ sprite: c.to, x: center(c.to, mid), y: onGround(c.to) });
        sparkles(c.to, motion === 1);
      }
      return { state: 'hatching', dim: false, items };

    case 'evolve': {
      const swapping = e < 1800;
      const shown = swapping && motion === 1 && step(e, 200) % 2 === 0 ? c.from : c.to;
      items.push({ sprite: shown, x: center(shown, mid), y: onGround(shown) });
      sparkles(shown, motion === 1);
      return { state: 'evolving', dim: false, items };
    }

    case 'death':
      if (e < 800) {
        items.push({ sprite: c.from, x: center(c.from, mid), y: onGround(c.from), eyesClosed: true });
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
  const bob = motion * (step(t, BOB_MS) % 2);
  const items: Placed[] = [];
  const mid = SCREEN_W / 2;

  const tail = petTail(pet);
  const tailExtra = tail ? SPRITES[tail[0]].w - TAIL_OVERLAP : 0;
  // Тело вместе с хвостом всегда целиком на экране.
  const maxX = SCREEN_W - 1 - SPRITES[name].w - tailExtra;
  const petAt = (cx: number, dy = 0, eyesClosed = blink): Placed => ({
    sprite: name,
    x: Math.max(1, Math.min(maxX, center(name, cx))),
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

  return { state, dim: state === 'sleeping', items };
}
