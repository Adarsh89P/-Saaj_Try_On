/* Generates the demo catalogue art as real PNGs — no binary assets in the repo,
   no image library to install. Run with: npm run seed-images

   These are illustrations, not photographs. They exist so a fresh install has a
   catalogue to demonstrate and train on; the shop replaces each one with a real
   photo from Staff → Catalogue. Nothing here should ever be shown to a customer
   as a piece that is actually in stock. */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'seed');
mkdirSync(OUT, { recursive: true });

const W = 600;
const H = 800;
const AR = H / W; // motif grids are aspect-corrected with this, or they oval out
const SS = 2; // supersampling factor — keeps the curved hems from stair-stepping

/* ── PNG encoding (same approach as make-icons.mjs) ──────────────────── */

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

/** PNG's five per-row filters. Deflate compresses differences from a neighbour
 *  far better than raw values, which matters a lot on the gradients here. */
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Filters one scanline five ways and keeps whichever has the least total
 *  deviation — the standard heuristic for guessing what will deflate best. */
function filterRow(line, prev, bpp, out) {
  let best = null;
  let bestScore = Infinity;

  for (let type = 0; type <= 4; type++) {
    const candidate = Buffer.alloc(line.length);
    let score = 0;
    for (let i = 0; i < line.length; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (type) {
        case 1: v = line[i] - a; break;
        case 2: v = line[i] - b; break;
        case 3: v = line[i] - ((a + b) >> 1); break;
        case 4: v = line[i] - paeth(a, b, c); break;
        default: v = line[i];
      }
      candidate[i] = v & 0xff;
      // Signed magnitude: bytes near zero in either direction compress well.
      score += candidate[i] < 128 ? candidate[i] : 256 - candidate[i];
    }
    if (score < bestScore) { bestScore = score; best = { type, candidate }; }
  }

  out.push(Buffer.from([best.type]), best.candidate);
}

function png(width, height, draw) {
  const bpp = 3;
  const lineBytes = width * bpp;
  const chunks = [];
  let prev = Buffer.alloc(lineBytes);

  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(lineBytes);
    for (let x = 0; x < width; x++) {
      // Average SS×SS samples per pixel so edges read smooth at tile size.
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = draw((x + (sx + 0.5) / SS) / width, (y + (sy + 0.5) / SS) / height);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const o = x * bpp;
      line[o] = Math.round(r / n);
      line[o + 1] = Math.round(g / n);
      line[o + 2] = Math.round(b / n);
    }
    filterRow(line, prev, bpp, chunks);
    prev = line;
  }

  const raw = Buffer.concat(chunks);
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

/* ── colour helpers ──────────────────────────────────────────────────── */

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const shade = (c, t) => (t < 0 ? mix(c, [0, 0, 0], -t) : mix(c, [255, 255, 255], t));

const PAPER = hex('#f3ece0');   // --color-neutral-200-ish, the backdrop
const PAPER_2 = hex('#e7ddcb');
const GOLD = hex('#c9a227');
const GOLD_HI = hex('#e6cd72');

/* ── shape helpers, all in 0..1 space ────────────────────────────────── */

const smooth = (edge, w, v) => Math.max(0, Math.min(1, (v - (edge - w)) / (w * 2)));

/** Half-width of a garment body that tapers from `top` to `bottom`. */
const taper = (v, v0, v1, w0, w1) => {
  const t = Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
  return w0 + (w1 - w0) * t;
};

/** A soft wave on the hem so the fabric does not end in a ruled line. */
const hemAt = (u, base, amp) => base + Math.sin(u * Math.PI * 3.2) * amp;

/* ── motifs ──────────────────────────────────────────────────────────── */

function buti(u, v, scale) {
  // Gold butis on a staggered grid — the standard saree motif layout.
  const gx = u / scale;
  const gy = (v * AR) / scale;
  const row = Math.floor(gy);
  const cx = Math.round(gx - (row % 2 ? 0.5 : 0)) + (row % 2 ? 0.5 : 0);
  const d = Math.hypot(gx - cx, gy - (row + 0.5));
  // A ring with a filled centre reads as a woven motif; a plain disc reads as a dot.
  const disc = 1 - smooth(0.11, 0.012, d);
  const ring = smooth(0.17, 0.012, d) * (1 - smooth(0.23, 0.012, d));
  return Math.max(disc, ring * 0.85);
}

