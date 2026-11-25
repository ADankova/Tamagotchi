import { describe, expect, it } from 'vitest';
import { detectLanguage, getLanguage, setLanguage } from '../src/i18n';
import { en } from '../src/lang/en';
import { ru } from '../src/lang/ru';
import { ACTION_LABELS, GAMES_TEXT, STAGE_LABELS, T, treatWord } from '../src/strings';

function shape(v: unknown): unknown {
  if (typeof v === 'function') return 'fn';
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]));
  return typeof v;
}

describe('языки', () => {
  it('у русского и английского словаря одна и та же форма', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    expect(shape(en)).toEqual(shape(ru));
  });

  it('тексты переключаются на лету', () => {
    expect(T.title).toBe('Тамагочи');
    expect(ACTION_LABELS.feed).toBe('Покормить');
    setLanguage('en');
    try {
      expect(getLanguage()).toBe('en');
      expect(T.title).toBe('Tamagotchi');
      expect(ACTION_LABELS.feed).toBe('Feed');
      expect(STAGE_LABELS.egg).toBe('egg');
      expect(GAMES_TEXT.level(8, 2)).toBe('8×8 · +2 treats');
      expect(treatWord(1)).toBe('treat');
    } finally {
      setLanguage('ru');
    }
  });

  it('для всех десяти зон «Судоку» есть названия цветов на обоих языках', () => {
    expect(ru.GAMES_TEXT.regionColors.length).toBeGreaterThanOrEqual(10);
    expect(en.GAMES_TEXT.regionColors.length).toBeGreaterThanOrEqual(10);
  });

  it('язык по умолчанию: русский телефон — русский, остальные — английский', () => {
    const nav = (globalThis as { navigator?: unknown }).navigator;
    const set = (language: string) =>
      Object.defineProperty(globalThis, 'navigator', { value: { language }, configurable: true });
    try {
      set('ru-RU');
      expect(detectLanguage()).toBe('ru');
      set('de-DE');
      expect(detectLanguage()).toBe('en');
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    }
  });
});
