import { describeAbsence, type AbsenceNote } from './core/absence';
import { blockReason, finishPlay, performAction, type ActionBlockReason } from './core/actions';
import {
  ABSENCE_SUMMARY_MIN_MS,
  AUTOSAVE_INTERVAL_MS,
  MAX_OFFLINE_MS,
  MAX_POOPS,
  MAX_TREATS,
  TICK_INTERVAL_MS,
} from './core/config';
import { clampStat, createPet, normalizeName } from './core/pet';
import { randomSeed } from './core/rng';
import { recordGame, type MiniGameId } from './core/stats';
import { tick } from './core/simulation';
import type { ActionType, GameEvent, Pet, Species, StatKey } from './core/types';
import { EventBus } from './events';
import {
  clearState,
  createInitialState,
  loadState,
  saveState,
  type GameState,
  type KeyValueStorage,
  type LoadResult,
  type Settings,
} from './storage/save';

export type UiEvent =
  | { type: 'changed' }
  | { type: 'actionDone'; action: ActionType }
  | { type: 'treatsEarned'; amount: number }
  | { type: 'actionBlocked'; action: ActionType; reason: ActionBlockReason }
  | { type: 'saveFailed' };

export type BusEvent = GameEvent | UiEvent;

export interface Absence {
  dtMs: number;
  notes: AbsenceNote[];
}

export interface StartInfo {
  status: LoadResult['status'];
  absence: Absence | null;
}

export interface GameOptions {
  storage: KeyValueStorage;
  now?: () => number;
  seed?: () => number;
}

const GRAVEYARD_LIMIT = 50;

/**
 * Связывает ядро, сохранение и время. Единственный модуль, который читает часы.
 * UI и звук подписываются на bus и не трогают состояние напрямую.
 */
export class Game {
  readonly bus = new EventBus<BusEvent>();
  private current: GameState;
  private scale = 1;
  private readonly storage: KeyValueStorage;
  private readonly now: () => number;
  private readonly seed: () => number;

  constructor(options: GameOptions) {
    this.storage = options.storage;
    this.now = options.now ?? (() => Date.now());
    this.seed = options.seed ?? randomSeed;
    this.current = createInitialState(this.now());
  }

  get state(): Readonly<GameState> {
    return this.current;
  }

  currentTime(): number {
    return this.now();
  }

  get timeScale(): number {
    return this.scale;
  }

  /** Загружает сохранение и догоняет время, прошедшее с прошлого визита. */
  start(): StartInfo {
    const loaded = loadState(this.storage, this.now());
    this.current = loaded.state;
    let absence: Absence | null = null;

    if (loaded.status === 'loaded') {
      const hadLivePet = this.current.pet !== null && this.current.pet.stage !== 'dead';
      const { events, dtMs } = this.advance(this.now());
      const pet = this.current.pet;
      if (hadLivePet && pet && dtMs >= ABSENCE_SUMMARY_MIN_MS) {
        absence = { dtMs, notes: describeAbsence(pet, events) };
      }
    }
    this.save();
    return { status: loaded.status, absence };
  }

  /** Один шаг игрового цикла: симуляция до текущего момента. */
  update(): void {
    const { events } = this.advance(this.now());
    events.forEach((e) => this.bus.emit(e));
    if (events.some((e) => e.type === 'died' || e.type === 'stageChanged')) this.save();
    this.bus.emit({ type: 'changed' });
  }

  act(action: ActionType): ActionBlockReason | null {
    this.advance(this.now());
    const result = performAction(this.current.pet, action, this.current.cooldowns, this.now());
    if (!result.ok) {
      this.bus.emit({ type: 'actionBlocked', action, reason: result.reason });
      return result.reason;
    }
    this.current.pet = result.pet;
    this.current.cooldowns = result.cooldowns;
    this.bus.emit({ type: 'actionDone', action });
    result.events.forEach((e) => this.bus.emit(e));
    this.save();
    this.bus.emit({ type: 'changed' });
    return null;
  }

  /** Можно ли сейчас поиграть (открыть мини-игры). null — можно. */
  playBlockReason(): ActionBlockReason | null {
    this.advance(this.now());
    return blockReason(this.current.pet, 'play', this.current.cooldowns, this.now());
  }

  /** Итог мини-игры: эффект «Поиграть» и, при победе, награда лакомствами. */
  finishMiniGame(
    won: boolean,
    reward: number,
    level?: { game: MiniGameId; key: string | number; score?: number },
  ): boolean {
    if (level) {
      this.current.gameStats = recordGame(this.current.gameStats, level.game, level.key, won, level.score);
      this.save();
    }
    this.advance(this.now());
    const result = finishPlay(this.current.pet, won, reward, this.current.cooldowns, this.now());
    if (!result.ok) {
      this.bus.emit({ type: 'actionBlocked', action: 'play', reason: result.reason });
      return false;
    }
    this.current.pet = result.pet;
    this.current.cooldowns = result.cooldowns;
    this.bus.emit({ type: 'actionDone', action: 'play' });
    if (won && reward > 0) this.bus.emit({ type: 'treatsEarned', amount: reward });
    this.save();
    this.bus.emit({ type: 'changed' });
    return true;
  }

