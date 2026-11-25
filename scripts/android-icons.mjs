// Рисует иконки Android-приложения из пиксельного спрайта питомца — без сторонних пакетов.
//
//   node scripts/android-icons.mjs android/app/src/main/res   — записать иконки в проект
//   node scripts/android-icons.mjs --preview icons.png         — картинка для проверки
//
// Нужен Node.js 22.18+ (он умеет импортировать .ts напрямую).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { SPRITES } from '../src/render/sprites.ts';

const ICON_SPRITE = SPRITES.adultGood;
const NOTIFY_SPRITE = SPRITES.child;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const SHELL = hex('#f2a477');
const LCD_BG = hex('#c9d4b2');
const INK = hex('#28321f');
const SHADE = hex('#6f7d5c');
const LIGHT = hex('#e8eed9');
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

function drawSprite(img, sprite, cx, cy, cell, colorOf) {
  const x0 = Math.round(cx - (sprite.w * cell) / 2);
  const y0 = Math.round(cy - (sprite.h * cell) / 2);
  sprite.rows.forEach((row, sy) => {
    [...row].forEach((ch, sx) => {
      const c = colorOf(ch);
      if (!c) return;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) set(img, x0 + sx * cell + x, y0 + sy * cell + y, c);
    });
  });
}

const lcdColors = (ch) => (ch === '#' || ch === 'e' ? INK : ch === '+' ? SHADE : ch === 'o' ? LIGHT : null);

/** Обычная иконка: корпус-«брелок» с экраном и питомцем. */
function legacyIcon(size, round) {
  const img = image(size, size);
  const pad = Math.round(size * 0.04);
  roundRect(img, pad, pad, size - 2 * pad, size - 2 * pad, round ? (size - 2 * pad) / 2 : size * 0.22, SHELL);
  const screen = Math.round(size * (round ? 0.56 : 0.64));
  const s0 = Math.round((size - screen) / 2);
  roundRect(img, s0, s0, screen, screen, size * 0.08, LCD_BG);
  const cell = Math.max(1, Math.floor((screen * 0.8) / Math.max(ICON_SPRITE.w, ICON_SPRITE.h)));
  drawSprite(img, ICON_SPRITE, size / 2, size / 2, cell, lcdColors);
  return img;
}

/** Передний слой адаптивной иконки (Android 8+): 108dp, видимая зона — центральные 66dp. */
function adaptiveForeground(size) {
  const img = image(size, size);
  const screen = Math.round(size * 0.5);
  const s0 = Math.round((size - screen) / 2);
  roundRect(img, s0, s0, screen, screen, size * 0.06, LCD_BG);
  const cell = Math.max(1, Math.floor((screen * 0.8) / Math.max(ICON_SPRITE.w, ICON_SPRITE.h)));
  drawSprite(img, ICON_SPRITE, size / 2, size / 2, cell, lcdColors);
  return img;
}

/** Маленькая иконка в строке уведомлений: только белый силуэт. */
function notificationIcon(size) {
  const img = image(size, size);
  const cell = Math.max(1, Math.floor((size * 0.9) / Math.max(NOTIFY_SPRITE.w, NOTIFY_SPRITE.h)));
  drawSprite(img, NOTIFY_SPRITE, size / 2, size / 2, cell, (ch) => (ch === '.' || ch === 'e' ? null : WHITE));
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
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F2A477</color>\n</resources>\n',
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

