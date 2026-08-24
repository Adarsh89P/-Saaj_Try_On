/* Generates the PWA icons as real PNGs — no binary assets in the repo,
   no image library to install. Run with: npm run icons */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(OUT, { recursive: true });

const BG = [214, 127, 72];      // --color-accent-500
const INK = [255, 248, 241];    // warm off-white
const RING = [245, 234, 216];   // --color-bg

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, draw) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = draw(x, y);
      const o = y * stride + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A hanger silhouette in a ring — reads at 48px on a tablet home screen. */
function icon(size, inset) {
  const c = size / 2;
  const s = size / 512; // design is drawn at 512
  const pad = inset * size;
  const ringR = c - pad;

  return (x, y) => {
    const dx = x - c;
    const dy = y - c;
    const d = Math.hypot(dx, dy);
    if (d > ringR) return BG;
    if (d > ringR - 10 * s) return RING;

    // hook
    const hookCx = c;
    const hookCy = c - 96 * s;
    const hookD = Math.hypot(x - hookCx, y - hookCy);
    if (hookD > 30 * s && hookD < 42 * s && y < hookCy + 12 * s) return INK;

    // stem down to the bar
    if (Math.abs(dx) < 7 * s && y > hookCy && y < c - 8 * s) return INK;

    // the two shoulders of the hanger, as a wide flat triangle
    const barY = c + 62 * s;
    const halfW = 150 * s;
    if (y > c - 12 * s && y < barY) {
      const t = (y - (c - 12 * s)) / (barY - (c - 12 * s));
      const edge = halfW * t;
      const thickness = 14 * s;
      if (Math.abs(Math.abs(dx) - edge) < thickness / 2) return INK;
    }
    // bottom bar
    if (Math.abs(y - barY) < 8 * s && Math.abs(dx) < halfW + 4 * s) return INK;

    return BG;
  };
}

const files = [
  ['icon-192.png', 192, 0.04],
  ['icon-512.png', 512, 0.04],
  // maskable icons get cropped to a circle by Android, so keep more margin
  ['maskable-512.png', 512, 0.13],
  // iOS rounds the corners of the home-screen icon itself and ignores any
  // transparency, so this one is opaque with a little margin for the rounding.
  ['apple-touch-icon-180.png', 180, 0.06],
];

for (const [name, size, inset] of files) {
  writeFileSync(join(OUT, name), png(size, icon(size, inset)));
  console.log('wrote', name, size + 'px');
}
