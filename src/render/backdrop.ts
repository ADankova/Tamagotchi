// Фон экрана питомца зависит от времени суток: утром в левом верхнем углу «встаёт солнце»,
// днём свечение уходит к правому углу, вечером краснеет, ночью фон темнеет, а свет становится лунным.
// Чистые функции: время приходит параметром, поэтому всё проверяется тестами.

export interface Backdrop {
  /** Цвет фона сверху и снизу (градиент), #rrggbb. */
  top: string;
  bottom: string;
  /** Цвет свечения и его центр в долях экрана (0..1). */
  glow: string;
  glowX: number;
  glowY: number;
  /** Прозрачность свечения 0..1 и радиус в долях ширины экрана. */
  glowAlpha: number;
  glowRadius: number;
  /** Цвет пола. */
  floor: string;
  /** Ночь: питомец и экран выглядят темнее. */
  night: number;
}

type Rgb = readonly [number, number, number];

const hex = (c: string): Rgb => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

const toHex = (c: Rgb): string =>
  '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

const mix = (a: string, b: string, t: number): string => {
  const x = hex(a);
  const y = hex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface Key {
  hour: number;
  top: string;
  bottom: string;
  glow: string;
  glowX: number;
  glowY: number;
  glowAlpha: number;
  glowRadius: number;
  floor: string;
  night: number;
}

// Ключевые моменты суток; между ними всё плавно перетекает.
const KEYS: readonly Key[] = [
  { hour: 0, top: '#232a4a', bottom: '#38406a', glow: '#e9eeff', glowX: 0.78, glowY: 0.12, glowAlpha: 0.42, glowRadius: 0.55, floor: '#2c3358', night: 1 },
  { hour: 5, top: '#2c3356', bottom: '#4a5280', glow: '#e9eeff', glowX: 0.22, glowY: 0.12, glowAlpha: 0.34, glowRadius: 0.5, floor: '#343b62', night: 0.9 },
  { hour: 7, top: '#fde7d2', bottom: '#fff4e6', glow: '#fff2a8', glowX: 0.04, glowY: 0.02, glowAlpha: 0.85, glowRadius: 0.8, floor: '#f4dcc0', night: 0 },
  { hour: 12, top: '#e4f3ff', bottom: '#fff8e8', glow: '#fffbd0', glowX: 0.5, glowY: -0.05, glowAlpha: 0.7, glowRadius: 0.8, floor: '#f1e4c6', night: 0 },
  { hour: 17, top: '#fff0dc', bottom: '#fff7ea', glow: '#ffe28a', glowX: 0.96, glowY: 0.02, glowAlpha: 0.85, glowRadius: 0.8, floor: '#f2d9bb', night: 0 },
  { hour: 20, top: '#f6c9b5', bottom: '#e9b9c4', glow: '#ffb27a', glowX: 1.0, glowY: 0.1, glowAlpha: 0.7, glowRadius: 0.75, floor: '#dca99b', night: 0.3 },
  { hour: 22, top: '#2e3558', bottom: '#454c7a', glow: '#e9eeff', glowX: 0.84, glowY: 0.12, glowAlpha: 0.4, glowRadius: 0.55, floor: '#363d62', night: 1 },
  { hour: 24, top: '#232a4a', bottom: '#38406a', glow: '#e9eeff', glowX: 0.78, glowY: 0.12, glowAlpha: 0.42, glowRadius: 0.55, floor: '#2c3358', night: 1 },
];

/** Часы суток 0..24 по локальному времени. */
export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

export function backdropAt(hour: number): Backdrop {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && h >= (KEYS[i + 1]?.hour ?? 24)) i++;
  const a = KEYS[i] as Key;
  const b = KEYS[i + 1] as Key;
  const t = Math.max(0, Math.min(1, (h - a.hour) / (b.hour - a.hour)));
  return {
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    glow: mix(a.glow, b.glow, t),
    glowX: lerp(a.glowX, b.glowX, t),
    glowY: lerp(a.glowY, b.glowY, t),
    glowAlpha: lerp(a.glowAlpha, b.glowAlpha, t),
    glowRadius: lerp(a.glowRadius, b.glowRadius, t),
    floor: mix(a.floor, b.floor, t),
    night: lerp(a.night, b.night, t),
  };
}

/** Рисует фон; width/height — в пикселях холста. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, b: Backdrop): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, b.top);
  sky.addColorStop(1, b.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const cx = b.glowX * width;
  const cy = b.glowY * height;
  const r = b.glowRadius * width;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const rgb = hex(b.glow);
  const css = (alpha: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;
  glow.addColorStop(0, css(b.glowAlpha));
  glow.addColorStop(0.45, css(b.glowAlpha * 0.4));
  glow.addColorStop(1, css(0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Пол: мягкая полоса внизу.
  const floorH = Math.round(height * 0.12);
  const floor = ctx.createLinearGradient(0, height - floorH, 0, height);
  floor.addColorStop(0, mix(b.floor, b.bottom, 0.6));
  floor.addColorStop(1, b.floor);
  ctx.fillStyle = floor;
  ctx.fillRect(0, height - floorH, width, floorH);
}
