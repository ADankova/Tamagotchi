// Настраивает android/app/build.gradle сгенерированного проекта:
//  - отладочная подпись постоянным ключом из android-signing/ (чтобы обновления ставились поверх);
//  - versionCode (номер сборки) и versionName (из package.json).
//
//   node scripts/android-gradle.mjs android/app/build.gradle [versionCode]

import { readFileSync, writeFileSync } from 'node:fs';

const [file, codeArg] = process.argv.slice(2);
if (!file) {
  console.error('Укажите путь к android/app/build.gradle');
  process.exit(1);
}

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const code = Number(codeArg ?? process.env.GITHUB_RUN_NUMBER ?? 1);
let gradle = readFileSync(file, 'utf8');

const SIGNING = `
    signingConfigs {
        debug {
            // Постоянный отладочный ключ: android-signing/debug.keystore
            storeFile rootProject.file("../android-signing/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }
`;

if (!gradle.includes('android-signing/debug.keystore')) {
  if (!/^android\s*\{/m.test(gradle)) {
    console.error('Не найден блок android { } в build.gradle');
    process.exit(1);
  }
  gradle = gradle.replace(/^android\s*\{\n?/m, (m) => `${m.trimEnd()}\n${SIGNING}`);
}

if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+"[^"]*"/.test(gradle)) {
  console.error('Не найдены versionCode / versionName в build.gradle');
  process.exit(1);
}
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);

writeFileSync(file, gradle);
console.log(`build.gradle: подпись постоянным ключом, versionCode ${code}, versionName ${version}`);
