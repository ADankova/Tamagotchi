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
  cat_baby: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 58, left: 10, right: 54 },
  cat_child: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 6, right: 58 },
  cat_teen: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 63, left: 10, right: 58 },
  cat_adultNaughty: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 2, right: 62 },
  cat_elder: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 2, right: 58 },
  cat_adultNormal: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 2, right: 62 },
  blob_baby: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 52, left: 17, right: 47 },
  blob_child: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 52, left: 10, right: 54 },
  blob_teen: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 10, right: 54 },
  blob_adultNaughty: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 4, right: 60 },
  blob_elder: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 4, right: 60 },
  blob_adultNormal: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 62, left: 4, right: 60 },
  dog_baby: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 64, left: 2, right: 62 },
  dog_child: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 55, left: 11, right: 53 },
  dog_teen: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 64, left: 8, right: 56 },
  dog_adultNaughty: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 64, left: 2, right: 62 },
  dog_elder: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 64, left: 2, right: 62 },
  dog_adultNormal: { cell: 64, cols: 9, rows: ['idle', 'sleep', 'eat'], feet: 64, left: 2, right: 62 },
  props_egg: { cell: 64, cols: 11, rows: ['wobble9_cracked_grave'], feet: 62, left: 7, right: 57 },
  butterfly: { cell: 32, cols: 5, rows: ['flap'], feet: 29, left: 1, right: 31 },
};
