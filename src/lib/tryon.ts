import { bumpUsage, loadUsage } from './db';
import { base64ToBlob, blobToBase64, loadBitmap } from './image';
import { CATEGORIES, type Product, type Settings, type TryOnProviderId } from './types';

export interface TryOnRequest {
  person: Blob;
  /** The product's own photo, when the shop has uploaded one. */
  garment?: Blob;
  product: Product;
}

export type ProgressFn = (percent: number, step: string) => void;

export interface TryOnResult {
  image: Blob;
  /** True when no real garment transfer happened — the UI labels these. */
  simulated: boolean;
}

const STEPS = ['Reading your photo', 'Matching your shape', 'Fitting the garment', 'Smoothing the drape'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── demo provider ──────────────────────────────────────────────────────
 * No network, no API key, works on the shop floor from day one. It composites
 * the garment photo over the torso of the person photo with a soft mask — the
 * flow, timing and result screen are exactly what the AI provider produces, so
 * staff can be trained and the hardware tested before any key is bought.
 * ------------------------------------------------------------------- */

async function runDemo(req: TryOnRequest, onProgress: ProgressFn, seconds: number): Promise<TryOnResult> {
  const started = Date.now();
  const total = Math.max(600, seconds * 1000);

  const person = await loadBitmap(req.person);
  const garment = req.garment ? await loadBitmap(req.garment) : null;

  // Animate the progress bar over the configured duration.
  const tick = 60;
  while (Date.now() - started < total) {
    const pct = Math.min(99, ((Date.now() - started) / total) * 100);
    onProgress(pct, STEPS[Math.min(STEPS.length - 1, Math.floor((pct / 100) * STEPS.length))]);
    await sleep(tick);
  }

  const W = person.width;
  const H = person.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot render the preview.');

  ctx.drawImage(person, 0, 0, W, H);

  if (garment) {
    // Torso-to-hem band: roughly shoulders (22% down) to below the knee (88%).
    const top = H * 0.22;
    const height = H * 0.66;
    const width = Math.min(W * 0.72, (garment.width / garment.height) * height);
    const left = (W - width) / 2;

    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const lctx = layer.getContext('2d');
    if (lctx) {
      lctx.drawImage(garment, left, top, width, height);
      // Feather the edges so it reads as a drape rather than a pasted rectangle.
      lctx.globalCompositeOperation = 'destination-in';
      const mask = lctx.createRadialGradient(W / 2, top + height * 0.45, height * 0.12, W / 2, top + height * 0.45, height * 0.62);
      mask.addColorStop(0, 'rgba(0,0,0,1)');
      mask.addColorStop(0.72, 'rgba(0,0,0,0.96)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = mask;
      lctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }

  // Honest labelling: a demo render must never be mistaken for a real fit.
  const pad = Math.round(Math.min(W, H) * 0.032);
  const fontSize = Math.round(Math.min(W, H) * 0.036);
  ctx.font = `600 ${fontSize}px Figtree, system-ui, sans-serif`;
  const label = 'Demo preview — not a real fit';
  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(32,30,29,0.72)';
  const boxW = textWidth + pad * 1.6;
  const boxH = fontSize + pad;
  const boxX = (W - boxW) / 2;
  const boxY = H - boxH - pad;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.fillStyle = '#fff8f1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, boxY + boxH / 2);

  onProgress(100, 'Ready');
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Could not save the preview.');
  return { image: blob, simulated: true };
}

/* ── Gemini provider ────────────────────────────────────────────────────
 * Real garment transfer through Google's image model. The key lives only in
 * this device's IndexedDB and the request goes straight from the tablet to
 * Google — no server of ours ever sees the customer's photo.
 * ------------------------------------------------------------------- */

/* ── spend guard ────────────────────────────────────────────────────────
 * Every call below is billed by Google. Without a ceiling, a slow afternoon of
 * curious try-ons becomes a bill the shop finds out about later.
 * ------------------------------------------------------------------- */

export class LimitReached extends Error {}

async function reserveRequest(settings: Settings) {
  const usage = await loadUsage();
  if (settings.dailyRequestLimit > 0 && usage.count >= settings.dailyRequestLimit) {
    throw new LimitReached(
      `Today's limit of ${settings.dailyRequestLimit} AI requests has been used. ` +
      `Raise it in Staff → Settings, or switch to the demo engine for the rest of the day.`,
    );
  }
  await bumpUsage();
}

/** Shared request body for both Gemini endpoints. */
async function requestParts(prompt: string, images: Blob[]) {
  const encoded = await Promise.all(images.map(blobToBase64));
  return [
    { text: prompt },
    ...encoded.map((data, i) => ({ inline_data: { mime_type: images[i].type || 'image/jpeg', data } })),
  ];
}

function apiError(status: number, detail: string, whatFailed: string) {
  let message = `${whatFailed} service returned ${status}.`;
  try {
    const parsed = JSON.parse(detail);
    if (parsed?.error?.message) message = parsed.error.message;
  } catch { /* keep the status-code message */ }
  return new Error(message);
}

/** Reads a garment photo and returns what it is, as JSON. Used by bulk add so
 *  staff type a price and nothing else. */
export async function describeGarment(
  photo: Blob,
  settings: Settings,
): Promise<{ name?: string; cat?: string; color?: string; sizes?: string[] }> {
  if (!settings.geminiKey) throw new Error('No Gemini API key set.');
  await reserveRequest(settings);

  const prompt =
    `This is a photograph of a single garment sold in an Indian ladies' clothing shop. ` +
    `Identify it and reply with JSON only, no prose, in this exact shape: ` +
    `{"name": string, "cat": string, "color": string, "sizes": string[]}. ` +
    `"cat" must be exactly one of: ${CATEGORIES.join(', ')}. ` +
    `"name" is a short shop-floor name of at most four words, naming the fabric or work and the garment ` +
    `(for example "Banarasi Silk Saree" or "Chikankari Cotton Kurti"). Do not include the colour in the name. ` +
    `"color" is one common colour word for the main body of the garment. ` +
    `"sizes" is ["Free size"] for a saree or a dupatta, and otherwise the usual run ["S","M","L","XL"].`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiTextModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.geminiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: await requestParts(prompt, [photo]) }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });

  if (!res.ok) throw apiError(res.status, await res.text().catch(() => ''), 'Photo reading');

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? '';
  try {
    // Models sometimes wrap JSON in a code fence even when asked not to.
    const parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
    return {
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 60) : undefined,
      cat: CATEGORIES.includes(parsed.cat) ? parsed.cat : undefined,
      color: typeof parsed.color === 'string' ? parsed.color.slice(0, 24) : undefined,
      sizes: Array.isArray(parsed.sizes) ? parsed.sizes.filter((z: unknown) => typeof z === 'string').slice(0, 8) : undefined,
    };
  } catch {
    // A shape we cannot read is not worth failing the whole batch over.
    return {};
  }
}

