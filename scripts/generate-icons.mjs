#!/usr/bin/env node
/**
 * Generates the PWA icon set.
 *
 * The mark is an original ichthys drawn from two circular arcs — the earliest
 * Christian symbol, constructed mathematically rather than traced from anyone
 * else's logo. Regenerate with `node scripts/generate-icons.mjs`.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../apps/web/public');

const PAPER = [251, 250, 248];
const GOLD = [166, 127, 63];
const INK = [24, 23, 21];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      raw[offset] = rgb[i];
      raw[offset + 1] = rgb[i + 1];
      raw[offset + 2] = rgb[i + 2];
      offset += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Signed distance to the nearer of the two arcs that form the fish, sampled
 * with 4x supersampling so the curve reads cleanly at 192px and below.
 */
function fishCoverage(px, py, size) {
  const cx = size * 0.46;
  const cy = size * 0.5;
  // Two circles offset vertically. Their overlapping lens is the body, and the
  // arcs continuing past the right intersection cross to form the tail.
  const radius = size * 0.4;
  const offset = size * 0.285;
  const stroke = size * 0.05;
  const halfWidth = Math.sqrt(radius * radius - offset * offset);
  const tail = size * 0.115;

  if (px < cx - halfWidth || px > cx + halfWidth + tail) return 0;
  // The arcs keep diverging past the tail crossing; clip them to a band so the
  // tail stays short instead of sweeping to the edge of the canvas.
  if (Math.abs(py - cy) > size * 0.2) return 0;

  // Each circle contributes only the half facing the body. Without this clip
  // the far side of each circle draws a second, unrelated arc.
  const lowerCentre = cy + offset;
  const upperCentre = cy - offset;
  let d = Infinity;
  if (py <= lowerCentre) {
    d = Math.min(d, Math.abs(Math.hypot(px - cx, py - lowerCentre) - radius));
  }
  if (py >= upperCentre) {
    d = Math.min(d, Math.abs(Math.hypot(px - cx, py - upperCentre) - radius));
  }
  return d < stroke / 2 ? 1 : 0;
}

function renderIcon(size, { background, mark, inset = 0 }) {
  const rgb = Buffer.alloc(size * size * 3);
  const inner = size - inset * 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) {
          const px = x + (sx + 0.5) / 2 - inset;
          const py = y + (sy + 0.5) / 2 - inset;
          if (px >= 0 && py >= 0 && px < inner && py < inner) {
            hits += fishCoverage(px, py, inner);
          }
        }
      }
      const alpha = hits / 4;
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        rgb[i + c] = Math.round(background[c] * (1 - alpha) + mark[c] * alpha);
      }
    }
  }
  return encodePng(size, size, rgb);
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Icthus">
  <rect width="512" height="512" fill="#fbfaf8"/>
  <g fill="none" stroke="#a67f3f" stroke-width="23" stroke-linecap="round">
    <path d="M 106 256 A 215 215 0 0 1 457 179"/>
    <path d="M 106 256 A 215 215 0 0 0 457 333"/>
  </g>
</svg>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'icon.svg'), SVG);
writeFileSync(resolve(outDir, 'icon-192.png'), renderIcon(192, { background: PAPER, mark: GOLD }));
writeFileSync(resolve(outDir, 'icon-512.png'), renderIcon(512, { background: PAPER, mark: GOLD }));
writeFileSync(resolve(outDir, 'icon-180.png'), renderIcon(180, { background: PAPER, mark: GOLD }));
// Maskable icons need the mark inside the safe zone, so it survives a circular
// or squircle crop on Android.
writeFileSync(
  resolve(outDir, 'icon-maskable-512.png'),
  renderIcon(512, { background: PAPER, mark: GOLD, inset: 64 }),
);
writeFileSync(
  resolve(outDir, 'icon-mono-512.png'),
  renderIcon(512, { background: PAPER, mark: INK }),
);

console.log('Wrote icon.svg, icon-180.png, icon-192.png, icon-512.png, maskable and mono variants');
