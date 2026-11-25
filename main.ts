// THE WORLD TODAY — Wednesday 25 November 2026.
// A newspaper front page drawn pixel by pixel with the Node standard library only.
// main.ts writes one deterministic 1024x1024 PNG to /output/entry.png
// (or $MAKEFUN_OUTPUT_DIR when set). No network, no randomness, no time:
// the same run always writes the same bytes.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---- palette: dark ink on warm paper, one red accent ----
const PAPER: RGB = [248, 244, 234];
const INK: RGB = [18, 18, 18];
const RED: RGB = [178, 24, 24];
const BRIGHT_RED: RGB = [224, 58, 58];
const GRAY: RGB = [96, 92, 82];
const FAINT: RGB = [208, 200, 182];
const DARK: RGB = [22, 22, 24];
const WHITE: RGB = [250, 248, 242];
const SKY: RGB = [168, 205, 232];
const SEA: RGB = [38, 108, 168];
const SUN: RGB = [244, 192, 72];
const STEEL: RGB = [74, 78, 86];
const CONTAINER_RED: RGB = [196, 72, 52];
const CONTAINER_GREEN: RGB = [58, 128, 84];
const CONTAINER_BLUE: RGB = [52, 96, 160];
const SMOKE: RGB = [196, 196, 196];
const GLOBE_BLUE: RGB = [64, 132, 204];
const LAND: RGB = [62, 158, 92];
const CHIP_BG: RGB = [24, 30, 40];
const CHIP: RGB = [38, 52, 70];
const CHIP_INNER: RGB = [58, 86, 66];
const GOLD: RGB = [212, 175, 88];
const ORANGE: RGB = [232, 116, 40];

// ---- pixel canvas ----
const img = Buffer.alloc(W * H * 3);

function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0];
  img[i + 1] = c[1];
  img[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      img[i] = c[0];
      img[i + 1] = c[1];
      img[i + 2] = c[2];
    }
  }
}

function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, t, h, c);
}

// Bresenham line, for crane cables and circuit traces.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const hw = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -hw; x <= hw; x++) px(cx + x, cy + y, c);
  }
}

// Horizontal chord of a circle: used for latitude lines on the globe.
function chord(cx: number, cy: number, r: number, dy: number, c: RGB): void {
  if (Math.abs(dy) > r) return;
  const hw = Math.floor(Math.sqrt(r * r - dy * dy));
  hline(cx - hw, cy + dy, hw * 2, c);
}

// ---- PNG encoder (deterministic: fixed zlib level, no time chunks) ----
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font: each glyph is 7 rows, 5 bits wide (bit 4 = leftmost) ----
const FONT: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '"': [0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00],
  '#': [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  '$': [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '*': [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
  '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ';': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x04, 0x08],
  '=': [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  '@': [0x0e, 0x11, 0x17, 0x15, 0x16, 0x10, 0x0e],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x11, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x04, 0x04, 0x0e, 0x04, 0x04, 0x04, 0x02],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x15, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  '•': [0x00, 0x00, 0x0e, 0x0e, 0x0e, 0x00, 0x00],
};

// ---- text drawing ----
function glyphWidth(scale: number): number {
  return 6 * scale;
}

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of text) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (1 << (4 - col))) fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
  return cx - x - scale;
}