/** One image-editing round trip to Google. Shared by the try-on and by the
 *  catalogue's background removal — same endpoint, same key, same error shape. */
async function geminiEdit(
  prompt: string,
  images: Blob[],
  settings: Settings,
  whatFailed: string,
): Promise<Blob> {
  if (!settings.geminiKey) throw new Error('No Gemini API key set. Add one in Staff → Settings, or switch to the demo engine.');
  await reserveRequest(settings);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.geminiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: await requestParts(prompt, images) }] }),
  });

  if (!res.ok) throw apiError(res.status, await res.text().catch(() => ''), whatFailed);

  const data = await res.json();
  const parts: Array<{ inlineData?: { data: string; mimeType?: string }; inline_data?: { data: string; mime_type?: string } }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const payload = imagePart?.inlineData
    ?? (imagePart?.inline_data ? { data: imagePart.inline_data.data, mimeType: imagePart.inline_data.mime_type } : undefined);
  if (!payload?.data) throw new Error(`The ${whatFailed.toLowerCase()} service did not return an image.`);

  return base64ToBlob(payload.data, payload.mimeType || 'image/png');
}

/* ── background removal ─────────────────────────────────────────────────
 * A garment shot on the shop floor carries shelves, hands and other stock into
 * the frame, and the try-on model then has to guess which part of the picture
 * is the piece being sold. Cleaning the photo once, when it is added to the
 * catalogue, pays for itself on every try-on afterwards.
 * ------------------------------------------------------------------- */

export function canCleanPhotos(settings: Settings) {
  return settings.provider === 'gemini' && Boolean(settings.geminiKey);
}

export async function removeBackground(photo: Blob, label: string, settings: Settings): Promise<Blob> {
  const prompt =
    `Remove the background from this photograph of a garment (${label}). ` +
    `Cut out everything that is not the garment itself — people, faces, hands, hangers, shelves, ` +
    `other clothes, packaging and floor — and place the garment on a plain, evenly lit off-white background. ` +
    `Keep the garment exactly as it is: do not change its colour, print, motifs, border, texture, drape or shape, ` +
    `and do not crop any part of it. Show the whole garment, centred, filling most of the frame. ` +
    `Return only the edited photograph.`;

  return geminiEdit(prompt, [photo], settings, 'Photo cleanup');
}

async function runGemini(req: TryOnRequest, onProgress: ProgressFn, settings: Settings): Promise<TryOnResult> {
  if (!req.garment) throw new Error(`"${req.product.name}" has no photo yet. Add one in Staff → Catalogue.`);

  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(92, pct + 1.4);
    onProgress(pct, STEPS[Math.min(STEPS.length - 1, Math.floor((pct / 100) * STEPS.length))]);
  }, 220);

  try {
    const prompt =
      `Replace the clothing worn by the person in the first image with the garment shown in the second image ` +
      `(a ${req.product.cat.toLowerCase().replace(/s$/, '')} in ${req.product.color.toLowerCase()}, "${req.product.name}"). ` +
      `Keep the person's face, body shape, pose, skin tone, hair and the background exactly as they are. ` +
      `Match the garment's colour, print and fabric faithfully, and drape it naturally with realistic folds, ` +
      `shadows and lighting consistent with the original photo. Return only the edited photograph.`;

    const image = await geminiEdit(prompt, [req.person, req.garment], settings, 'Try-on');
    onProgress(100, 'Ready');
    return { image, simulated: false };
  } finally {
    clearInterval(timer);
  }
}

export const PROVIDERS: Array<{ id: TryOnProviderId; label: string; note: string }> = [
  { id: 'demo', label: 'Demo (on device)', note: 'No key, no internet, no cost. Overlays the garment photo and marks the result as a demo.' },
  { id: 'gemini', label: 'Google Gemini', note: 'Real garment transfer. Needs an API key and internet; each try-on is billed by Google.' },
];

export async function runTryOn(req: TryOnRequest, settings: Settings, onProgress: ProgressFn): Promise<TryOnResult> {
  if (settings.provider === 'gemini') return runGemini(req, onProgress, settings);
  return runDemo(req, onProgress, settings.demoSeconds);
}
