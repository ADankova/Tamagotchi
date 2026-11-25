// Собирает картинки из art/ui/*.png (нарисованы в PixelLab) в src/render/artData.ts — data URL,
// чтобы они работали и в APK, и в тестах без загрузчиков картинок.
//
//   node scripts/art-data.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../art/ui/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const lines = files.map((f) => {
  const b64 = readFileSync(new URL(f, dir)).toString('base64');
  return `  ${f.slice(0, -4)}: 'data:image/png;base64,${b64}',`;
});
const out = `// Сгенерировано scripts/art-data.mjs из art/ui/*.png — не править руками.

export const ART = {
${lines.join('\n')}
} as const;

export type ArtIcon = keyof typeof ART;
`;
writeFileSync(new URL('../src/render/artData.ts', import.meta.url), out);
console.log(`artData.ts: ${files.length} картинок`);
