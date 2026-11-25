// Разрешения для точных напоминаний на Android 12+.
// Без них система может сдвигать запланированные уведомления на несколько минут и больше.
//
//   node scripts/android-manifest.mjs android/app/src/main/AndroidManifest.xml

import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Укажите путь к AndroidManifest.xml');
  process.exit(1);
}

const PERMISSIONS = [
  // Android 13+: точные будильники для приложений-напоминалок, выдаётся автоматически.
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
  // Android 12 (API 31–32): то же самое, там USE_EXACT_ALARM ещё нет.
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
];

let manifest = readFileSync(file, 'utf8');
const missing = PERMISSIONS.filter((p) => !manifest.includes(p.match(/android:name="([^"]+)"/)[1] + '"'));
if (missing.length) {
  if (!manifest.includes('</manifest>')) {
    console.error('Не найден </manifest>');
    process.exit(1);
  }
  manifest = manifest.replace('</manifest>', `    ${missing.join('\n    ')}\n</manifest>`);
  writeFileSync(file, manifest);
}
console.log(`AndroidManifest.xml: добавлено разрешений — ${missing.length}`);
