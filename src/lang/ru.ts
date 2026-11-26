import type { AbsenceNote } from '../core/absence';
import type { ActionBlockReason } from '../core/actions';
import { DAY, HOUR, MINUTE } from '../core/config';
import type { AttentionReason } from '../core/forecast';
import type { ActionType, AdultForm, CauseOfDeath, LifeStage, Mood, Species, StatKey } from '../core/types';

// Русские тексты интерфейса. Английские — в en.ts (та же форма), выбор языка — в ../i18n.ts.

const T = {
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
};

const ATTENTION_TEXT: Record<AttentionReason, (name: string) => string> = {
  hatch: (name) => `${name} вылупился! Загляни познакомиться.`,
  hungry: (name) => `${name} проголодался.`,
  dirty: (name) => `${name} насорил — пора убрать.`,
  bored: (name) => `${name} скучает без тебя.`,
  sick: (name) => `${name} заболел. Нужно лекарство.`,
  dying: (name) => `${name} очень плохо себя чувствует!`,
};

const ATTENTION_SHORT: Record<AttentionReason, string> = {
  hatch: 'вылупление',
  hungry: 'голод',
  dirty: 'грязь',
  bored: 'скука',
  sick: 'болезнь',
  dying: 'плохое самочувствие',
};

const SETTINGS_TEXT = {
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
  language: 'Язык',
  languageHint: 'Язык интерфейса. Игра перезапустится, прогресс сохранится.',
  data: 'Данные',
  version: (v: string) => `Версия ${v}`,
};

function treatWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'лакомство';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'лакомства';
  return 'лакомств';
}

const GAMES_TEXT = {
  menuTitle: 'Мини-игры',
  menuIntro: 'Играй с питомцем и зарабатывай лакомства.',
  close: 'Закрыть',
  rulesButton: (game: string) => `Правила игры «${game}»`,
  queensTitle: 'Судоку с питомцем',
  queensAbout: 'Расставь питомцев: по одному в каждой строке, столбце и цветной зоне. Питомцы не должны касаться друг друга — даже углами.',
  level: (size: number, reward: number) => `${size}×${size} · +${reward} ${treatWord(reward)}`,
  levelNames: ['Легко', 'Средне', 'Сложно'] as readonly string[],
  stats: (played: number, won: number) => `Сыграно: ${played} · Побед: ${won}`,
  slideTitle: 'Питомцы-блоки',
  slideAbout:
    'Двигай блоки пальцем влево и вправо. Заполни полосу целиком — она исчезнет. Блок с лакомством исчезнет — лакомство твоё. Два режима: в «Лавине» после каждого хода сверху падает новая полоса, в «Приливе» она вырастает снизу и поднимает стопку. На блоках бывают бонусы: заморозка на 3 хода, молния (убирает соседей сверху и снизу) и крошки (разбивают блоки в поле 3×3). Не дай стопке дорасти до верха!',
  slidePlay: 'Играть',
  slideModeName: { fall: 'Лавина', rise: 'Прилив' },
  slideModeInfo: { fall: 'Блоки падают сверху', rise: 'Блоки растут снизу' },
  slideStats: (played: number, best: number) => `Сыграно: ${played} · Рекорд: ${best} ${lineWord(best)}`,
  slideLines: (n: number) => `${n} ${lineWord(n)}`,
  slideTreats: (n: number) => `Лакомств: ${n}`,
  slideNext: { fall: 'Дальше упадёт', rise: 'Дальше вырастет' },
  slideHint: 'Тяни блок пальцем влево или вправо',
  slideOverTitle: 'Стопка до самого верха!',
  slideOverText: (name: string, lines: number, treats: number) =>
    treats > 0
      ? `Убрано ${lines} ${lineWord(lines)}. ${name} получает ${treats} ${treatWord(treats)}!`
      : `Убрано ${lines} ${lineWord(lines)}. ${name} отлично повеселился.`,
  slideRecord: 'Новый рекорд!',
  slideResumed: 'Игра продолжена с того места, где ты остановилась.',
  slideLeaveConfirm: 'Закончить игру? Собранные лакомства уже твои.',
  slideFreeze: 'Заморозка',
  slideFreezeEmpty: 'Нет заморозки',
  slideCrumbsEmpty: 'Нет крошек',
  slideCrumbs: 'Крошки',
  slideFrozen: (n: number) => `Заморожено: ${n} ${n === 1 ? 'ход' : n < 5 ? 'хода' : 'ходов'}`,
  slideBonusGot: { freeze: 'Заморозка в запасе!', crumbs: 'Крошки в запасе!', lightning: 'Молния!' },
  slideNoCrumbTarget: 'Крошкам нечего разбивать',
  slideBonusHint: 'Бонусы на блоках: заморозка, молния, крошки',
  slideBlock: (row: number, col: number, len: number) => `Блок: строка ${row}, клетки ${col}–${col + len - 1}`,
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
  regionColors: ['розовая', 'жёлтая', 'голубая', 'мятная', 'сиреневая', 'коралловая', 'песочная', 'салатовая', 'лиловая', 'васильковая'] as readonly string[],
  earned: (n: number) => `+${n} ${treatWord(n)}!`,
};

