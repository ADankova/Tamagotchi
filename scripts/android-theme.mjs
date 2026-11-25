// Настраивает тему Android-приложения под системные панели:
// панели закрашены цветом фона игры, значки на них тёмные.
// Отступ самого приложения от панелей задаёт Capacitor (android.adjustMarginsForEdgeToEdge).
//
//   node scripts/android-theme.mjs android/app/src/main/res

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BG = '#EFE9DC';
const res = process.argv[2];
if (!res) {
  console.error('Укажите папку res Android-проекта');
  process.exit(1);
}

mkdirSync(join(res, 'values'), { recursive: true });
writeFileSync(
  join(res, 'values', 'tamagotchi_colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="tamagotchi_background">${BG}</color>\n</resources>\n`,
);

const stylesPath = join(res, 'values', 'styles.xml');
let styles = readFileSync(stylesPath, 'utf8');

if (!styles.includes('tamagotchi_background')) {
  const items = [
    '<item name="android:windowBackground">@color/tamagotchi_background</item>',
    '<item name="android:statusBarColor">@color/tamagotchi_background</item>',
    '<item name="android:navigationBarColor">@color/tamagotchi_background</item>',
    '<item name="android:windowLightStatusBar" tools:targetApi="23">true</item>',
    '<item name="android:windowLightNavigationBar" tools:targetApi="27">true</item>',
  ];
  const re = /(<style name="AppTheme\.NoActionBar"[^>]*>)([\s\S]*?)(\s*<\/style>)/;
  if (!re.test(styles)) {
    console.error('Не найден стиль AppTheme.NoActionBar в styles.xml');
    process.exit(1);
  }
  styles = styles.replace(re, (_m, open, body, close) => `${open}${body}\n        ${items.join('\n        ')}${close}`);
  if (!styles.includes('xmlns:tools=')) {
    styles = styles.replace('<resources>', '<resources xmlns:tools="http://schemas.android.com/tools">');
  }
  writeFileSync(stylesPath, styles);
}

console.log(`Тема обновлена: ${stylesPath}`);
