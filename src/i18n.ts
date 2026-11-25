import { en } from './lang/en';
import { ru, type Dict } from './lang/ru';

// Выбор языка интерфейса. Тексты лежат в lang/ru.ts и lang/en.ts (одинаковой формы);
// strings.ts отдаёт их «живыми» объектами — они всегда показывают текущий язык.

export type Language = 'ru' | 'en';

export const LANGUAGES: ReadonlyArray<{ code: Language; name: string }> = [
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
];

const DICTS: Record<Language, Dict> = { ru, en };
const LOCALES: Record<Language, string> = { ru: 'ru-RU', en: 'en-US' };

let current: Language = 'ru';

export function isLanguage(v: unknown): v is Language {
  return v === 'ru' || v === 'en';
}

export function getLanguage(): Language {
  return current;
}

export function setLanguage(lang: Language): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function locale(): string {
  return LOCALES[current];
}

/** Язык телефона: русский — русский, всё остальное — английский. */
export function detectLanguage(): Language {
  const nav = (globalThis as { navigator?: { language?: string } }).navigator;
  return nav?.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** Словарь текущего языка. */
export function dict(): Dict {
  return DICTS[current];
}

/** Объект-«окно» на раздел словаря: читает всегда из текущего языка. */
export function liveObject<K extends keyof Dict>(key: K): Dict[K] {
  return new Proxy({} as object, {
    get: (_t, prop) => (dict()[key] as Record<string | symbol, unknown>)[prop],
    has: (_t, prop) => prop in (dict()[key] as object),
    ownKeys: () => Reflect.ownKeys(dict()[key] as object),
    getOwnPropertyDescriptor: (_t, prop) => {
      const d = Reflect.getOwnPropertyDescriptor(dict()[key] as object, prop);
      return d ? { ...d, configurable: true } : undefined;
    },
  }) as Dict[K];
}
