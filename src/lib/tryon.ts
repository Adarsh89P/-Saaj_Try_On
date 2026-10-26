import { bumpUsage, loadUsage } from './db';
import { base64ToBlob, blobToBase64, loadBitmap } from './image';
import { CATEGORIES, type Product, type Settings, type TryOnProviderId } from './types';

export interface TryOnRequest {
  person: Blob;
  /** The product's own photo, when the shop has uploaded one. */
  garment?: Blob;
  product: Product;
  /** Where the result is set. 'photo' keeps the customer's own background. */
  occasion?: Occasion;
}

/** Settings a customer can see the look in, after the way Aza Fashions offers
 *  an occasion per try-on: a bridal lehenga reads very differently against the
 *  shop's shelves than in a mandap. Each one is a second scene description,
 *  never a second image, so it costs nothing extra. */
export const OCCASIONS = {
  photo: '',
  wedding: 'a softly lit wedding venue with marigold garlands, a decorated mandap and warm evening light',
  festive: 'a festive home courtyard during Diwali, with diyas, rangoli and warm golden light',
  studio: 'a clean, evenly lit photo studio with a plain warm-grey backdrop',
} as const;

export type Occasion = keyof typeof OCCASIONS;

export type ProgressFn = (percent: number, step: string) => void;

export interface TryOnResult {
  image: Blob;
  /** True when no real garment transfer happened — the UI labels these. */
  simulated: boolean;
}

// Translation keys, not text: the customer screen looks these up in her language.
const STEPS = ['step.reading', 'step.shape', 'step.fitting', 'step.drape'];

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

  onProgress(100, 'step.ready');
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

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function imagePart(image: Blob): Promise<Part> {
  return { inline_data: { mime_type: image.type || 'image/jpeg', data: await blobToBase64(image) } };
}

/** Shared request body for both Gemini endpoints. */
async function requestParts(prompt: string, images: Blob[]): Promise<Part[]> {
  return [{ text: prompt }, ...(await Promise.all(images.map(imagePart)))];
}

function apiError(status: number, detail: string, whatFailed: string) {
  let message = `${whatFailed} service returned ${status}.`;
  try {
    const parsed = JSON.parse(detail);
    if (parsed?.error?.message) message = parsed.error.message;
  } catch { /* keep the status-code message */ }
  return new Error(message);
}

/* ── transport ──────────────────────────────────────────────────────────
 * Shop wifi drops, and Google answers 429/503 when it is busy. Neither is
 * billed and neither is the customer's fault, so they are retried quietly
 * before anything reaches the screen. A hung request is cut off rather than
 * leaving the customer watching a progress bar that never ends.
 * ------------------------------------------------------------------- */

const RETRIES = 2;
const REQUEST_TIMEOUT_MS = 120_000;

async function postJson(url: string, key: string, body: unknown, whatFailed: string) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch {
      if (attempt < RETRIES) { await sleep(1500 * 2 ** attempt); continue; }
      throw new Error(ctrl.signal.aborted
        ? `${whatFailed} took too long. Check the shop's internet and try again.`
        : `${whatFailed} could not reach Google. Check the shop's internet and try again.`);
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < RETRIES) {
      await sleep(1500 * 2 ** attempt);
      continue;
    }
    throw apiError(res.status, await res.text().catch(() => ''), whatFailed);
  }
}

/** Output shapes the image models accept. The result is pinned to the one
 *  nearest the customer's photo: left free, the model re-frames the shot, and a
 *  re-framed shot is where stretched bodies and changed faces come from. */
const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

function nearestAspectRatio(width: number, height: number) {
  const target = Math.log(width / height);
  let best = ASPECT_RATIOS[0];
  let bestDiff = Infinity;
  for (const r of ASPECT_RATIOS) {
    const [w, h] = r.split(':').map(Number);
    const diff = Math.abs(Math.log(w / h) - target);
    if (diff < bestDiff) { best = r; bestDiff = diff; }
  }
  return best;
}

/** Reads a garment photo and returns what it is, as JSON. Used by bulk add so
 *  staff type a price and nothing else. */
