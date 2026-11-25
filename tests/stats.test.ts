import { describe, expect, it } from 'vitest';
import { emptyStats, levelStats, recordGame } from '../src/core/stats';
import { QUEENS_LEVELS } from '../src/core/queens';
import { Game } from '../src/game';
import { createInitialState, deserialize, serialize, migrate, SAVE_VERSION } from '../src/storage/save';

describe('счётчики мини-игр', () => {
  it('считают сыгранные и выигранные партии по уровням', () => {
    let s = emptyStats();
    s = recordGame(s, 'queens', 6, true);
    s = recordGame(s, 'queens', 6, false);
    s = recordGame(s, 'queens', 10, false);
    expect(levelStats(s, 'queens', 6)).toEqual({ played: 2, won: 1 });
    expect(levelStats(s, 'queens', 10)).toEqual({ played: 1, won: 0 });
    expect(levelStats(s, 'queens', 8)).toEqual({ played: 0, won: 0 });
  });

  it('уровни судоку: 6×6, 8×8, 10×10 и награды 1, 2, 3', () => {
    expect(QUEENS_LEVELS).toEqual([
      { size: 6, reward: 1 },
      { size: 8, reward: 2 },
      { size: 10, reward: 3 },
    ]);
  });

  it('сохраняются вместе с игрой', () => {
    const state = createInitialState(1000, 'en');
    state.gameStats = recordGame(state.gameStats, 'queens', 8, true);
    const back = deserialize(serialize(state));
    expect(back?.gameStats.queens['8']).toEqual({ played: 1, won: 1 });
    expect(back?.settings.language).toBe('en');
  });

  it('старое сохранение (v4) переезжает: русский язык и нулевые счётчики', () => {
    const v4 = { ...JSON.parse(serialize(createInitialState(1000))), version: 4 };
    delete v4.gameStats;
    delete v4.settings.language;
    const moved = migrate(v4);
    expect(moved?.version).toBe(SAVE_VERSION);
    expect((moved?.settings as { language: string }).language).toBe('ru');
    expect(moved?.gameStats).toEqual({ queens: {}, slide: {} });
  });

  it('Game.finishMiniGame записывает партию, даже если питомец уже не может играть', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const game = new Game({ storage, now: () => 5000 });
    game.start();
    game.finishMiniGame(false, 0, { game: 'queens', key: 6 });
    game.finishMiniGame(true, 1, { game: 'queens', key: 6 });
    expect(levelStats(game.state.gameStats, 'queens', 6)).toEqual({ played: 2, won: 1 });
  });

  it('«Питомцы-блоки»: рекорд полос и лакомства прямо во время игры', () => {
    let s = emptyStats();
    s = recordGame(s, 'slide', 10, false, 12);
    s = recordGame(s, 'slide', 10, true, 7);
    expect(levelStats(s, 'slide', 10)).toEqual({ played: 2, won: 1, best: 12 });
  });

  it('сохранение 1.6.0 без счётчиков «Питомцев-блоков» читается', () => {
    const raw = JSON.parse(serialize(createInitialState(1000, 'ru')));
    raw.gameStats = { queens: { '6': { played: 3, won: 2 } } };
    const back = deserialize(JSON.stringify(raw));
    expect(back?.gameStats).toEqual({ queens: { '6': { played: 3, won: 2 } }, slide: {} });
  });
});