function drawTextCentered(cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

function drawTextRight(xRight: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(xRight - textWidth(text, scale), y, text, scale, c);
}

// Greedy word wrap to a pixel width. Returns lines.
function wrap(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : cur + ' ' + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

function drawPara(x: number, y: number, text: string, maxWidth: number, scale: number, c: RGB, leading: number): number {
  const lines = wrap(text, maxWidth, scale);
  let yy = y;
  for (const ln of lines) {
    drawText(x, yy, ln, scale, c);
    yy += leading;
  }
  return yy;
}

// ---- drawn scene panels (no photographs: simple flat scenes) ----

// Hodeidah port: sky, sun, sea, cranes, containers, smoke.
function drawPortPanel(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  disc(x + w - 52, y + 34, 22, SUN); // sun
  disc(x + w - 52, y + 34, 22, SUN);
  fillRect(x, y + Math.floor(h * 0.58), w, h - Math.floor(h * 0.58), SEA); // sea
  // distant skyline on the horizon
  fillRect(x + 18, y + 78, 26, 26, STEEL);
  fillRect(x + 52, y + 66, 18, 38, STEEL);
  fillRect(x + 76, y + 84, 34, 20, STEEL);
  // dock
  fillRect(x, y + 104, w, 10, DARK);
  // containers on the dock
  fillRect(x + 20, y + 82, 44, 22, CONTAINER_RED);
  fillRect(x + 70, y + 82, 44, 22, CONTAINER_GREEN);
  fillRect(x + 120, y + 88, 36, 16, CONTAINER_BLUE);
  fillRect(x + 20, y + 60, 44, 22, CONTAINER_BLUE);
  // crane 1: tower, arm, cable, hook
  fillRect(x + 210, y + 30, 8, 74, STEEL);
  fillRect(x + 210, y + 30, 96, 7, STEEL);
  line(x + 296, y + 37, x + 296, y + 66, STEEL);
  fillRect(x + 290, y + 66, 12, 8, DARK);
  // crane 2
  fillRect(x + 330, y + 48, 7, 56, STEEL);
  fillRect(x + 300, y + 48, 60, 6, STEEL);
  line(x + 306, y + 54, x + 306, y + 78, STEEL);
  fillRect(x + 301, y + 78, 10, 7, DARK);
  // smoke rising from the far dock
  disc(x + 160, y + 46, 9, SMOKE);
  disc(x + 168, y + 32, 12, SMOKE);
  disc(x + 158, y + 18, 8, SMOKE);
  // waves
  hline(x + 8, y + 128, 60, WHITE);
  hline(x + 150, y + 146, 90, WHITE);
  hline(x + 260, y + 162, 70, WHITE);
  // frame
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

// Globe for the climate story: blue planet, green continents, latitude lines.
function drawGlobePanel(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [18, 52, 96]);
  // faint stars
  px(x + 24, y + 12, WHITE);
  px(x + 210, y + 10, WHITE);
  px(x + 400, y + 16, WHITE);
  px(x + 330, y + 64, WHITE);
  px(x + 60, y + 66, WHITE);
  const cx = x + 74;
  const cy = y + Math.floor(h / 2);
  const r = 34;
  disc(cx, cy, r, GLOBE_BLUE);
  // continents: green blobs kept inside the circle
  disc(cx - 12, cy - 10, 10, LAND);
  disc(cx + 8, cy - 14, 8, LAND);
  disc(cx + 12, cy + 10, 9, LAND);
  disc(cx - 6, cy + 14, 7, LAND);
  // latitude lines (chords)
  chord(cx, cy, r, -18, [120, 180, 230]);
  chord(cx, cy, r, 0, [120, 180, 230]);
  chord(cx, cy, r, 18, [120, 180, 230]);
  // hot sun, top right
  disc(x + w - 56, y + 22, 13, ORANGE);
  // heat waves rising from the planet
  vline(x + 150, y + 14, 18, ORANGE, 2);
  vline(x + 170, y + 10, 24, ORANGE, 2);
  vline(x + 190, y + 16, 16, ORANGE, 2);
  // caption strip inside the panel, bottom
  fillRect(x, y + h - 16, w, 16, DARK);
  drawText(x + 8, y + h - 13, 'ANTALYA, TURKIYE', 1, WHITE);
  // frame
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

// AI chip for the Nvidia story.
function drawChipPanel(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CHIP_BG);
  // circuit traces
  hline(x + 14, y + 18, 90, [52, 68, 92]);
  hline(x + w - 104, y + h - 20, 90, [52, 68, 92]);
  vline(x + 20, y + 18, 26, [52, 68, 92]);
  vline(x + w - 22, y + h - 44, 26, [52, 68, 92]);
  // pins
  for (let i = 0; i < 5; i++) {
    fillRect(x + 150 + i * 34, y + 6, 14, 8, GOLD);
    fillRect(x + 150 + i * 34, y + h - 14, 14, 8, GOLD);
  }
  for (let i = 0; i < 3; i++) {
    fillRect(x + 6, y + 16 + i * 26, 8, 12, GOLD);
    fillRect(x + w - 14, y + 16 + i * 26, 8, 12, GOLD);
  }
  // the chip itself
  const cw = 120;
  const ch = 56;
  const ccx = x + Math.floor((w - cw) / 2);
  const ccy = y + Math.floor((h - ch) / 2);
  fillRect(ccx, ccy, cw, ch, CHIP);
  fillRect(ccx + 10, ccy + 10, cw - 20, ch - 20, CHIP_INNER);
  drawTextCentered(x + Math.floor(w / 2), ccy + 17, 'AI', 3, WHITE);
  // frame
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

// ---- the front page ----
const M = 36; // margin
const CW = W - 2 * M; // content width: 952

function draw(): void {
  fillRect(0, 0, W, H, PAPER);

  // ---- masthead ----
  hline(M, 26, CW, INK, 2);
  drawTextCentered(W / 2, 40, 'THE WORLD TODAY', 9, INK);
  hline(M, 112, CW, INK, 1);
  drawText(M, 124, 'VOL. I - NO. 329', 2, GRAY);
  drawTextCentered(W / 2, 122, 'WEDNESDAY 25 NOVEMBER 2026', 3, INK);
  drawTextRight(W - M, 124, 'ONE PAGE - FREE', 2, GRAY);
  hline(M, 152, CW, INK, 4);
  hline(M, 158, CW, INK, 1);

  // ---- lead story: Hodeidah / Riyadh ----
  drawText(M, 170, 'MIDDLE EAST - STRIKES AT SEA', 2, RED);
  drawText(M, 196, 'SAUDI-LED STRIKES HIT HODEIDAH', 4, INK);
  drawText(M, 228, 'PORT AFTER RIYADH DRONE ATTACK', 4, INK);
  drawPara(
    M,
    270,
    "Coalition warplanes struck Yemen's Hodeidah port hours after a Houthi drone hit a residential tower in Riyadh, injuring 11 people. The strikes were the coalition's answer to the drone attack on the Saudi capital.",
    564,
    2,
    INK,
    18,
  );
  hline(M, 380, 564, FAINT, 1);
  drawText(M, 394, 'INJURED IN RIYADH: 11', 2, RED);
  drawPortPanel(616, 268, 372, 180);
  drawText(616, 452, 'Hodeidah port on the Red Sea.', 1, GRAY);
  hline(M, 470, CW, INK, 2);

  // ---- row 2: COP31 and Nvidia ----
  vline(512, 484, 232, FAINT, 1);
  drawText(M, 484, 'CLIMATE - ANTALYA', 2, RED);
  drawText(M, 508, 'COP31 TALKS COLLAPSE', 3, INK);
  drawText(M, 532, 'WITH NO DEAL', 3, INK);
  drawGlobePanel(M, 566, 460, 84);
  drawPara(
    M,
    660,
    'Climate talks in Antalya ended without an agreement, closing the summit with no deal.',
    460,
    2,
    INK,
    18,
  );
  drawText(528, 484, 'TECH - CHIPS', 2, RED);
  drawText(528, 508, 'NVIDIA BRINGS BACK', 3, INK);
  drawText(528, 532, 'HUANG AS CEO', 3, INK);
  drawChipPanel(528, 566, 460, 84);
  drawPara(
    528,
    660,
    'Jensen Huang is Nvidia chief again, reinstated by the board. Directors face scrutiny over the reversal.',
    460,
    2,
    INK,
    18,
  );
  hline(M, 722, CW, INK, 2);

  // ---- row 3: Gaza and the war dead ----
  vline(512, 736, 164, FAINT, 1);
  drawText(M, 736, 'GAZA', 2, RED);
  drawText(M, 760, 'ISRAELI STRIKE KILLS', 3, INK);
  drawText(M, 784, 'SENIOR HAMAS OFFICIAL', 3, INK);
  drawPara(
    M,
    816,
    'An Israeli strike in Gaza killed a senior Hamas security official. Seven people were killed in the attack.',
    460,
    2,
    INK,
    18,
  );
  drawText(528, 736, 'WAR IN UKRAINE - LEAKED RECORDS', 2, RED);
  drawText(528, 760, 'RUSSIAN WAR DEAD', 3, INK);
  drawText(528, 784, 'PUT AT 720,000', 3, INK);
  drawPara(
    528,
    816,
    'Leaked Russian records put the war dead at 720,000. Ukraine keeps striking Russian oil refineries.',
    460,
    2,
    INK,
    18,
  );
  hline(M, 906, CW, INK, 2);

  // ---- bottom strip: CIA cyberattack ----
  fillRect(0, 914, W, 72, DARK);
  const strip1 = 'ALSO: CIA AND U.S. NATIONAL INTELLIGENCE HIT BY';
  const strip1x = Math.floor((W - textWidth(strip1, 2)) / 2);
  drawText(strip1x, 930, 'ALSO:', 2, BRIGHT_RED);
  drawText(strip1x + textWidth('ALSO: ', 2), 930, 'CIA AND U.S. NATIONAL INTELLIGENCE HIT BY', 2, WHITE);
  drawTextCentered(W / 2, 952, 'CYBERATTACK ON AN UNCLASSIFIED SYSTEM', 2, WHITE);

  // ---- footer ----
  drawTextCentered(W / 2, 996, 'THE WORLD TODAY - WEDNESDAY 25 NOVEMBER 2026 - ONE PAGE', 1, GRAY);
}

function main(): void {
  draw();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG());
}

main();
