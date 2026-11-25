/** Вид животного. Чтобы добавить новый — см. README, раздел «Как добавить животное». */
export type Species = 'cat' | 'dog' | 'blob';
export const SPECIES: readonly Species[] = ['cat', 'dog', 'blob'];

export type LifeStage = 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'elder' | 'dead';
export type Mood = 'happy' | 'normal' | 'sad' | 'sick' | 'sleeping' | 'dead';
export type StatKey = 'hunger' | 'happiness' | 'energy' | 'health';
/** Что нужно питомцу прямо сейчас: низкий показатель или пора убрать какашки. */
export type Need = StatKey | 'poop';
export type ActionType = 'feed' | 'snack' | 'play' | 'sleep' | 'clean' | 'medicine';
export type CauseOfDeath = 'hunger' | 'sickness' | 'neglect' | 'oldAge';
export type AdultForm = 'good' | 'normal' | 'naughty';

/** Значения 0..100. Хранятся дробными, чтобы медленное падение не терялось на секундных тиках; в UI округляются. */
export type Stats = Record<StatKey, number>;

/** Накопленная статистика ухода — из неё считается careScore и форма взрослого питомца. */
export interface CareRecord {
  /** Сумма счастья, умноженного на прожитые минуты (для среднего). */
  happinessMinutes: number;
  minutes: number;
  sicknessCount: number;
}

export interface Pet {
  name: string;
  species: Species;
  stage: LifeStage;
  stats: Stats;
  /** Сколько какашек лежит на полу. */
  poops: number;
  /** Через сколько симуляционных мс появится следующая. */
  poopTimerMs: number;
  /** Запас лакомств: зарабатываются в мини-играх, тратятся кнопкой «Лакомство». */
  treats: number;
  /** Реальное время рождения, мс. */
  bornAt: number;
  /** Прожитое симуляционное время, мс. */
  ageMs: number;
  /** Возраст естественной смерти, выбирается при рождении. */
  lifespanMs: number;
  isSleeping: boolean;
  isSick: boolean;
  /** 0..100, влияет на эволюцию. */
  careScore: number;
  care: CareRecord;
  form?: AdultForm;
  /** Время последних лакомств — для лимита «не больше 3 за час». */
  snackTimes: number[];
  /** Состояние генератора случайных чисел: симуляция детерминирована. */
  rngState: number;
  causeOfDeath?: CauseOfDeath;
  stageAtDeath?: LifeStage;
}

export type GameEvent =
  | { type: 'hatched' }
  | { type: 'stageChanged'; stage: LifeStage }
  | { type: 'gotSick' }
  | { type: 'pooped'; poops: number }
  | { type: 'recovered' }
  | { type: 'fellAsleep'; auto: boolean }
  | { type: 'wokeUp'; auto: boolean }
  | { type: 'died'; cause: CauseOfDeath };

export type Cooldowns = Partial<Record<ActionType, number>>;