export async function describeGarment(
  photo: Blob,
  settings: Settings,
): Promise<{ name?: string; cat?: string; color?: string; sizes?: string[]; details?: string }> {
  if (!settings.geminiKey) throw new Error('No Gemini API key set.');
  await reserveRequest(settings);

  const prompt =
    `This is a photograph of a single garment sold in an Indian ladies' clothing shop. ` +
    `Identify it and reply with JSON only, no prose, in this exact shape: ` +
    `{"name": string, "cat": string, "color": string, "sizes": string[], "details": string}. ` +
    `"cat" must be exactly one of: ${CATEGORIES.join(', ')}. ` +
    `"name" is a short shop-floor name of at most four words, naming the fabric or work and the garment ` +
    `(for example "Banarasi Silk Saree" or "Chikankari Cotton Kurti"). Do not include the colour in the name. ` +
    `"color" is one common colour word for the main body of the garment. ` +
    `"sizes" is ["Free size"] for a saree or a dupatta, and otherwise the usual run ["S","M","L","XL"]. ` +
    `"details" is one plain sentence, at most 40 words, listing what a tailor would check to recognise this exact ` +
    `piece: the border and its colour, the pallu, motifs and print, embroidery, zari or mirror work, neckline, ` +
    `sleeve length and garment length, whichever are visible.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiTextModel)}:generateContent`;
  const data = await postJson(url, settings.geminiKey, {
    contents: [{ role: 'user', parts: await requestParts(prompt, [photo]) }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  }, 'Photo reading');
  const text: string = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? '';
  try {
    // Models sometimes wrap JSON in a code fence even when asked not to.
    const parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
    return {
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 60) : undefined,
      cat: CATEGORIES.includes(parsed.cat) ? parsed.cat : undefined,
      color: typeof parsed.color === 'string' ? parsed.color.slice(0, 24) : undefined,
      sizes: Array.isArray(parsed.sizes) ? parsed.sizes.filter((z: unknown) => typeof z === 'string').slice(0, 8) : undefined,
      details: typeof parsed.details === 'string' ? parsed.details.slice(0, 300) : undefined,
    };
  } catch {
    // A shape we cannot read is not worth failing the whole batch over.
    return {};
  }
}

/** One image-editing round trip to Google. Shared by the try-on and by the
 *  catalogue's background removal — same endpoint, same key, same error shape. */
/** Reasons Google gives for refusing an image. Asking again gets the same answer. */
const BLOCKED = new Set(['SAFETY', 'IMAGE_SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_PROHIBITED_CONTENT']);

async function geminiEdit(
  parts: Part[],
  settings: Settings,
  whatFailed: string,
  aspectRatio?: string,
): Promise<Blob> {
  if (!settings.geminiKey) throw new Error('No Gemini API key set. Add one in Staff → Settings, or switch to the demo engine.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel)}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      // Image only: a model allowed to answer in text sometimes describes the
      // edit instead of making it, and that reply is billed all the same.
      responseModalities: ['IMAGE'],
      ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
    },
  };

  // A reply with no image in it is usually a one-off; one more try is worth it.
  for (let attempt = 0; attempt < 2; attempt++) {
    await reserveRequest(settings);
    const data = await postJson(url, settings.geminiKey, body, whatFailed);

    const candidate = data?.candidates?.[0];
    const reason: string | undefined = data?.promptFeedback?.blockReason ?? candidate?.finishReason;
    const out: Array<{ inlineData?: { data: string; mimeType?: string }; inline_data?: { data: string; mime_type?: string } }> =
      candidate?.content?.parts ?? [];
    const found = out.find((p) => p.inlineData?.data || p.inline_data?.data);
    const payload = found?.inlineData
      ?? (found?.inline_data ? { data: found.inline_data.data, mimeType: found.inline_data.mime_type } : undefined);
    if (payload?.data) return base64ToBlob(payload.data, payload.mimeType || 'image/png');

    if (reason && BLOCKED.has(reason)) {
      throw new Error(
        `Google declined to edit this photo (${reason}). Retake it standing straight, fully clothed, ` +
        `with only one person in the frame, then try again.`,
      );
    }
  }
  throw new Error(`The ${whatFailed.toLowerCase()} service did not return an image. Please try again.`);
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

  return geminiEdit(await requestParts(prompt, [photo]), settings, 'Photo cleanup');
}

