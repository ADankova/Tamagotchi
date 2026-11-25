// Счётчики мини-игр: сколько партий сыграно и выиграно на каждом уровне.
// Хранятся отдельно от питомца и не пропадают, когда он умирает.

export type MiniGameId = 'queens';

export interface LevelStats {
  played: number;
  won: number;
}

/** game → (ключ уровня, у «Судоку» это размер поля) → счётчики. */
export type GameStats = Record<MiniGameId, Record<string, LevelStats>>;

export function emptyStats(): GameStats {
  return { queens: {} };
}

export function levelStats(stats: GameStats, game: MiniGameId, level: string | number): LevelStats {
  return stats[game][String(level)] ?? { played: 0, won: 0 };
}

/** Новые счётчики с одной законченной партией. */
export function recordGame(stats: GameStats, game: MiniGameId, level: string | number, won: boolean): GameStats {
  const key = String(level);
  const before = levelStats(stats, game, key);
  return {
    ...stats,
    [game]: { ...stats[game], [key]: { played: before.played + 1, won: before.won + (won ? 1 : 0) } },
  };
}
