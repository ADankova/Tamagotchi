// Рисует иконки Android-приложения из картинки art/app-icon.png (нарисована в PixelLab) — без сторонних пакетов.
//
//   node scripts/android-icons.mjs android/app/src/main/res   — записать иконки в проект
//   node scripts/android-icons.mjs --preview icons.png         — картинка для проверки
//
// Нужен Node.js 22.18+ (он умеет импортировать .ts напрямую).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const ART_FILE = new URL('../art/app-icon.png', import.meta.url);

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const BG_HEX = '#FFF4E8'; // фон игры
const BG = hex(BG_HEX);
const WHITE = [255, 255, 255, 255];

// --- PNG ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(img) {
  const { w, h, px } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Чтение PNG 8 бит RGBA (тип 6) или RGB (тип 2), без чересстрочности. */
function decodePng(buf) {
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      type = data[9];
      if (data[8] !== 8 || (type !== 6 && type !== 2) || data[12] !== 0) throw new Error('Нужен PNG 8 бит RGB/RGBA без чересстрочности');
    } else if (kind === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const cur = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? cur[y * stride + x - bpp] : 0;
      const b = y > 0 ? cur[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? cur[(y - 1) * stride + x - bpp] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[y * stride + x] = (v + pred) & 0xff;
    }
  }
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = cur[i * bpp];
    px[i * 4 + 1] = cur[i * bpp + 1];
    px[i * 4 + 2] = cur[i * bpp + 2];
    px[i * 4 + 3] = bpp === 4 ? cur[i * bpp + 3] : 255;
  }
  return { w, h, px };
}

/**
 * Пиксель-арт в размер size×size: сначала крупные пиксели (увеличение в целое число раз),
 * потом аккуратное усреднение до нужного размера — пиксели остаются чёткими, без «лесенки».
 */
function scaleArt(src, size) {
  const k = Math.max(1, Math.ceil(size / src.w) * 2);
  const big = src.w * k;
  const out = image(size, size);
  const ratio = big / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = Math.floor(y * ratio); yy < Math.floor((y + 1) * ratio); yy++) {
        for (let xx = Math.floor(x * ratio); xx < Math.floor((x + 1) * ratio); xx++) {
          const i = (Math.floor(yy / k) * src.w + Math.floor(xx / k)) * 4;
          const al = src.px[i + 3];
          r += src.px[i] * al;
          g += src.px[i + 1] * al;
          b += src.px[i + 2] * al;
          a += al;
          n++;
        }
      }
      if (a > 0) out.px.set([Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / n)], (y * size + x) * 4);
    }
  }
  return out;
}

/** Наложить картинку по центру (с учётом прозрачности). */
function blit(dst, src, x0, y0) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const a = src.px[i + 3] / 255;
      if (a === 0) continue;
      const dx = x0 + x;
      const dy = y0 + y;
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
      const j = (dy * dst.w + dx) * 4;
      const da = dst.px[j + 3] / 255;
      const oa = a + da * (1 - a);
      for (let c = 0; c < 3; c++) dst.px[j + c] = Math.round((src.px[i + c] * a + dst.px[j + c] * da * (1 - a)) / oa);
      dst.px[j + 3] = Math.round(oa * 255);
    }
  }
}

const ART = decodePng(readFileSync(ART_FILE));

function placeArt(img, artSize) {
  const art = scaleArt(ART, artSize);
  blit(img, art, Math.round((img.w - artSize) / 2), Math.round((img.h - artSize) / 2));
}

// --- Рисование ---

function image(w, h) {
  return { w, h, px: Buffer.alloc(w * h * 4) };
}

function set(img, x, y, rgba) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  img.px.set(rgba, (y * img.w + x) * 4);
}

/** Скруглённый прямоугольник (radius в пикселях; radius = w/2 — круг). */
function roundRect(img, x0, y0, w, h, radius, rgba) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + radius - x - 0.5, 0, x + 0.5 - (x0 + w - radius));
      const dy = Math.max(y0 + radius - y - 0.5, 0, y + 0.5 - (y0 + h - radius));
      if (dx * dx + dy * dy <= radius * radius) set(img, x, y, rgba);
    }
  }
}

/** Обычная иконка: светлая подложка (квадрат со скруглением или круг) и картинка. */
function legacyIcon(size, round) {
  const img = image(size, size);
  const pad = Math.round(size * 0.04);
  roundRect(img, pad, pad, size - 2 * pad, size - 2 * pad, round ? (size - 2 * pad) / 2 : size * 0.22, BG);
  placeArt(img, Math.round(size * (round ? 0.8 : 0.86)));
  return img;
}

/** Передний слой адаптивной иконки (Android 8+): 108dp, видимая зона — центральные 66dp. */
function adaptiveForeground(size) {
  const img = image(size, size);
  placeArt(img, Math.round(size * 0.62));
  return img;
}

/** Маленькая иконка в строке уведомлений: только белый силуэт картинки. */
function notificationIcon(size) {
  const img = image(size, size);
  placeArt(img, size);
  for (let i = 0; i < size * size; i++) {
    const a = img.px[i * 4 + 3];
    img.px.set(a > 110 ? WHITE : [0, 0, 0, 0], i * 4);
  }
  return img;
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function writeResources(res) {
  for (const [name, k] of Object.entries(DENSITIES)) {
    write(join(res, `mipmap-${name}`, 'ic_launcher.png'), encodePng(legacyIcon(Math.round(48 * k), false)));
    write(join(res, `mipmap-${name}`, 'ic_launcher_round.png'), encodePng(legacyIcon(Math.round(48 * k), true)));
    write(join(res, `mipmap-${name}`, 'ic_launcher_foreground.png'), encodePng(adaptiveForeground(Math.round(108 * k))));
    write(join(res, `drawable-${name}`, 'ic_stat_tamagotchi.png'), encodePng(notificationIcon(Math.round(24 * k))));
  }
  write(
    join(res, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG_HEX}</color>\n</resources>\n`,
  );
  console.log(`Иконки записаны в ${res}`);
}

/** Все иконки на одной картинке — чтобы посмотреть глазами. */
function writePreview(file) {
  const parts = [legacyIcon(192, false), legacyIcon(192, true), adaptiveForeground(216), notificationIcon(96)];
  const W = parts.reduce((s, p) => s + p.w + 16, 16);
  const H = Math.max(...parts.map((p) => p.h)) + 32;
  const out = image(W, H);
  roundRect(out, 0, 0, W, H, 0, hex('#606060'));
  let x = 16;
  for (const p of parts) {
    for (let y = 0; y < p.h; y++) {
      for (let px = 0; px < p.w; px++) {
        const i = (y * p.w + px) * 4;
        if (p.px[i + 3]) set(out, x + px, 16 + y, [p.px[i], p.px[i + 1], p.px[i + 2], 255]);
      }
    }
    x += p.w + 16;
  }
  write(file, encodePng(out));
  console.log(`Превью: ${file}`);
}

const args = process.argv.slice(2);
if (args[0] === '--preview') writePreview(args[1] ?? 'icons-preview.png');
else if (args[0]) writeResources(args[0]);
else {
  console.error('Укажите папку res Android-проекта или --preview файл.png');
  process.exit(1);
}

