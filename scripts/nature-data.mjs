// Собирает art/nature/*.png в src/render/natureData.ts (data URL, как art-data.mjs).
//   node scripts/nature-data.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../art/nature/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const groups = {};
for (const f of files) {
  const [g] = f.split('_');
  (groups[g] ??= []).push(`'data:image/png;base64,${readFileSync(new URL(f, dir)).toString('base64')}'`);
}
const body = Object.entries(groups).map(([g, a]) => `  '${g}': [\n    ${a.join(',\n    ')},\n  ],`).join('\n');
writeFileSync(new URL('../src/render/natureData.ts', import.meta.url), `// Сгенерировано scripts/nature-data.mjs из art/nature/*.png — не править руками.\n\nexport const NATURE: Record<string, string[]> = {\n${body}\n};\n`);
console.log('natureData.ts');