  /** Лакомство, добытое прямо во время мини-игры: начисляется сразу, чтобы не потеряться. */
  awardTreats(amount: number): void {
    const pet = this.current.pet;
    if (!pet || pet.stage === 'dead' || pet.stage === 'egg' || amount <= 0) return;
    pet.treats = Math.min(MAX_TREATS, pet.treats + amount);
    this.save();
    this.bus.emit({ type: 'treatsEarned', amount });
    this.bus.emit({ type: 'changed' });
  }

  /** Новое яйцо. Имя обязательно. */
  newPet(name: string, species: Species = 'cat'): boolean {
    const clean = normalizeName(name);
    if (!clean) return false;
    const now = this.now();
    this.current.pet = createPet(clean, now, this.seed(), species);
    this.current.cooldowns = {};
    this.current.lastUpdated = now;
    this.save();
    this.bus.emit({ type: 'changed' });
    return true;
  }

  setSettings(patch: Partial<Settings>): void {
    this.current.settings = { ...this.current.settings, ...patch };
    this.save();
    this.bus.emit({ type: 'changed' });
  }

  save(): boolean {
    const ok = saveState(this.storage, this.current);
    if (!ok) this.bus.emit({ type: 'saveFailed' });
    return ok;
  }

  resetAll(): void {
    clearState(this.storage);
    this.current = createInitialState(this.now(), this.current.settings.language);
    this.bus.emit({ type: 'changed' });
  }

  // --- Отладка (?debug=1) ---

  setTimeScale(scale: number): void {
    this.advance(this.now());
    this.scale = Math.max(1, scale);
    this.bus.emit({ type: 'changed' });
  }

  addPoop(): void {
    const pet = this.current.pet;
    if (!pet || pet.stage === 'dead' || pet.stage === 'egg') return;
    pet.poops = Math.min(MAX_POOPS, pet.poops + 1);
    this.save();
    this.bus.emit({ type: 'pooped', poops: pet.poops });
    this.bus.emit({ type: 'changed' });
  }

  setStat(key: StatKey, value: number): void {
    const pet = this.current.pet;
    if (!pet || pet.stage === 'dead') return;
    pet.stats[key] = clampStat(value);
    this.save();
    this.bus.emit({ type: 'changed' });
  }

  /**
   * Запускает таймеры и подписки на окно. Возвращает функцию остановки.
   * Симуляция — раз в секунду, сохранение — раз в 10 секунд и при уходе со вкладки.
   */
  run(win: Window): () => void {
    const tickTimer = win.setInterval(() => this.update(), TICK_INTERVAL_MS);
    const saveTimer = win.setInterval(() => this.save(), AUTOSAVE_INTERVAL_MS);
    const onVisibility = () => {
      this.update();
      this.save();
    };
    const onHide = () => this.save();
    win.document.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('pagehide', onHide);
    return () => {
      win.clearInterval(tickTimer);
      win.clearInterval(saveTimer);
      win.document.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pagehide', onHide);
    };
  }

  private advance(now: number): { events: GameEvent[]; dtMs: number } {
    const elapsed = now - this.current.lastUpdated;
    this.current.lastUpdated = now;
    // Часы перевели назад — время не считаем. Долгое отсутствие ограничено 72 часами.
    const dtMs = Math.min(Math.max(elapsed, 0), MAX_OFFLINE_MS) * this.scale;
    const pet = this.current.pet;
    if (!pet || dtMs <= 0) return { events: [], dtMs };

    const result = tick(pet, dtMs);
    this.current.pet = result.pet;
    if (result.events.some((e) => e.type === 'died')) this.recordDeath(result.pet);
    return { events: result.events, dtMs };
  }

  private recordDeath(pet: Pet): void {
    this.current.graveyard = [
      {
        name: pet.name,
        species: pet.species,
        stage: pet.stageAtDeath ?? 'egg',
        form: pet.form,
        bornAt: pet.bornAt,
        diedAt: pet.bornAt + pet.ageMs,
        ageMs: pet.ageMs,
        causeOfDeath: pet.causeOfDeath ?? 'neglect',
        careScore: Math.round(pet.careScore),
        sicknessCount: pet.care.sicknessCount,
      },
      ...this.current.graveyard,
    ].slice(0, GRAVEYARD_LIMIT);
  }
}
