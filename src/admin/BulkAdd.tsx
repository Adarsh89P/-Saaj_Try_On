import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Img } from '../components/Img';
import { deleteImage, saveImage } from '../lib/db';
import { shrink } from '../lib/image';
import { canCleanPhotos, describeGarment, LimitReached, removeBackground } from '../lib/tryon';
import { CATEGORIES, type Product } from '../lib/types';

interface Row {
  id: string;
  imageKey: string;
  /** Kept until the row is saved, so a bad cutout can be swapped back. */
  originalKey?: string;
  name: string;
  cat: string;
  color: string;
  sizes: string;
  price: number;
  stock: number;
  note?: string;
}

const newId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Adding stock one form at a time is what stops a shop from ever getting its
 *  catalogue in. Here the photos do the typing: pick a whole batch, let the
 *  model read each one, and the shop only confirms the price. */
export function BulkAdd({ onClose }: { onClose: () => void }) {
  const { settings, addProducts } = useStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const [clean, setClean] = useState(settings.cleanGarmentPhotos);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canRead = canCleanPhotos(settings); // same requirement: gemini engine + key
  const busy = Boolean(progress);

  const patchRow = (id: string, p: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(undefined);
    const list = Array.from(files);

    for (let i = 0; i < list.length; i++) {
      setProgress(`Reading photo ${i + 1} of ${list.length}…`);
      const id = newId();
      let imageKey: string;
      try {
        imageKey = await saveImage(await shrink(list[i], 1400), 'product');
      } catch {
        continue; // a file that will not decode is simply skipped
      }

      // Show the row immediately so the shop sees progress, then fill it in.
      setRows((prev) => [...prev, {
        id, imageKey, name: '', cat: 'Sarees', color: '', sizes: 'Free size', price: 0, stock: 1,
        note: canRead ? 'Reading…' : undefined,
      }]);

      if (!canRead) continue;

      try {
        const read = await describeGarment(await shrink(list[i], 1400), settings);
        patchRow(id, {
          name: read.name ?? '',
          cat: read.cat ?? 'Sarees',
          color: read.color ?? '',
          sizes: (read.sizes ?? ['Free size']).join(', '),
          note: read.name ? undefined : 'Could not read this one — fill it in yourself.',
        });
      } catch (err) {
        patchRow(id, { note: err instanceof Error ? err.message : 'Could not read this photo.' });
        if (err instanceof LimitReached) {
          setError(err.message);
          break; // no point burning through the rest of the batch
        }
        continue;
      }

      if (!clean) continue;
      try {
        setProgress(`Removing background ${i + 1} of ${list.length}…`);
        const raw = await shrink(list[i], 1400);
        const cleanedKey = await saveImage(await shrink(await removeBackground(raw, 'garment', settings), 1400), 'product');
        patchRow(id, { imageKey: cleanedKey, originalKey: imageKey });
      } catch (err) {
        if (err instanceof LimitReached) {
          setError(err.message);
          break;
        }
        // Keep the original photo; a failed cutout is not worth stopping for.
      }
    }

    setProgress(undefined);
  };

  const saveAll = async () => {
    const ready = rows.filter((r) => r.name.trim());
    if (!ready.length) { setError('Give at least one piece a name before saving.'); return; }
    setSaving(true);

    const products: Product[] = ready.map((r) => ({
      id: r.id,
      name: r.name.trim(),
      cat: r.cat,
      price: Math.max(0, Math.round(r.price)),
      color: r.color.trim() || 'Assorted',
      sizes: r.sizes.split(',').map((z) => z.trim()).filter(Boolean).length
        ? r.sizes.split(',').map((z) => z.trim()).filter(Boolean)
        : ['Free size'],
      stock: Math.max(0, Math.round(r.stock)),
      imageKey: r.imageKey,
      createdAt: Date.now(),
    }));

    await addProducts(products);
    // Drop the rejected cutouts and any row the shop never named.
    for (const r of rows) {
      if (r.originalKey) await deleteImage(r.originalKey);
      if (!r.name.trim()) await deleteImage(r.imageKey);
    }
    setSaving(false);
    onClose();
  };

  const drop = async (row: Row) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    await deleteImage(row.imageKey);
    if (row.originalKey) await deleteImage(row.originalKey);
  };

  const named = rows.filter((r) => r.name.trim()).length;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Add several pieces">
      <div className="sheet__panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="between">
          <h2 className="h-md">Add several pieces</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy || saving}>Close</button>
        </div>

        {error && <p className="error">{error}</p>}

        {rows.length === 0 && !busy && (
          <>
            <p className="tiny muted" style={{ margin: 0 }}>
              Photograph each piece hung flat against a plain wall, then pick them all at once.
              {canRead
                ? ' Each photo is read for its name, category and colour — you only type the price.'
                : ' Switch on the Gemini engine in Settings and the photos will fill in their own details.'}
            </p>
            {canRead && (
              <label className="hstack" style={{ gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)}
                  style={{ width: 22, height: 22, accentColor: 'var(--color-accent-500)' }}
                />
                <span style={{ fontSize: 14 }}>Also remove the backgrounds (doubles the requests)</span>
              </label>
            )}
          </>
        )}

        <button type="button" className="btn btn--primary btn--block" onClick={() => fileRef.current?.click()} disabled={busy || saving}>
          {busy ? progress : rows.length ? 'Add more photos' : 'Choose photos'}
        </button>
        <input
          ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { void pick(e.target.files); e.target.value = ''; }}
        />

        <div className="stack" style={{ gap: 12 }}>
          {rows.map((row) => (
            <div key={row.id} className="hstack" style={{ alignItems: 'flex-start', gap: 12, background: 'var(--color-neutral-200)', borderRadius: 18, padding: 12 }}>
              <div style={{ width: 74, flex: 'none' }}>
                <Img imageKey={row.imageKey} alt="" className="admin-thumb" />
              </div>
              <div className="stack" style={{ flex: 1, gap: 8, minWidth: 0 }}>
                {row.note && <p className="tiny muted" style={{ margin: 0 }}>{row.note}</p>}
                <input
                  className="input" placeholder="Name" value={row.name}
                  onChange={(e) => patchRow(row.id, { name: e.target.value })}
                />
                <div className="hstack" style={{ gap: 8 }}>
                  <select className="select" style={{ flex: 1 }} value={row.cat} onChange={(e) => patchRow(row.id, { cat: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    className="input" style={{ flex: 1 }} placeholder="Colour" value={row.color}
                    onChange={(e) => patchRow(row.id, { color: e.target.value })}
                  />
                </div>
                <div className="hstack" style={{ gap: 8 }}>
                  <input
                    className="input" style={{ flex: 1 }} type="number" inputMode="numeric" min={0} placeholder="Price ₹"
                    value={row.price || ''} onChange={(e) => patchRow(row.id, { price: Number(e.target.value) })}
                  />
                  <input
                    className="input" style={{ flex: 1 }} type="number" inputMode="numeric" min={0} placeholder="Stock"
                    value={row.stock} onChange={(e) => patchRow(row.id, { stock: Number(e.target.value) })}
                  />
                </div>
                <input
                  className="input" placeholder="Sizes, comma separated" value={row.sizes}
                  onChange={(e) => patchRow(row.id, { sizes: e.target.value })}
                />
                <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => void drop(row)}>
                  Remove this one
                </button>
              </div>
            </div>
          ))}
        </div>

        {rows.length > 0 && (
          <button type="button" className="btn btn--primary btn--block" onClick={() => void saveAll()} disabled={busy || saving || !named}>
            {saving ? 'Saving…' : `Save ${named} ${named === 1 ? 'piece' : 'pieces'}`}
          </button>
        )}
      </div>
    </div>
  );
}
