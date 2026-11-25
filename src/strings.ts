import type { AbsenceNote } from './core/absence';
import type { ActionBlockReason } from './core/actions';
import { DAY, HOUR, MINUTE } from './core/config';
import type { ActionType, AdultForm, CauseOfDeath, LifeStage, Mood, StatKey } from './core/types';

// Все тексты интерфейса — здесь, чтобы игру можно было перевести.

export const T = {
  title: 'Тамагочи',
  intro: 'Заведи питомца и заботься о нём. Он растёт, даже когда вкладка закрыта.',
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
  openMemory: (n: number) => (n > 0 ? `Зал памяти (${n})` : 'Зал памяти'),
} as const;

export const CARE_LABELS: Record<AdultForm, string> = {
  good: 'отличный',
  normal: 'нормальный',
  naughty: 'так себе',
};

export const STAT_LABELS: Record<StatKey, string> = {
  hunger: 'Сытость',
  happiness: 'Счастье',
  energy: 'Энергия',
  hygiene: 'Чистота',
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
      return `${name} весь в грязи`;
    case 'bored':
      return `${name} заскучал`;
    case 'died':
      return `${name} не дождался тебя`;
  }
}

export function formatDuration(ms: number): string {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  return `${Math.max(minutes, 0)} мин`;
}
