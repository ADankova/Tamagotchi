import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Относительные пути, чтобы сборка работала на GitHub Pages из подпапки.
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      include: ['src/core/**', 'src/storage/**'],
      thresholds: { lines: 80 },
    },
  },
});
