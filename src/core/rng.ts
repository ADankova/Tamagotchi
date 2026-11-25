/**
 * Детерминированный генератор mulberry32: одно и то же состояние даёт одно и то же число,
 * поэтому tick остаётся чистой функцией и тестируется без моков.
 * Возвращает [число в 0..1, новое состояние].
 */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(next ^ (next >>> 15), 1 | next);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, next];
}

/** Начальное зерно для нового питомца. Единственное место, где используется Math.random. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) | 0;
}