function block(u, v, scale) {
  // Hand-block print: small squares with a dot in the middle.
  const gx = (u / scale) % 1;
  const gy = ((v * AR) / scale) % 1;
  const inSquare = gx > 0.3 && gx < 0.7 && gy > 0.3 && gy < 0.7;
  const d = Math.hypot(gx - 0.5, gy - 0.5);
  return inSquare ? (d < 0.08 ? 0 : 1) : 0;
}

function chikan(u, v) {
  // Chikankari: fine tonal embroidery, barely-there sprigs.
  const a = Math.sin(u * 90) * Math.sin(v * 70);
  return a > 0.86 ? 1 : 0;
}

function floral(u, v, scale) {
  const gx = (u / scale) % 1;
  const gy = ((v * AR) / scale) % 1;
  let petal = 0;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const d = Math.hypot(gx - (0.5 + Math.cos(a) * 0.16), gy - (0.5 + Math.sin(a) * 0.16));
    petal = Math.max(petal, 1 - smooth(0.1, 0.04, d));
  }
  return petal;
}

function sequin(u, v) {
  // Scattered sparkle. Hashing per grid cell rather than per point — hashing a
  // sum of coordinates makes a plane wave, which reads as diagonal streaks.
  const cell = 0.03;
  const gx = Math.floor(u / cell);
  const gy = Math.floor((v * AR) / cell);
  const rand = (a, b) => {
    const h = Math.sin(gx * a + gy * b) * 43758.5453;
    return h - Math.floor(h);
  };
  const present = rand(127.1, 311.7);
  if (present < 0.55) return 0;
  const cx = (gx + 0.2 + rand(269.5, 183.3) * 0.6) * cell;
  const cy = ((gy + 0.2 + rand(419.2, 371.9) * 0.6) * cell) / AR;
  const d = Math.hypot(u - cx, (v - cy) * AR);
  return 1 - smooth(cell * 0.2, cell * 0.07, d);
}

const MOTIF = {
  buti: (u, v) => buti(u, v, 0.13),
  buti_fine: (u, v) => buti(u, v, 0.085),
  block: (u, v) => block(u, v, 0.1),
  chikan,
  floral: (u, v) => floral(u, v, 0.16),
  sequin,
  plain: () => 0,
};

/* ── silhouettes ─────────────────────────────────────────────────────── */
/* Each returns 0 outside the garment, 1 inside, fractional at the edge. */

function silhouetteSaree(u, v) {
  // A saree shown as it hangs on the shop wall: a broad fall with the pallu
  // folded over the upper left, which is how the pattern is actually judged.
  const top = 0.06;
  const bottom = hemAt(u, 0.93, 0.012);
  if (v < top || v > bottom) return 0;
  const half = taper(v, top, bottom, 0.30, 0.345);
  return 1 - smooth(half, 0.006, Math.abs(u - 0.5));
}

function silhouetteKurti(u, v, { hem = 0.86, flare = 0.235, sleeve = 0.44 } = {}) {
  const shoulder = 0.155;
  const du = Math.abs(u - 0.5);

  // sleeves: from the shoulder line, angled outward and down
  if (v >= shoulder && v <= sleeve) {
    const t = (v - shoulder) / (sleeve - shoulder);
    const outer = 0.175 + t * 0.115;
    const inner = 0.10 + t * 0.055;
    if (du <= outer && du >= inner) return 1 - smooth(outer, 0.006, du);
  }

  const bottom = hemAt(u, hem, 0.008);
  if (v < shoulder || v > bottom) return 0;
  const half = taper(v, shoulder, bottom, 0.175, flare);
  return 1 - smooth(half, 0.006, du);
}

function silhouetteLehenga(u, v) {
  const du = Math.abs(u - 0.5);
  // choli
  if (v >= 0.13 && v <= 0.36) {
    const half = taper(v, 0.13, 0.36, 0.16, 0.185);
    return 1 - smooth(half, 0.006, du);
  }
  // skirt
  const bottom = hemAt(u, 0.92, 0.014);
  if (v >= 0.44 && v <= bottom) {
    const half = taper(v, 0.44, bottom, 0.115, 0.40);
    return 1 - smooth(half, 0.006, du);
  }
  return 0;
}

function silhouetteDress(u, v) {
  const du = Math.abs(u - 0.5);
  // straps
  if (v >= 0.15 && v <= 0.23 && du > 0.055 && du < 0.135) return 1;
  const bottom = hemAt(u, 0.84, 0.01);
  if (v < 0.22 || v > bottom) return 0;
  const half = taper(v, 0.22, bottom, 0.165, 0.315);
  return 1 - smooth(half, 0.006, du);
}