const DEV_TEXT = {
  title: 'Режим тестирования',
  hint: 'Ускоряет время, чтобы быстро проверить вылупление, взросление, болезни и напоминания. После перезапуска приложения скорость снова ×1.',
  speed: 'Скорость времени',
  stats: 'Показатели питомца',
  hide: 'Скрыть режим тестирования',
  addPoop: '+1 какашка',
  enabled: 'Режим тестирования включён — он внизу настроек.',
  tapsLeft: (n: number) => `Ещё ${n} — и откроется режим тестирования`,
  animButton: 'Анимации',
  animOff: 'Обычное поведение',
  animSpeciesOwn: 'Мой питомец',
  animSpecies: { cat: 'Кошечка', dog: 'Собачка', blob: 'Пушистик' } as Record<string, string>,
  animRows: {
    idle: 'Покой (старая)', sleep: 'Сон (старая)', eat: 'Еда (старая)', sick: 'Болезнь', hungry: 'Голод', tired: 'Усталость',
    idle_smooth: 'Покой', catch: 'Ловит лакомство', walk: 'Ходьба', eat_side: 'Еда боком', lie_wag: 'Лежит', roll: 'Кувырок', sleep_twitch: 'Сон',
  } as Record<string, string>,
  badge: (scale: number) => `×${scale}`,
  badgeLabel: (scale: number) => `Время ускорено в ${scale} раз. Нажмите, чтобы вернуть обычную скорость.`,
};

const SPECIES_LABELS: Record<Species, string> = {
  cat: 'Кошечка',
  dog: 'Собачка',
  blob: 'Пушистик',
};

const CARE_LABELS: Record<AdultForm, string> = {
  good: 'отличный',
  normal: 'нормальный',
  naughty: 'так себе',
};

const STAT_LABELS: Record<StatKey, string> = {
  hunger: 'Сытость',
  happiness: 'Счастье',
  energy: 'Энергия',
  health: 'Здоровье',
};

const ACTION_LABELS: Record<ActionType, string> = {
  feed: 'Покормить',
  snack: 'Лакомство',
  play: 'Поиграть',
  sleep: 'Спать',
  clean: 'Убрать',
  medicine: 'Лекарство',
};

const WAKE_LABEL = 'Разбудить';

const STAGE_LABELS: Record<LifeStage, string> = {
  egg: 'яйцо',
  baby: 'малыш',
  child: 'ребёнок',
  teen: 'подросток',
  adult: 'взрослый',
  elder: 'старость',
  dead: 'умер',
};

const FORM_LABELS: Record<AdultForm, string> = {
  good: 'хороший',
  normal: 'обычный',
  naughty: 'вредный',
};

const MOOD_LABELS: Record<Mood, string> = {
  happy: 'Доволен жизнью',
  normal: 'Всё нормально',
  sad: 'Чего-то не хватает',
  sick: 'Болеет',
  sleeping: 'Спит',
  dead: 'Умер',
};

const CAUSE_LABELS: Record<CauseOfDeath, string> = {
  hunger: 'голод',
  sickness: 'болезнь',
  neglect: 'плохой уход',
  oldAge: 'старость',
};

const BLOCK_REASONS: Record<ActionBlockReason, string> = {
  noPet: 'Сначала заведи питомца.',
  egg: 'Питомец ещё не вылупился.',
  dead: 'Питомец умер.',
  sleeping: 'Питомец спит.',
  sick: 'Питомец болеет и не хочет играть.',
  cooldown: 'Подожди пару секунд.',
  noTreats: 'Нет лакомств — заработай в «Поиграть»!',
  clean: 'Убирать нечего — всё чисто.',
};

const EVENT_MESSAGES = {
  hatched: (name: string) => `${name} вылупился!`,
  grew: (name: string, stage: LifeStage) => `${name} подрос: теперь ${STAGE_LABELS[stage]}.`,
  gotSick: (name: string) => `${name} заболел. Дай лекарство.`,
  recovered: (name: string) => `${name} выздоровел.`,
  fellAsleepAuto: (name: string) => `${name} уснул от усталости.`,
  wokeUpAuto: (name: string) => `${name} выспался и проснулся.`,
};

function absenceNoteText(name: string, note: AbsenceNote): string {
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

/** «полоса / полосы / полос» по числу. */
function lineWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'полоса';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'полосы';
  return 'полос';
}

/** «какашка / какашки / какашек» по числу. */
function poopWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'какашка';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'какашки';
  return 'какашек';
}

const POOP_TEXT = {
  label: 'Уборка',
  clean: 'чисто',
  count: (n: number) => `${n} ${poopWord(n)} на полу`,
  pooped: (name: string) => `${name} насорил. Пора убрать!`,
};

function formatDuration(ms: number): string {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  return `${Math.max(minutes, 0)} мин`;
}

export const ru = {
  T,
  ATTENTION_TEXT,
  ATTENTION_SHORT,
  SETTINGS_TEXT,
  treatWord,
  GAMES_TEXT,
  DEV_TEXT,
  SPECIES_LABELS,
  CARE_LABELS,
  STAT_LABELS,
  ACTION_LABELS,
  WAKE_LABEL,
  STAGE_LABELS,
  FORM_LABELS,
  MOOD_LABELS,
  CAUSE_LABELS,
  BLOCK_REASONS,
  EVENT_MESSAGES,
  absenceNoteText,
  poopWord,
  POOP_TEXT,
  formatDuration,
};

export type Dict = typeof ru;
