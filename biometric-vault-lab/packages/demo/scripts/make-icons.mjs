#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────
// Generates placeholder PWA icons (192x192 and 512x512 maskable PNG).
// Solid-color square with a centred "V" glyph drawn from a small set of
// scanlines — no font dependency. Run via `npm run icons` in the demo
// package, output goes to public/icons/.
//
// PNG is constructed manually with zlib + chunk CRCs — no native deps.
// ──────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', 'public', 'icons');

const NAVY = [0x1b, 0x2a, 0x4a];
const ORANGE = [0xd8, 0x5a, 0x30];

// CRC-32 (PNG flavour) — lookup table built once, used by crc32().
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

mkdirSync(OUT_DIR, { recursive: true });

for (const size of [192, 512]) {
  const png = renderIcon(size, NAVY, ORANGE);
  const path = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}

/**
 * Render a NxN PNG: solid background, with a centred glyph mark in `fg`.
 * The glyph is a chunky "V" shape — two diagonals meeting at the bottom-
 * centre — drawn from a coarse SDF-like distance check so it scales.
 */
function renderIcon(size, bg, fg) {
  const stride = 1 + size * 3; // filter byte + RGB row
  const raw = Buffer.alloc(size * stride);
  const cx = size / 2;
  const armWidth = size * 0.085;
  const armInset = size * 0.18;
  const armBottom = size * 0.78;
  const armTop = size * 0.22;

  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      // Distance from the two diagonal arm centerlines of the V.
      // Each arm runs from (cx ± armInset, armTop) to (cx, armBottom).
      const inV =
        distanceToSegment(x, y, cx - armInset, armTop, cx, armBottom) < armWidth ||
        distanceToSegment(x, y, cx + armInset, armTop, cx, armBottom) < armWidth;
      const c = inV ? fg : bg;
      const off = row + 1 + x * 3;
      raw[off]     = c[0];
      raw[off + 1] = c[1];
      raw[off + 2] = c[2];
    }
  }
  const idat = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const head = Buffer.from(type, 'ascii');
  const body = Buffer.concat([head, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