function silhouetteBlouse(u, v) {
  const du = Math.abs(u - 0.5);
  if (v >= 0.24 && v <= 0.40) {
    const t = (v - 0.24) / 0.16;
    const outer = 0.20 + t * 0.075;
    const inner = 0.115 + t * 0.03;
    if (du <= outer && du >= inner) return 1 - smooth(outer, 0.006, du);
  }
  if (v < 0.24 || v > 0.60) return 0;
  const half = taper(v, 0.24, 0.60, 0.20, 0.215);
  return 1 - smooth(half, 0.006, du);
}

/** The neck opening, cut out of the shoulder line. */
function neckline(u, v, top, depth, width) {
  const du = Math.abs(u - 0.5) / width;
  const dv = (v - top) / depth;
  if (dv < 0) return 0;
  return 1 - smooth(1, 0.06, Math.hypot(du, dv));
}

/* ── the pieces ──────────────────────────────────────────────────────── */

const PIECES = [
  {
    file: 'saree-kanjivaram.png', kind: 'saree', motif: 'buti',
    cloth: '#7d1f2e', border: 0.075, pallu: true,
  },
  {
    file: 'saree-georgette.png', kind: 'saree', motif: 'buti_fine',
    cloth: '#12604a', border: 0.045, pallu: true,
  },
  {
    file: 'kurti-handblock.png', kind: 'kurti', motif: 'block',
    cloth: '#2f4574', opts: {},
  },
  {
    file: 'kurti-anarkali.png', kind: 'kurti', motif: 'chikan',
    cloth: '#f0e6d2', opts: { hem: 0.90, flare: 0.38, sleeve: 0.40 }, ink: '#cbb994',
  },
  {
    file: 'kurti-rayon.png', kind: 'kurti', motif: 'plain',
    cloth: '#d19a2b', opts: { hem: 0.84, flare: 0.215 },
  },
  {
    file: 'dress-aline.png', kind: 'dress', motif: 'floral',
    cloth: '#d4788d',
  },
  {
    file: 'lehenga-sequin.png', kind: 'lehenga', motif: 'sequin',
    cloth: '#5d1730',
  },
  {
    file: 'blouse-silk.png', kind: 'blouse', motif: 'buti_fine',
    cloth: '#b8912f', border: 0,
  },
];

function backdrop(u, v) {
  // Soft studio sweep — lighter behind the garment, settling at the base.
  const d = Math.hypot((u - 0.5) * 1.1, (v - 0.42) * 0.9);
  const t = Math.max(0, Math.min(1, d * 1.25));
  const base = mix(mix(PAPER, [255, 252, 246], 0.5), PAPER_2, t);
  const floor = smooth(0.88, 0.09, v);
  return mix(base, shade(PAPER_2, -0.06), floor * 0.55);
}