/* ── try-on prompt ──────────────────────────────────────────────────────
 * Each image is introduced by name before it appears, so the model never has
 * to guess which photo is the customer and which is the stock. A saree laid
 * flat says nothing about how it is worn, so each category also says how the
 * piece goes on the body — without that the model wraps a saree like a gown.
 * ------------------------------------------------------------------- */

const DRAPE: Record<string, string> = {
  Sarees:
    `Drape it the way a saree is worn: neat front pleats tucked in at the waist, the pallu taken over the left ` +
    `shoulder and falling behind, worn over a fitted blouse that matches the saree. The border runs along the hem ` +
    `and the pallu edge; the pallu shows its own design where it falls.`,
  Lehengas:
    `Dress the person in it as a lehenga set: a flared, floor-length skirt from the natural waist with its full ` +
    `volume, the matching choli, and the dupatta draped as in the garment photo.`,
  Kurtis:
    `It is a kurti: keep its own length, neckline, sleeve length and side slits. Keep the bottoms the person is ` +
    `wearing below it, unless the garment photo includes its own.`,
  Blouses:
    `It is a blouse: replace only the top. Keep everything the person wears below the waist.`,
  Dresses:
    `Keep the dress's own length, neckline, sleeves and silhouette.`,
};

function tryOnPrompt(product: TryOnRequest['product'], occasion: Occasion = 'photo') {
  const kind = product.cat.toLowerCase().replace(/s$/, '');
  const details = product.details?.trim();
  const scene = OCCASIONS[occasion];
  return (
    `Virtual try-on. Edit IMAGE 1 so the person in it is wearing the garment from IMAGE 2. ` +
    `This is an edit of IMAGE 1, not a new photograph.\n\n` +
    `Keep from IMAGE 1, unchanged: the face and expression, skin tone, hair, body shape and size, height, pose, ` +
    `hands, jewellery, bindi and mehendi, the camera angle, framing and crop` +
    (scene ? `. ` : `, the background and the lighting. `) +
    `Do not slim, beautify, retouch, age or reshape the person, and do not zoom, crop or re-frame the photo. ` +
    (scene
      ? `Only the clothing and the background change: replace the background with ${scene}, and light the person ` +
        `to match it without changing their face or skin tone.\n\n`
      : `Only the clothing changes.\n\n`) +
    `Take from IMAGE 2, exactly: the garment "${product.name}", a ${product.color.toLowerCase()} ${kind}. ` +
    `Reproduce its colour, print, motifs, border, embroidery or zari work, fabric texture and sheen faithfully. ` +
    (details ? `It must show: ${details} ` : '') +
    `Do not invent patterns, simplify the design or shift the colour. Ignore any mannequin, hanger or background in IMAGE 2.\n\n` +
    (DRAPE[product.cat] ? `${DRAPE[product.cat]}\n\n` : '') +
    `Fit it to this person's body and pose with realistic folds and shadows that match the light in IMAGE 1. ` +
    `Return only the edited photograph.`
  );
}

async function runGemini(req: TryOnRequest, onProgress: ProgressFn, settings: Settings): Promise<TryOnResult> {
  if (!req.garment) throw new Error(`"${req.product.name}" has no photo yet. Add one in Staff → Catalogue.`);

  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(92, pct + 1.4);
    onProgress(pct, STEPS[Math.min(STEPS.length - 1, Math.floor((pct / 100) * STEPS.length))]);
  }, 220);

  try {
    const shot = await loadBitmap(req.person);
    const parts: Part[] = [
      { text: 'IMAGE 1 — the customer. Keep this person exactly as they are:' },
      await imagePart(req.person),
      { text: 'IMAGE 2 — the garment to put on them:' },
      await imagePart(req.garment),
      { text: tryOnPrompt(req.product, req.occasion) },
    ];

    const image = await geminiEdit(parts, settings, 'Try-on', nearestAspectRatio(shot.width, shot.height));
    onProgress(100, 'step.ready');
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
