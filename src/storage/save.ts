import type {
  AdultForm,
  CauseOfDeath,
  Cooldowns,
  LifeStage,
  Pet,
} from '../core/types';

export const SAVE_KEY = 'tamagotchi.save';
export const SAVE_VERSION = 1;

export interface Settings {
  sound: boolean;
  notifications: boolean;
}

export interface GraveRecord {
  name: string;
  stage: LifeStage;
  form?: AdultForm;
  bornAt: number;
  diedAt: number;
  ageMs: number;
  causeOfDeath: CauseOfDeath;
}

export interface GameState {
  pet: Pet | null;
  /** Реальное время последнего обновления симуляции, мс. */
  lastUpdated: number;
  cooldowns: Cooldowns;
  settings: Settings;
  graveyard: GraveRecord[];
}

export interface SaveData extends GameState {
  version: number;
}

/** То, что нужно от localStorage. В тестах подменяется объектом в памяти. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { status: 'empty'; state: GameState }
  | { status: 'loaded'; state: GameState }
  | { status: 'corrupted'; state: GameState };

export function createInitialState(now: number): GameState {
  return {
    pet: null,
    lastUpdated: now,
    cooldowns: {},
    settings: { sound: false, notifications: false },
    graveyard: [],
  };
}

export function serialize(state: GameState): string {
  const data: SaveData = { version: SAVE_VERSION, ...state };
  return JSON.stringify(data);
}

/**
 * Миграции: ключ — версия, из которой переводим, функция возвращает данные версии +1.
 * Пример на будущее: 1: (d) => ({ ...d, version: 2, newField: 0 }).
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {};

export function migrate(data: Record<string, unknown>): Record<string, unknown> | null {
  let current = data;
  while (typeof current.version === 'number' && current.version < SAVE_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step) return null;
    current = step(current);
  }
  return current.version === SAVE_VERSION ? current : null;
}

export function deserialize(raw: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const data = migrate(parsed);
  if (!data || !isGameState(data)) return null;
  const { pet, lastUpdated, cooldowns, settings, graveyard } = data;
  return { pet, lastUpdated, cooldowns, settings, graveyard };
}

export function loadState(storage: KeyValueStorage, now: number): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { status: 'corrupted', state: createInitialState(now) };
  }
  if (raw === null) return { status: 'empty', state: createInitialState(now) };
  const state = deserialize(raw);
  if (!state) return { status: 'corrupted', state: createInitialState(now) };
  return { status: 'loaded', state };
}

/** Возвращает false, если записать не удалось (приватный режим, переполнение). */
export function saveState(storage: KeyValueStorage, state: GameState): boolean {
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage: KeyValueStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // нечего делать: хранилище недоступно
  }
}

// --- Проверка формы данных ---

const STAGES: readonly string[] = ['egg', 'baby', 'child', 'teen', 'adult', 'elder', 'dead'];
const CAUSES: readonly string[] = ['hunger', 'sickness', 'neglect', 'oldAge'];
const FORMS: readonly string[] = ['good', 'normal', 'naughty'];
const STAT_KEYS = ['hunger', 'happiness', 'energy', 'hygiene', 'health'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isOptional(v: unknown, allowed: readonly string[]): boolean {
  return v === undefined || (typeof v === 'string' && allowed.includes(v));
}

export function isPet(v: unknown): v is Pet {
  if (!isRecord(v)) return false;
  const stats = v.stats;
  const care = v.care;
  return (
    typeof v.name === 'string' &&
    typeof v.stage === 'string' &&
    STAGES.includes(v.stage) &&
    isRecord(stats) &&
    STAT_KEYS.every((k) => isNum(stats[k])) &&
    isNum(v.bornAt) &&
    isNum(v.ageMs) &&
    isNum(v.lifespanMs) &&
    typeof v.isSleeping === 'boolean' &&
    typeof v.isSick === 'boolean' &&
    isNum(v.careScore) &&
    isRecord(care) &&
    isNum(care.happinessMinutes) &&
    isNum(care.minutes) &&
    isNum(care.sicknessCount) &&
    Array.isArray(v.snackTimes) &&
    v.snackTimes.every(isNum) &&
    isNum(v.rngState) &&
    isOptional(v.form, FORMS) &&
    isOptional(v.causeOfDeath, CAUSES) &&
    isOptional(v.stageAtDeath, STAGES)
  );
}

function isGraveRecord(v: unknown): v is GraveRecord {
  return (
    isRecord(v) &&
    typeof v.name === 'string' &&
    typeof v.stage === 'string' &&
    STAGES.includes(v.stage) &&
    isOptional(v.form, FORMS) &&
    isNum(v.bornAt) &&
    isNum(v.diedAt) &&
    isNum(v.ageMs) &&
    typeof v.causeOfDeath === 'string' &&
    CAUSES.includes(v.causeOfDeath)
  );
}

function isGameState(v: Record<string, unknown>): v is Record<string, unknown> & GameState {
  const { pet, lastUpdated, cooldowns, settings, graveyard } = v;
  return (
    (pet === null || isPet(pet)) &&
    isNum(lastUpdated) &&
    isRecord(cooldowns) &&
    Object.values(cooldowns).every(isNum) &&
    isRecord(settings) &&
    typeof settings.sound === 'boolean' &&
    typeof settings.notifications === 'boolean' &&
    Array.isArray(graveyard) &&
    graveyard.every(isGraveRecord)
  );
}
