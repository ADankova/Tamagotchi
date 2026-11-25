import type { ActionType, LifeStage, Stats } from './types';

// Все числа баланса живут здесь. Значения — стартовые из ТЗ, раздел 2.

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const STAT_MIN = 0;
export const STAT_MAX = 100;

export const START_STATS: Readonly<Stats> = {
  hunger: 80,
  happiness: 80,
  energy: 100,
  health: 100,
};

/** Падение характеристик, единиц в час. Здоровье падает только по правилам ниже. */
export const DECAY_PER_HOUR = {
  hunger: 8,
  happiness: 6,
  energy: 5,
} as const;

export const SLEEP_ENERGY_GAIN_PER_HOUR = 15;
/** Во сне сытость, счастье и чистота падают медленнее — можно спокойно уйти спать. */
export const SLEEP_NEEDS_DECAY_MULTIPLIER = 0.5;

/** Ниже этого уровня сытость, чистота или счастье отнимают здоровье. */
export const CRITICAL_THRESHOLD = 20;
export const HEALTH_LOSS_PER_CRITICAL_PER_HOUR = 3;

// Какашки (как в настоящем Тамагочи): появляются по таймеру, «Убрать» убирает все.
/** Обычный интервал между какашками; у малыша — чаще. */
export const POOP_INTERVAL_MS = 3 * HOUR;
export const BABY_POOP_INTERVAL_MS = 2 * HOUR;
/** Случайный разброс интервала: ±30 минут. */
export const POOP_JITTER_MS = 30 * MINUTE;
/** Во сне какашки появляются вдвое реже. */
export const SLEEP_POOP_MULTIPLIER = 0.5;
/** С этого количества питомец грустит и может заболеть. */
export const POOP_SICK_THRESHOLD = 3;
/** Больше этого количества — падает здоровье. */
export const POOP_HEALTH_THRESHOLD = 5;
export const POOP_HEALTH_LOSS_PER_HOUR = 3;
/** Больше не копится (на экране помещается 6). */
export const MAX_POOPS = 9;
export const SICK_CHANCE_PER_HOUR = 0.25;
/** Дополнительная потеря здоровья во время болезни. */
export const SICK_HEALTH_LOSS_PER_HOUR = 5;

export const AUTO_SLEEP_ENERGY = 10;
/** Энергия, при которой питомец просыпается сам. Будить раньше — штраф к счастью. */
export const FULL_ENERGY = 100;

/** Порог, с которого показываются иконки потребностей. */
export const NEED_ALERT_THRESHOLD = 30;

/** Настроение «счастлив»: счастье не ниже первого порога, остальное — не ниже второго. */
export const HAPPY_MOOD_MIN_HAPPINESS = 70;
export const HAPPY_MOOD_MIN_OTHER_STATS = 50;

/** Возраст (от рождения), с которого начинается стадия. */
export const STAGE_STARTS: ReadonlyArray<readonly [LifeStage, number]> = [
  ['egg', 0],
  ['baby', 5 * MINUTE],
  ['child', 1 * DAY],
  ['teen', 3 * DAY],
  ['adult', 6 * DAY],
  ['elder', 14 * DAY],
];

export const LIFESPAN_MIN_MS = 16 * DAY;
export const LIFESPAN_MAX_MS = 20 * DAY;

/** Множитель падения сытости, счастья и чистоты по стадиям. */
export const STAGE_DECAY_MULTIPLIER: Partial<Record<LifeStage, number>> = {
  baby: 1.5,
};
export const ELDER_ENERGY_MULTIPLIER = 2;

/** Пороги careScore для формы взрослого питомца. */
export const FORM_GOOD_MIN_SCORE = 70;
export const FORM_NORMAL_MIN_SCORE = 40;
export const CARE_PENALTY_PER_SICKNESS = 10;

// Действия (ТЗ, таблица 2.2)
export const FEED_HUNGER = 25;
/** Сытость, при которой кормление считается перееданием (на экране это 100). */
export const OVERFEED_THRESHOLD = 99.5;
export const OVERFEED_HEALTH_PENALTY = 10;

export const SNACK_HAPPINESS = 15;
export const SNACK_HUNGER = 5;
export const SNACK_LIMIT_PER_HOUR = 3;
export const SNACK_OVERLIMIT_HEALTH_PENALTY = 5;

export const PLAY_HAPPINESS = 20;
export const PLAY_ENERGY_COST = 10;
export const PLAY_HUNGER_COST = 5;
/** Победа в мини-игре радует сильнее. */
export const PLAY_WIN_HAPPINESS_BONUS = 10;
export const MAX_TREATS = 99;

export const EARLY_WAKE_HAPPINESS_PENALTY = 10;

export const MEDICINE_HEALTH = 30;
export const NEEDLESS_MEDICINE_HAPPINESS_PENALTY = 10;

export const ACTION_COOLDOWN_MS: Readonly<Record<ActionType, number>> = {
  feed: 3 * SECOND,
  snack: 3 * SECOND,
  play: 5 * SECOND,
  sleep: 3 * SECOND,
  clean: 5 * SECOND,
  medicine: 5 * SECOND,
};

// Время и сохранение
/** Шаг симуляции: длинные промежутки режутся на такие куски. */
export const SIM_STEP_MS = MINUTE;
export const TICK_INTERVAL_MS = SECOND;
export const AUTOSAVE_INTERVAL_MS = 10 * SECOND;
export const MAX_OFFLINE_MS = 72 * HOUR;
/** С какой длительности отсутствия показывать сводку. */
export const ABSENCE_SUMMARY_MIN_MS = 5 * MINUTE;
