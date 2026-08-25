import { useState } from 'react';
import { useStore } from '../store';
import { Media } from '../components/Img';
import { getImage } from '../lib/db';
import { money } from '../lib/image';
import { useT } from '../lib/i18n';

export function Result() {
  const { s, settings, product, products, go, setCompare, saveCurrent, startTryOn } = useStore();
  const t = useT();
  const alsoTry = products.filter((p) => p.id !== s.productId).slice(0, 6);
  const [shareNote, setShareNote] = useState<string>();

  /** Sending the try-on to WhatsApp takes the photo off the tablet, so it only
   *  ever happens on the customer's own deliberate tap. */
  const share = async () => {
    setShareNote(undefined);
    if (!s.resultKey) return;
    try {
      const blob = await getImage(s.resultKey);
      if (!blob) { setShareNote(t('result.shareGone')); return; }

      const file = new File([blob], `${product?.name ?? 'try-on'}.jpg`, { type: blob.type || 'image/jpeg' });
      const text = product
        ? `${product.name}, ${t('common.size')} ${s.size} — ${money(product.price)} · ${settings.shopName}`
        : settings.shopName;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      // Older browsers can still pass the message along; the picture cannot go.
      if (navigator.share) {
        await navigator.share({ text });
        setShareNote(t('result.shareTextOnly'));
        return;
      }
      setShareNote(t('result.shareNone'));
    } catch (err) {
      // A cancelled share picker is not an error worth showing.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setShareNote(t('result.shareFailed'));
    }
  };

  return (
    <div className="page">
      <div className="seg">
        <button type="button" aria-pressed={s.compare === 'before'} onClick={() => setCompare('before')}>{t('result.before')}</button>
        <button type="button" aria-pressed={s.compare === 'after'} onClick={() => setCompare('after')}>{t('result.after')}</button>
      </div>

      <div className="split">
        <div className="stack">
          <Media
            imageKey={s.compare === 'after' ? s.resultKey : s.personKey}
            label={s.compare === 'after' ? t('result.after') : t('result.before')}
          />
          {s.compare === 'after' && s.resultSimulated && (
            <p className="notice">{t('result.demoNotice')}</p>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 21, lineHeight: 1.2 }}>{product?.name}</p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
              {t('common.size')} {s.size} · {product ? money(product.price) : ''}
            </p>
          </div>

          <div className="stack">
            <button type="button" className="btn btn--primary btn--block" onClick={saveCurrent}>{t('result.save')}</button>
            {s.resultKey && (
              <button type="button" className="btn btn--outline btn--block" onClick={() => void share()}>
                {t('result.share')}
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--block" onClick={() => go('collection')}>{t('result.browse')}</button>
          </div>

          {shareNote && <p className="tiny muted" style={{ margin: 0 }}>{shareNote}</p>}
          {s.resultKey && !shareNote && (
            <p className="tiny muted" style={{ margin: 0 }}>{t('result.sharePrivacy')}</p>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 12, paddingTop: 6 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
          {t('result.next')}
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
              <Media imageKey={p.thumbKey ?? p.imageKey} label={p.name} className="media media--3x4 media--r22" />
              <span className="tile__name" style={{ fontSize: 12.5 }}>{p.name}</span>
              <span className="tile__meta" style={{ fontSize: 12 }}>{money(p.price)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
