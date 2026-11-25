// Цветная пиксельная конфетка-лакомство для мини-игр (обычные спрайты — одноцветные, как на ЖК-экране).

const ART = [
  'oo....oooo....oo',
  'oyo..oWwppo..oyo',
  'oyYooWwpppPooYyo',
  'oyyyopppppPoyyyo',
  'oyyyopppppPoyyyo',
  'oyYoopppPPPooYyo',
  'oyo..oPPPPo..oyo',
  'oo....oooo....oo',
];

const COLORS: Record<string, string> = {
  o: '#3b2a1e', // контур
  y: '#ffd166', // фантик
  Y: '#fff3b8', // блик на фантике
  p: '#ff7eb0', // конфета
  P: '#d94f8a', // тень
  W: '#ffffff', // блик
  w: '#ffd3e6',
};

let cached = '';

/** data URL конфетки; рисуется один раз. */
export function treatArtUrl(scale = 6): string {
  if (cached) return cached;
  const h = ART.length;
  const w = Math.max(...ART.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ART.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = COLORS[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  cached = canvas.toDataURL();
  return cached;
}
