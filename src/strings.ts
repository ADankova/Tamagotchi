import type { AbsenceNote } from './core/absence';
import type { ActionBlockReason } from './core/actions';
import { DAY, HOUR, MINUTE } from './core/config';
import type { AttentionReason } from './core/forecast';
import type { ActionType, AdultForm, CauseOfDeath, LifeStage, Mood, Species, StatKey } from './core/types';

// Все тексты интерфейса — здесь, чтобы игру можно было перевести.

export const T = {
  title: 'Тамагочи',
  intro: 'Заведи питомца и заботься о нём. Он растёт, даже когда приложение закрыто.',
  chooseSpecies: 'Кто вылупится?',
  nameLabel: 'Имя питомца',
  namePlaceholder: 'Например, Пушок',
  nameRequired: 'Придумай питомцу имя.',
  name: 'Имя',
  newGame: 'Новая игра',
  newEgg: 'Новое яйцо',
  age: 'Возраст',
  stage: 'Стадия',
  cause: 'Причина',
  resultsTitle: 'Питомец умер',
  graveyard: 'Зал памяти',
  settings: 'Настройки',
  reset: 'Сбросить сохранение',
  resetConfirm: 'Удалить питомца, Зал памяти и все настройки? Это нельзя отменить.',
  corrupted: 'Сохранение было повреждено, игра начата заново.',
  saveFailed: 'Не удалось сохранить игру: браузер не даёт писать в хранилище.',
  absenceTitle: (time: string) => `Пока тебя не было ${time}:`,
  absenceNothing: 'всё спокойно.',
  dismiss: 'Понятно',
  debug: 'Отладка',
  speed: 'Скорость времени',
  care: 'Уход',
  sicknesses: 'Болезней',
  back: 'Назад',
  memoryIntro: 'Здесь помнят всех твоих питомцев.',
  memoryEmpty: 'Пока здесь никого нет.',
  memoryCount: (n: number) => `Всего питомцев: ${n}`,
  memoryRecord: (name: string, age: string) => `Дольше всех прожил ${name} — ${age}`,
  lived: 'прожил',
  diedOn: (date: string) => `умер ${date}`,
  diedWhileAway: (name: string) => `${name} не дождался тебя.`,
  testNotification: 'Проверка: напоминания работают. Можно возвращаться к питомцу!',
  openMemory: (n: number) => (n > 0 ? `Зал памяти (${n})` : 'Зал памяти'),
} as const;

export const ATTENTION_TEXT: Record<AttentionReason, (name: string) => string> = {
  hatch: (name) => `${name} вылупился! Загляни познакомиться.`,
  hungry: (name) => `${name} проголодался.`,
  dirty: (name) => `${name} насорил — пора убрать.`,
  bored: (name) => `${name} скучает без тебя.`,
  sick: (name) => `${name} заболел. Нужно лекарство.`,
  dying: (name) => `${name} очень плохо себя чувствует!`,
};

export const ATTENTION_SHORT: Record<AttentionReason, string> = {
  hatch: 'вылупление',
  hungry: 'голод',
  dirty: 'грязь',
  bored: 'скука',
  sick: 'болезнь',
  dying: 'плохое самочувствие',
};

export const SETTINGS_TEXT = {
  title: 'Настройки',
  sound: 'Звук',
  soundHint: '8-битные звуки на действия и события.',
  notifications: 'Напоминания',
  notificationsHint: 'Сообщим, когда питомцу понадобится забота.',
  notificationsDenied: 'Уведомления запрещены. Разрешите их в настройках телефона: Приложения → Тамагочи → Уведомления.',
  notificationsUnsupported: 'Этот браузер не умеет показывать уведомления.',
  notificationsWeb: 'В браузере напоминание придёт, только пока вкладка открыта.',
  testButton: 'Проверить уведомление',
  testSent: 'Через 5 секунд придёт пробное уведомление. Можно свернуть приложение.',
  testFailed: 'Не удалось: уведомления не разрешены.',
  lastReminder: (time: string, what: string) => `Последнее напоминание было запланировано на ${time} (${what}).`,
  data: 'Данные',
  version: (v: string) => `Версия ${v}`,
} as const;

export function treatWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'лакомство';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'лакомства';
  return 'лакомств';
}

export const GAMES_TEXT = {
  menuTitle: 'Мини-игры',
  menuIntro: 'Играй с питомцем и зарабатывай лакомства.',
  close: 'Закрыть',
  queensTitle: 'Судоку с питомцем',
  queensAbout: 'Расставь питомцев: по одному в каждой строке, столбце и цветной зоне. Питомцы не должны касаться друг друга — даже углами.',
  level: (size: number, reward: number) => `${size}×${size} · +${reward} ${treatWord(reward)}`,
  levelNames: ['Легко', 'Средне', 'Сложно'] as readonly string[],
  soon: 'Скоро здесь появятся новые игры',
  rules: {
    region: '1 питомец на цвет',
    line: '1 в строке и столбце',
    touch: 'Не соприкасаются',
  },
  hint: 'Касание — крестик, проведи пальцем — несколько крестиков, двойное касание — питомец',
  progress: (placed: number, size: number) => `${placed}/${size}`,
  livesLabel: (n: number) => `Осталось сердечек: ${n}`,
  wrong: 'Здесь питомца быть не может',
  winTitle: 'Победа!',
  winText: (name: string, reward: number) => `${name} в восторге! Награда: +${reward} ${treatWord(reward)}.`,
  winButton: 'Забрать награду',
  loseTitle: 'Сердечки закончились',
  loseText: (name: string) => `Ничего страшного — ${name} всё равно повеселился.`,
  retry: 'Ещё раз',
  finish: 'Закончить',
  leaveConfirm: 'Выйти из игры? Прогресс не сохранится.',
  cell: (r: number, c: number, color: string) => `Строка ${r}, столбец ${c}, ${color} зона`,
  cellPet: 'питомец',
  cellCross: 'крестик',
  regionColors: ['розовая', 'жёлтая', 'голубая', 'мятная', 'сиреневая', 'коралловая', 'песочная'] as readonly string[],
  earned: (n: number) => `+${n} ${treatWord(n)}!`,
} as const;

