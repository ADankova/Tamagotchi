import { dict, liveObject } from './i18n';
import type { Dict } from './lang/ru';

// Все тексты интерфейса. Реальные строки — в lang/ru.ts и lang/en.ts; здесь — «живые» ссылки
// на текущий язык, поэтому остальной код просто пишет T.title, STAGE_LABELS[stage] и т.п.

export const T = liveObject('T');
export const ATTENTION_TEXT = liveObject('ATTENTION_TEXT');
export const ATTENTION_SHORT = liveObject('ATTENTION_SHORT');
export const SETTINGS_TEXT = liveObject('SETTINGS_TEXT');
export const GAMES_TEXT = liveObject('GAMES_TEXT');
export const DEV_TEXT = liveObject('DEV_TEXT');
export const SPECIES_LABELS = liveObject('SPECIES_LABELS');
export const CARE_LABELS = liveObject('CARE_LABELS');
export const STAT_LABELS = liveObject('STAT_LABELS');
export const ACTION_LABELS = liveObject('ACTION_LABELS');
export const STAGE_LABELS = liveObject('STAGE_LABELS');
export const FORM_LABELS = liveObject('FORM_LABELS');
export const MOOD_LABELS = liveObject('MOOD_LABELS');
export const CAUSE_LABELS = liveObject('CAUSE_LABELS');
export const BLOCK_REASONS = liveObject('BLOCK_REASONS');
export const EVENT_MESSAGES = liveObject('EVENT_MESSAGES');
export const POOP_TEXT = liveObject('POOP_TEXT');

export function wakeLabel(): string {
  return dict().WAKE_LABEL;
}
export const treatWord: Dict['treatWord'] = (n) => dict().treatWord(n);
export const poopWord: Dict['poopWord'] = (n) => dict().poopWord(n);
export const absenceNoteText: Dict['absenceNoteText'] = (name, note) => dict().absenceNoteText(name, note);
export const formatDuration: Dict['formatDuration'] = (ms) => dict().formatDuration(ms);
