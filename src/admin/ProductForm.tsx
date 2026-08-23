import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Media } from '../components/Img';
import { saveImage, deleteImage } from '../lib/db';
import { shrink } from '../lib/image';
import { canCleanPhotos, removeBackground } from '../lib/tryon';
import { CATEGORIES, type Product } from '../lib/types';

const blank = (): Product => ({
  id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  name: '', cat: 'Sarees', price: 0, color: '', sizes: ['Free size'], stock: 1, createdAt: Date.now(),
});

export function ProductForm({ initial, onClose }: { initial?: Product; onClose: () => void }) {
  const { saveProduct, deleteProduct, settings } = useStore();
  const [draft, setDraft] = useState<Product>(() => initial ?? blank());
  const [sizes, setSizes] = useState(() => (initial ?? blank()).sizes.join(', '));
  const [busy, setBusy] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  /** The untouched upload, kept while the cleaned version is on screen so the
   *  shop can reject a bad cutout. Whichever is not chosen gets deleted. */
  const [originalKey, setOriginalKey] = useState<string>();
  const [cleanNote, setCleanNote] = useState<string>();
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('input, select, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setCleanNote(undefined);

    let rawKey: string;
    try {
      rawKey = await saveImage(await shrink(file, 1400), 'product');
      if (draft.imageKey) await deleteImage(draft.imageKey);
      if (originalKey) await deleteImage(originalKey);
      setOriginalKey(undefined);
      setDraft((d) => ({ ...d, imageKey: rawKey }));
    } catch {
      setError('That file could not be read as an image.');
      setBusy(false);
      return;
    }
    setBusy(false);

    // The cutout is a second, billed request, so it only runs when the shop has
    // switched it on and a key is set. A failure here is never fatal: the photo
    // is already saved, and the shop simply keeps the one it took.
    if (!settings.cleanGarmentPhotos || !canCleanPhotos(settings)) return;

    setCleaning(true);
    try {
      const raw = await shrink(file, 1400);
      const label = `${draft.color || 'unknown colour'} ${draft.cat.toLowerCase().replace(/s$/, '')}`.trim();
      const cleanedKey = await saveImage(await shrink(await removeBackground(raw, label, settings), 1400), 'product');
      setOriginalKey(rawKey);
      setDraft((d) => ({ ...d, imageKey: cleanedKey }));
      setCleanNote('Background removed. Check it looks right — the original is one tap away.');
    } catch (err) {
      setCleanNote(
        `Could not clean this photo up, so the original is being used. ${err instanceof Error ? err.message : ''}`.trim(),
      );
    } finally {
      setCleaning(false);
    }
  };

  /** Puts the untouched upload back and throws the cutout away. */
  const keepOriginal = async () => {
    if (!originalKey) return;
    const cleaned = draft.imageKey;
    setDraft((d) => ({ ...d, imageKey: originalKey }));
    setOriginalKey(undefined);
    setCleanNote(undefined);
    if (cleaned && cleaned !== originalKey) await deleteImage(cleaned);
  };

  const submit = async () => {
    const parsedSizes = sizes.split(',').map((z) => z.trim()).filter(Boolean);
    if (!draft.name.trim()) { setError('Give the piece a name.'); return; }
    if (parsedSizes.length === 0) { setError('List at least one size.'); return; }
    setBusy(true);
    await saveProduct({
      ...draft,
      name: draft.name.trim(),
      color: draft.color.trim() || 'Assorted',
      price: Math.max(0, Math.round(draft.price)),
      stock: Math.max(0, Math.round(draft.stock)),
      sizes: parsedSizes,
    });
    // Whichever version was not chosen is dead weight now.
    if (originalKey && originalKey !== draft.imageKey) await deleteImage(originalKey);
    setBusy(false);
    onClose();
  };

  const remove = async () => {
    if (!initial) return;
    if (!confirm(`Remove "${initial.name}" from the catalogue?`)) return;
    setBusy(true);
    await deleteProduct(initial.id);
    onClose();
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={initial ? 'Edit piece' : 'Add a piece'} onClick={onClose}>
      <div className="sheet__panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2 className="h-md">{initial ? 'Edit piece' : 'Add a piece'}</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="hstack" style={{ alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 110, flex: 'none' }}>
            <Media imageKey={draft.imageKey} label="No photo" className="media media--3x4 media--r22" />
          </div>
          <div className="stack" style={{ flex: 1 }}>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => fileRef.current?.click()} disabled={busy || cleaning}>
              {cleaning ? 'Removing background…' : draft.imageKey ? 'Replace photo' : 'Add photo'}
            </button>

            {cleaning && (
              <p className="tiny muted" style={{ margin: 0 }}>
                Cutting the piece out of the shop background. This takes a few seconds.
              </p>
            )}

            {cleanNote && !cleaning && <p className="tiny muted" style={{ margin: 0 }}>{cleanNote}</p>}

            {originalKey && !cleaning && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void keepOriginal()}>
                Use the original photo instead
              </button>
            )}

            <p className="tiny muted" style={{ margin: 0 }}>
              A clear, front-on photo of the garment gives the best try-on. Shoot the whole piece opened
              out, with no hands or faces in the frame.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pf-name">Name</label>
          <input id="pf-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>

        <div className="hstack" style={{ gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="pf-cat">Category</label>
            <select id="pf-cat" className="select" value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="pf-color">Colour</label>
            <input id="pf-color" className="input" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
          </div>
        </div>

        <div className="hstack" style={{ gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="pf-price">Price (₹)</label>
            <input
              id="pf-price" className="input" type="number" inputMode="numeric" min={0}
              value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="pf-stock">In stock</label>
            <input
              id="pf-stock" className="input" type="number" inputMode="numeric" min={0}
              value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pf-sizes">Sizes (comma separated)</label>
          <input id="pf-sizes" className="input" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L, XL" />
        </div>

        <button type="button" className="btn btn--primary btn--block" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Saving…' : 'Save piece'}
        </button>
        {initial && (
          <button type="button" className="btn btn--ghost" style={{ color: 'var(--color-accent-700)' }} onClick={() => void remove()} disabled={busy}>
            Remove from catalogue
          </button>
        )}
      </div>
    </div>
  );
}