function draw(piece) {
  const cloth = hex(piece.cloth);
  const ink = piece.ink ? hex(piece.ink) : null;
  const motif = MOTIF[piece.motif];

  const silhouette = (u, v) => {
    switch (piece.kind) {
      case 'saree': return silhouetteSaree(u, v);
      case 'kurti': return silhouetteKurti(u, v, piece.opts);
      case 'lehenga': return silhouetteLehenga(u, v);
      case 'dress': return silhouetteDress(u, v);
      case 'blouse': return silhouetteBlouse(u, v);
      default: return 0;
    }
  };

  return (u, v) => {
    const bg = backdrop(u, v);

    // Contact shadow so the piece sits on the sweep rather than floating.
    const sh = silhouette(u, v - 0.012) * (1 - smooth(0.5, 0.5, v)) * 0.16;
    const ground = mix(bg, shade(PAPER_2, -0.35), sh);

    const a = silhouette(u, v);
    if (a <= 0) return ground;

    // Base cloth with a soft fold gradient — flat colour reads as paper.
    const fold = Math.sin(u * Math.PI * 4.5) * 0.5 + 0.5;
    let c = mix(shade(cloth, -0.07), shade(cloth, 0.05), fold * 0.5 + 0.25);
    c = mix(c, shade(cloth, -0.22), smooth(0.80, 0.22, v) * 0.5);

    const accent = ink ?? GOLD;
    const accentHi = ink ? shade(ink, 0.25) : GOLD_HI;

    // motif
    const m = motif(u, v);
    if (m > 0) c = mix(c, mix(accent, accentHi, fold), m * (piece.motif === 'chikan' ? 0.55 : 0.92));

    if (piece.kind === 'saree') {
      const du = Math.abs(u - 0.5);
      const half = taper(v, 0.06, 0.93, 0.30, 0.345);
      // Zari borders down both selvedges.
      if (piece.border > 0 && du > half - piece.border) {
        const t = (du - (half - piece.border)) / piece.border;
        c = mix(mix(GOLD, GOLD_HI, Math.sin(t * Math.PI)), c, 0.12);
        if (block(u, v, 0.035)) c = mix(c, shade(cloth, -0.2), 0.5);
      }
      // The pallu, folded over the top — where the real work always is. Built
      // as stacked zari bands rather than one gold block, which is what makes
      // a pallu read as a pallu.
      if (piece.pallu && v < 0.30) {
        const edge = 1 - smooth(0.30, 0.014, v);
        const band = (v - 0.06) / 0.24; // 0..1 down the pallu
        let p = mix(GOLD, GOLD_HI, fold * 0.6 + 0.2);

        // Fine stripes across the whole pallu.
        const stripe = Math.sin(v * AR * 190) * 0.5 + 0.5;
        p = mix(p, shade(GOLD, -0.28), stripe * 0.25);

        // Three woven registers, each with its own motif.
        if (band > 0.18 && band < 0.44) {
          if (buti(u, v, 0.055) > 0.5) p = mix(p, shade(cloth, -0.15), 0.8);
        } else if (band > 0.52 && band < 0.78) {
          if (block(u, v, 0.042)) p = mix(p, shade(cloth, -0.15), 0.8);
        }
        // Dividing rules between the registers.
        for (const at of [0.14, 0.48, 0.82]) {
          if (Math.abs(band - at) < 0.022) p = mix(p, shade(cloth, -0.3), 0.75);
        }
        c = mix(c, p, edge * 0.94);
      }
    }

    if (piece.kind === 'lehenga') {
      // Dupatta falling across the skirt — sheer, so it lightens the cloth
      // underneath rather than painting a different colour over it.
      const band = Math.abs((u - 0.5) * 1.6 + (v - 0.62) * 2.2);
      if (v > 0.40 && band < 0.17) {
        const t = 1 - smooth(0.17, 0.055, band);
        c = mix(c, shade(c, 0.30), t * 0.72);
        // Gold selvedge along both edges of the fall.
        if (Math.abs(band - 0.155) < 0.014) c = mix(c, mix(GOLD, GOLD_HI, fold), 0.7);
      }
      // Hem border.
      const bottom = hemAt(u, 0.92, 0.014);
      if (v > bottom - 0.045) c = mix(mix(GOLD, GOLD_HI, fold), c, 0.15);
    }

    if (piece.kind === 'kurti' || piece.kind === 'dress' || piece.kind === 'blouse') {
      const hem = piece.kind === 'blouse' ? 0.60 : (piece.opts?.hem ?? (piece.kind === 'dress' ? 0.84 : 0.86));
      const bottom = hemAt(u, hem, piece.kind === 'dress' ? 0.01 : 0.008);
      if (v > bottom - 0.022) c = mix(c, shade(accent, -0.05), 0.55);
    }

    // Neckline, cut last so it sits over the motif. A saree has no neck to cut;
    // on a lehenga it belongs to the choli.
    const neck = piece.kind === 'saree' ? 0
      : piece.kind === 'lehenga' ? neckline(u, v, 0.13, 0.075, 0.08)
      : neckline(u, v, piece.kind === 'blouse' ? 0.24 : 0.15, piece.kind === 'dress' ? 0.10 : 0.085, 0.085);
    if (neck > 0) c = mix(c, mix(ground, shade(cloth, -0.45), 0.55), neck);

    // Edge darkening so the silhouette holds against the pale sweep.
    c = mix(shade(c, -0.3), c, Math.min(1, a * 1.6));

    return mix(ground, c, a);
  };
}

for (const piece of PIECES) {
  writeFileSync(join(OUT, piece.file), png(W, H, draw(piece)));
  console.log('wrote', piece.file);
}
console.log(`\n${PIECES.length} demo garments in public/seed — replace them with real photos from Staff → Catalogue.`);
