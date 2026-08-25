import { useState } from 'react';
import { useStore } from '../store';
import { Media } from '../components/Img';
import { getImage } from '../lib/db';
import { money } from '../lib/image';

export function Result() {
  const { s, settings, product, products, go, setCompare, saveCurrent, startTryOn } = useStore();
  const alsoTry = products.filter((p) => p.id !== s.productId).slice(0, 6);
  const [shareNote, setShareNote] = useState<string>();

  /** Sending the try-on to WhatsApp takes the photo off the tablet, so it only
   *  ever happens on the customer's own deliberate tap. */
  const share = async () => {
    setShareNote(undefined);
    if (!s.resultKey) return;
    try {
      const blob = await getImage(s.resultKey);
      if (!blob) { setShareNote('That try-on is no longer available.'); return; }

      const file = new File([blob], `${product?.name ?? 'try-on'}.jpg`, { type: blob.type || 'image/jpeg' });
      const text = product
        ? `${product.name}, size ${s.size} — ${money(product.price)} at ${settings.shopName}`
        : settings.shopName;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      // Older browsers can still pass the message along; the picture cannot go.
      if (navigator.share) {
        await navigator.share({ text });
        setShareNote('Only the message could be sent from this device. Take a screenshot to send the picture.');
        return;
      }
      setShareNote('Sharing is not available on this device. Take a screenshot to send the picture.');
    } catch (err) {
      // A cancelled share picker is not an error worth showing.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setShareNote('Could not open sharing on this device. Take a screenshot instead.');
    }
  };

  return (
    <div className="page">
      <div className="seg">
        <button type="button" aria-pressed={s.compare === 'before'} onClick={() => setCompare('before')}>Your photo</button>
        <button type="button" aria-pressed={s.compare === 'after'} onClick={() => setCompare('after')}>With this on</button>
      </div>

      <div className="split">
        <div className="stack">
          <Media
            imageKey={s.compare === 'after' ? s.resultKey : s.personKey}
            label={s.compare === 'after' ? 'Try-on result' : 'Your photo'}
          />
          {s.compare === 'after' && s.resultSimulated && (
            <p className="notice">
              This is a demo preview, not a real fit — the garment photo is laid over yours so staff can test the flow.
              Switch the try-on engine in Staff → Settings for true AI try-on.
            </p>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 21, lineHeight: 1.2 }}>{product?.name}</p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
              Size {s.size} · {product ? money(product.price) : ''}
            </p>
          </div>

          <div className="stack">
            <button type="button" className="btn btn--primary btn--block" onClick={saveCurrent}>Save to my selection</button>
            {s.resultKey && (
              <button type="button" className="btn btn--outline btn--block" onClick={() => void share()}>
                Send to family on WhatsApp
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--block" onClick={() => go('collection')}>Browse everything</button>
          </div>

          {shareNote && <p className="tiny muted" style={{ margin: 0 }}>{shareNote}</p>}
          {s.resultKey && !shareNote && (
            <p className="tiny muted" style={{ margin: 0 }}>
              Sharing sends this picture off the tablet to whoever you choose. Nothing is sent unless you tap.
            </p>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 12, paddingTop: 6 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
          Try the next one on
        </p>
        <div className="chiprow" style={{ gap: 12 }}>
          {alsoTry.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tile"
              style={{ flex: 'none', width: 96 }}
              onClick={() => void startTryOn(p.id)}
            >
              <Media imageKey={p.imageKey} label={p.name} className="media media--3x4 media--r22" />
              <span className="tile__name" style={{ fontSize: 12.5 }}>{p.name}</span>
              <span className="tile__meta" style={{ fontSize: 12 }}>{money(p.price)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
