import type {
  AdultForm,
  CauseOfDeath,
  Cooldowns,
  LifeStage,
  Pet,
  Species,
} from '../core/types';
import { SPECIES } from '../core/types';
import { POOP_INTERVAL_MS } from '../core/config';
import { emptyStats, type GameStats } from '../core/stats';
import { detectLanguage, isLanguage, type Language } from '../i18n';

export const SAVE_KEY = 'tamagotchi.save';
export const SAVE_VERSION = 5;

export interface Settings {
  sound: boolean;
  notifications: boolean;
  /** Язык интерфейса. */
  language: Language;
}

export interface GraveRecord {
  name: string;
  /** Нет в записях до версии сейва 2 — это «Пушистик». */
  species?: Species;
  stage: LifeStage;
  form?: AdultForm;
  bornAt: number;
  diedAt: number;
  ageMs: number;
  causeOfDeath: CauseOfDeath;
  /** Качество ухода 0..100. Нет в записях, сделанных до этапа 3. */
  careScore?: number;
  sicknessCount?: number;
}

export interface GameState {
  pet: Pet | null;
  /** Реальное время последнего обновления симуляции, мс. */
  lastUpdated: number;
  cooldowns: Cooldowns;
  settings: Settings;
  graveyard: GraveRecord[];
  /** Сыграно и выиграно в мини-играх. */
  gameStats: GameStats;
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

export function createInitialState(now: number, language: Language = detectLanguage()): GameState {
  return {
    pet: null,
    lastUpdated: now,
    cooldowns: {},
    // Звук включён, но зазвучит только после первого касания (так требуют браузеры).
    settings: { sound: true, notifications: false, language },
    graveyard: [],
    gameStats: emptyStats(),
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

/** Чистота 100 → 0 какашек, 40 → 3, 0 → 5. */
export function hygieneToPoops(hygiene: number): number {
  return Math.max(0, Math.min(5, Math.round((100 - hygiene) / 20)));
}
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: появился выбор животного; все прежние питомцы — «Пушистики».
  1: (data) => {
    const pet = isRecord(data.pet) ? { ...data.pet, species: 'blob' } : data.pet;
    const graveyard = Array.isArray(data.graveyard)
      ? data.graveyard.map((g) => (isRecord(g) ? { ...g, species: 'blob' } : g))
      : data.graveyard;
    return { ...data, version: 2, pet, graveyard };
  },
  // v2 → v3: шкала чистоты заменена какашками. Чем грязнее было, тем больше их на полу.
  2: (data) => {
    let pet = data.pet;
    if (isRecord(pet) && isRecord(pet.stats)) {
      const { hygiene, ...stats } = pet.stats;
      const h = typeof hygiene === 'number' ? hygiene : 100;
      pet = { ...pet, stats, poops: hygieneToPoops(h), poopTimerMs: POOP_INTERVAL_MS };
    }
    return { ...data, version: 3, pet };
  },
  // v3 → v4: лакомства стали валютой мини-игр; запас начинается с нуля.
  3: (data) => {
    const pet = isRecord(data.pet) ? { ...data.pet, treats: 0 } : data.pet;
    return { ...data, version: 4, pet };
  },
  // v4 → v5: язык интерфейса (у прежних игроков — русский) и счётчики мини-игр.
  4: (data) => {
    const settings = isRecord(data.settings) ? { ...data.settings, language: 'ru' } : data.settings;
    return { ...data, version: 5, settings, gameStats: emptyStats() };
  },
};

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
  const { pet, lastUpdated, cooldowns, settings, graveyard, gameStats } = data;
  return { pet, lastUpdated, cooldowns, settings, graveyard, gameStats: { ...emptyStats(), ...gameStats } };
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
const STAT_KEYS = ['hunger', 'happiness', 'energy', 'health'] as const;

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
    typeof v.species === 'string' &&
    (SPECIES as readonly string[]).includes(v.species) &&
    typeof v.stage === 'string' &&
    STAGES.includes(v.stage) &&
    isRecord(stats) &&
    STAT_KEYS.every((k) => isNum(stats[k])) &&
    isNum(v.poops) &&
    v.poops >= 0 &&
    isNum(v.poopTimerMs) &&
    isNum(v.treats) &&
    v.treats >= 0 &&
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
    (v.species === undefined || (SPECIES as readonly string[]).includes(String(v.species))) &&
    typeof v.stage === 'string' &&
    STAGES.includes(v.stage) &&
    isOptional(v.form, FORMS) &&
    isNum(v.bornAt) &&
    isNum(v.diedAt) &&
    isNum(v.ageMs) &&
    typeof v.causeOfDeath === 'string' &&
    CAUSES.includes(v.causeOfDeath) &&
    (v.careScore === undefined || isNum(v.careScore)) &&
    (v.sicknessCount === undefined || isNum(v.sicknessCount))
  );
}

function isGameStats(v: unknown): v is GameStats {
  if (!isRecord(v) || !isRecord(v.queens)) return false;
  // «Питомцы-блоки» появились в 1.7.0 — в сохранениях 1.6.0 их счётчиков ещё нет.
  if (v.slide !== undefined && !isRecord(v.slide)) return false;
  const levels = [...Object.values(v.queens), ...Object.values(isRecord(v.slide) ? v.slide : {})];
  return levels.every(
    (l) =>
      isRecord(l) &&
      isNum(l.played) &&
      l.played >= 0 &&
      isNum(l.won) &&
      l.won >= 0 &&
      (l.best === undefined || isNum(l.best)),
  );
}

function isGameState(v: Record<string, unknown>): v is Record<string, unknown> & GameState {
  const { pet, lastUpdated, cooldowns, settings, graveyard, gameStats } = v;
  return (
    (pet === null || isPet(pet)) &&
    isNum(lastUpdated) &&
    isRecord(cooldowns) &&
    Object.values(cooldowns).every(isNum) &&
    isRecord(settings) &&
    typeof settings.sound === 'boolean' &&
    typeof settings.notifications === 'boolean' &&
    isLanguage(settings.language) &&
    isGameStats(gameStats) &&
    Array.isArray(graveyard) &&
    graveyard.every(isGraveRecord)
  );
}
