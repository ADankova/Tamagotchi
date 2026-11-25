// Название приложения под значком — на языке телефона: русский → «Тамагочи», остальные → «Tamagotchi».
//
//   node scripts/android-strings.mjs android/app/src/main/res

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NAMES = { values: 'Tamagotchi', 'values-ru': 'Тамагочи' };
const KEYS = ['app_name', 'title_activity_main'];

const res = process.argv[2];
if (!res) {
  console.error('Укажите папку res Android-проекта');
  process.exit(1);
}

for (const [dir, name] of Object.entries(NAMES)) {
  const file = join(res, dir, 'strings.xml');
  let xml = existsSync(file) ? readFileSync(file, 'utf8') : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
  for (const key of KEYS) {
    const tag = `<string name="${key}">${name}</string>`;
    const re = new RegExp(`<string name="${key}">[^<]*</string>`);
    xml = re.test(xml) ? xml.replace(re, tag) : xml.replace('</resources>', `    ${tag}\n</resources>`);
  }
  mkdirSync(join(res, dir), { recursive: true });
  writeFileSync(file, xml);
  console.log(`${dir}/strings.xml: ${name}`);
}