export const DEV_TEXT = {
  title: 'Режим тестирования',
  hint: 'Ускоряет время, чтобы быстро проверить вылупление, взросление, болезни и напоминания. После перезапуска приложения скорость снова ×1.',
  speed: 'Скорость времени',
  stats: 'Показатели питомца',
  hide: 'Скрыть режим тестирования',
  addPoop: '+1 какашка',
  enabled: 'Режим тестирования включён — он внизу настроек.',
  tapsLeft: (n: number) => `Ещё ${n} — и откроется режим тестирования`,
  badge: (scale: number) => `×${scale}`,
  badgeLabel: (scale: number) => `Время ускорено в ${scale} раз. Нажмите, чтобы вернуть обычную скорость.`,
} as const;

export const SPECIES_LABELS: Record<Species, string> = {
  cat: 'Кошечка',
  dog: 'Собачка',
  blob: 'Пушистик',
};

export const CARE_LABELS: Record<AdultForm, string> = {
  good: 'отличный',
  normal: 'нормальный',
  naughty: 'так себе',
};

export const STAT_LABELS: Record<StatKey, string> = {
  hunger: 'Сытость',
  happiness: 'Счастье',
  energy: 'Энергия',
  health: 'Здоровье',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  feed: 'Покормить',
  snack: 'Лакомство',
  play: 'Поиграть',
  sleep: 'Спать',
  clean: 'Убрать',
  medicine: 'Лекарство',
};

export const WAKE_LABEL = 'Разбудить';

export const STAGE_LABELS: Record<LifeStage, string> = {
  egg: 'яйцо',
  baby: 'малыш',
  child: 'ребёнок',
  teen: 'подросток',
  adult: 'взрослый',
  elder: 'старость',
  dead: 'умер',
};

export const FORM_LABELS: Record<AdultForm, string> = {
  good: 'хороший',
  normal: 'обычный',
  naughty: 'вредный',
};

export const MOOD_LABELS: Record<Mood, string> = {
  happy: 'Доволен жизнью',
  normal: 'Всё нормально',
  sad: 'Чего-то не хватает',
  sick: 'Болеет',
  sleeping: 'Спит',
  dead: 'Умер',
};

export const CAUSE_LABELS: Record<CauseOfDeath, string> = {
  hunger: 'голод',
  sickness: 'болезнь',
  neglect: 'плохой уход',
  oldAge: 'старость',
};

export const BLOCK_REASONS: Record<ActionBlockReason, string> = {
  noPet: 'Сначала заведи питомца.',
  egg: 'Питомец ещё не вылупился.',
  dead: 'Питомец умер.',
  sleeping: 'Питомец спит.',
  sick: 'Питомец болеет и не хочет играть.',
  cooldown: 'Подожди пару секунд.',
  noTreats: 'Нет лакомств — заработай в «Поиграть»!',
  clean: 'Убирать нечего — всё чисто.',
};

export const EVENT_MESSAGES = {
  hatched: (name: string) => `${name} вылупился!`,
  grew: (name: string, stage: LifeStage) => `${name} подрос: теперь ${STAGE_LABELS[stage]}.`,
  gotSick: (name: string) => `${name} заболел. Дай лекарство.`,
  recovered: (name: string) => `${name} выздоровел.`,
  fellAsleepAuto: (name: string) => `${name} уснул от усталости.`,
  wokeUpAuto: (name: string) => `${name} выспался и проснулся.`,
};

export function absenceNoteText(name: string, note: AbsenceNote): string {
  switch (note.kind) {
    case 'hatched':
      return `${name} вылупился`;
    case 'grew':
      return `${name} подрос до стадии «${STAGE_LABELS[note.stage]}»`;
    case 'gotSick':
      return `${name} заболел`;
    case 'sleeping':
      return `${name} сейчас спит`;
    case 'hungry':
      return `${name} проголодался`;
    case 'dirty':
      return `${name} насорил — на полу ${note.poops} ${poopWord(note.poops)}`;
    case 'pooped':
      return `${name} насорил (${note.poops} ${poopWord(note.poops)})`;
    case 'bored':
      return `${name} заскучал`;
    case 'died':
      return `${name} не дождался тебя`;
  }
}

/** «какашка / какашки / какашек» по числу. */
export function poopWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'какашка';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'какашки';
  return 'какашек';
}

export const POOP_TEXT = {
  label: 'Уборка',
  clean: 'чисто',
  count: (n: number) => `${n} ${poopWord(n)} на полу`,
  pooped: (name: string) => `${name} насорил. Пора убрать!`,
} as const;

export function formatDuration(ms: number): string {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  return `${Math.max(minutes, 0)} мин`;
}
