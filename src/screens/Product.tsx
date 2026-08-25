import { useStore } from '../store';
import { Media } from '../components/Img';
import { money } from '../lib/image';
import { useT } from '../lib/i18n';

export function Product() {
  const { s, product, back, setSize, startTryOn, saveCurrent } = useStore();
  const t = useT();

  if (!product) {
    return (
      <div className="page">
        <button type="button" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={back}>
          {t('common.backToCollection')}
        </button>
        <p className="notice">{t('product.gone')}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <button type="button" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={back}>
        {t('common.backToCollection')}
      </button>

      <div className="split">
        <Media imageKey={product.imageKey} label={product.name} />

        <div className="stack" style={{ gap: 18 }}>
          {/* Errors thrown inside the app are translation keys; anything from
              Google arrives as its own English sentence and falls through. */}
          {s.error && <p className="error">{t(s.error)}</p>}

          <div className="stack" style={{ gap: 6 }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1.15 }}>{product.name}</h1>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 600, color: 'var(--color-accent-700)' }}>{money(product.price)}</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
              {t(`cat.${product.cat}`)} · {product.color} · {t('product.stock', { n: product.stock })}
            </p>
          </div>

          <div className="stack">
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
              {t('common.size')}
            </p>
            <div className="hstack" style={{ flexWrap: 'wrap', gap: 8 }}>
              {product.sizes.map((z) => (
                <button
                  key={z}
                  type="button"
                  className="chip"
                  aria-pressed={s.size === z}
                  style={{ minWidth: 56, minHeight: 48 }}
                  onClick={() => setSize(z)}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          <div className="stack">
            <button type="button" className="btn btn--primary btn--block" onClick={() => void startTryOn(product.id)}>
              {s.personKey ? t('product.tryOn') : t('product.needPhoto')}
            </button>
            <button type="button" className="btn btn--outline btn--block" onClick={saveCurrent}>
              {t('product.addToSelection')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
