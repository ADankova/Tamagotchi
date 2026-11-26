// Сгенерировано scripts/pets-build.py — не править руками.
export interface RowInfo {
  feet: number;
  left: number;
  right: number;
  frames: number;
}

export interface SheetMeta {
  cell: number;
  cols: number;
  /** Названия строк листа сверху вниз. */
  rows: readonly string[];
  /** Нижняя точка, левый и правый край картинки по всем прежним кадрам (пиксели ячейки). */
  feet: number;
  left: number;
  right: number;
  /** Свои размеры у плавных строк (прежние используют общие). */
  rowInfo?: Readonly<Record<string, RowInfo>>;
}

export const PET_META: Readonly<Record<string, SheetMeta>> = {
  cat_adultGood: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'sick', 'hungry', 'tired', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'roll', 'sleep_twitch'], feet: 62, left: 2, right: 60, rowInfo: { idle_smooth: { feet: 62, left: 2, right: 62, frames: 17 }, catch: { feet: 62, left: 2, right: 60, frames: 17 }, walk: { feet: 62, left: 0, right: 62, frames: 17 }, eat_side: { feet: 62, left: 2, right: 64, frames: 17 }, lie_wag: { feet: 58, left: 2, right: 64, frames: 17 }, roll: { feet: 58, left: 2, right: 62, frames: 17 }, sleep_twitch: { feet: 58, left: 2, right: 58, frames: 17 } } },
  blob_adultGood: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat', 'sick', 'hungry', 'tired'], feet: 62, left: 4, right: 60 },
  dog_adultGood: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat', 'sick', 'hungry', 'tired'], feet: 64, left: 2, right: 62 },
  cat_baby: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'roll', 'sleep_twitch'], feet: 58, left: 10, right: 54, rowInfo: { idle_smooth: { feet: 58, left: 12, right: 54, frames: 17 }, catch: { feet: 58, left: 8, right: 54, frames: 17 }, walk: { feet: 58, left: 8, right: 56, frames: 17 }, eat_side: { feet: 58, left: 8, right: 58, frames: 17 }, lie_wag: { feet: 56, left: 4, right: 58, frames: 17 }, roll: { feet: 56, left: 4, right: 56, frames: 17 }, sleep_twitch: { feet: 52, left: 8, right: 54, frames: 17 } } },
  cat_child: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 62, left: 6, right: 58, rowInfo: { idle_smooth: { feet: 62, left: 8, right: 60, frames: 17 }, catch: { feet: 62, left: 8, right: 58, frames: 17 }, walk: { feet: 62, left: 2, right: 60, frames: 17 }, eat_side: { feet: 62, left: 4, right: 60, frames: 17 }, lie_wag: { feet: 60, left: 2, right: 64, frames: 17 }, sleep_twitch: { feet: 51, left: 9, right: 56, frames: 17 } } },
  cat_teen: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 63, left: 10, right: 58, rowInfo: { idle_smooth: { feet: 63, left: 12, right: 57, frames: 17 }, catch: { feet: 63, left: 12, right: 58, frames: 17 }, walk: { feet: 56, left: 2, right: 61, frames: 17 }, eat_side: { feet: 56, left: 2, right: 64, frames: 17 }, lie_wag: { feet: 52, left: 2, right: 64, frames: 17 }, sleep_twitch: { feet: 55, left: 3, right: 60, frames: 17 } } },
  cat_adultNaughty: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 62, left: 2, right: 62, rowInfo: { idle_smooth: { feet: 62, left: 2, right: 62, frames: 17 }, catch: { feet: 62, left: 2, right: 60, frames: 17 }, walk: { feet: 62, left: 2, right: 60, frames: 17 }, eat_side: { feet: 62, left: 2, right: 60, frames: 17 }, lie_wag: { feet: 56, left: 4, right: 64, frames: 17 }, sleep_twitch: { feet: 58, left: 2, right: 62, frames: 17 } } },
  cat_elder: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 62, left: 2, right: 58, rowInfo: { idle_smooth: { feet: 62, left: 2, right: 62, frames: 17 }, catch: { feet: 62, left: 2, right: 60, frames: 17 }, walk: { feet: 60, left: 2, right: 60, frames: 17 }, eat_side: { feet: 60, left: 4, right: 60, frames: 17 }, lie_wag: { feet: 54, left: 2, right: 64, frames: 17 }, sleep_twitch: { feet: 56, left: 2, right: 62, frames: 17 } } },
  cat_adultNormal: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 62, left: 2, right: 62, rowInfo: { idle_smooth: { feet: 62, left: 2, right: 62, frames: 17 }, catch: { feet: 62, left: 2, right: 60, frames: 17 }, walk: { feet: 62, left: 2, right: 60, frames: 17 }, eat_side: { feet: 62, left: 2, right: 62, frames: 17 }, lie_wag: { feet: 54, left: 2, right: 64, frames: 17 }, sleep_twitch: { feet: 54, left: 2, right: 60, frames: 17 } } },
  blob_baby: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 52, left: 17, right: 47 },
  blob_child: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 52, left: 10, right: 54 },
  blob_teen: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 10, right: 54 },
  blob_adultNaughty: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 4, right: 60 },
  blob_elder: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 4, right: 60 },
  blob_adultNormal: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 4, right: 60 },
  dog_baby: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 64, left: 2, right: 62, rowInfo: { idle_smooth: { feet: 64, left: 4, right: 60, frames: 17 }, catch: { feet: 64, left: 4, right: 60, frames: 17 }, walk: { feet: 56, left: 5, right: 56, frames: 17 }, eat_side: { feet: 56, left: 6, right: 56, frames: 17 }, lie_wag: { feet: 53, left: 10, right: 57, frames: 17 }, sleep_twitch: { feet: 52, left: 5, right: 58, frames: 17 } } },
  dog_child: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 55, left: 11, right: 53, rowInfo: { idle_smooth: { feet: 55, left: 12, right: 52, frames: 17 }, catch: { feet: 55, left: 8, right: 56, frames: 17 }, walk: { feet: 55, left: 8, right: 55, frames: 17 }, eat_side: { feet: 55, left: 7, right: 57, frames: 17 }, lie_wag: { feet: 54, left: 7, right: 55, frames: 17 }, sleep_twitch: { feet: 48, left: 7, right: 56, frames: 17 } } },
  dog_teen: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 64, left: 8, right: 56, rowInfo: { idle_smooth: { feet: 64, left: 8, right: 58, frames: 17 }, catch: { feet: 64, left: 8, right: 58, frames: 17 }, walk: { feet: 60, left: 0, right: 62, frames: 17 }, eat_side: { feet: 60, left: 2, right: 62, frames: 17 }, lie_wag: { feet: 54, left: 6, right: 62, frames: 17 }, sleep_twitch: { feet: 56, left: 4, right: 60, frames: 17 } } },
  dog_adultNaughty: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 64, left: 2, right: 62, rowInfo: { idle_smooth: { feet: 64, left: 2, right: 64, frames: 17 }, catch: { feet: 64, left: 2, right: 62, frames: 17 }, walk: { feet: 60, left: 4, right: 58, frames: 17 }, eat_side: { feet: 60, left: 4, right: 59, frames: 17 }, lie_wag: { feet: 56, left: 4, right: 63, frames: 17 }, sleep_twitch: { feet: 54, left: 4, right: 58, frames: 17 } } },
  dog_elder: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 64, left: 2, right: 62, rowInfo: { idle_smooth: { feet: 64, left: 2, right: 62, frames: 17 }, catch: { feet: 64, left: 1, right: 63, frames: 17 }, walk: { feet: 58, left: 4, right: 60, frames: 17 }, eat_side: { feet: 58, left: 8, right: 60, frames: 17 }, lie_wag: { feet: 57, left: 6, right: 60, frames: 17 }, sleep_twitch: { feet: 51, left: 7, right: 57, frames: 17 } } },
  dog_adultNormal: { cell: 64, cols: 17, rows: ['idle', 'sleep', 'eat', 'idle_smooth', 'catch', 'walk', 'eat_side', 'lie_wag', 'sleep_twitch'], feet: 64, left: 2, right: 62, rowInfo: { idle_smooth: { feet: 64, left: 2, right: 62, frames: 17 }, catch: { feet: 64, left: 2, right: 62, frames: 17 }, walk: { feet: 62, left: 2, right: 60, frames: 17 }, eat_side: { feet: 62, left: 0, right: 62, frames: 17 }, lie_wag: { feet: 56, left: 8, right: 60, frames: 17 }, sleep_twitch: { feet: 54, left: 4, right: 62, frames: 17 } } },
  props_egg: { cell: 64, cols: 11, rows: ['wobble9_cracked_grave'], feet: 62, left: 7, right: 57 },
  butterfly: { cell: 32, cols: 5, rows: ['flap'], feet: 29, left: 1, right: 31 },
};
