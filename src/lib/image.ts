/** Image helpers: everything stays local to the device — nothing is uploaded
 *  unless the shop has explicitly configured an AI try-on provider. */

export function money(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const url = await blobToDataUrl(blob);
  return url.slice(url.indexOf(',') + 1);
}

export function base64ToBlob(b64: string, mime = 'image/png'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function loadBitmap(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode that image.'));
    };
    img.src = url;
  });
}

/** Downscales to `max` on the long edge and re-encodes as JPEG. Keeps the
 *  IndexedDB store small and the AI upload fast on shop wifi. */
export async function shrink(file: Blob, max = 1280, quality = 0.86): Promise<Blob> {
  const img = await loadBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
  return out ?? file;
}
