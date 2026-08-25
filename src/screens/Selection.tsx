import { useStore } from '../store';
import { Img } from '../components/Img';
import { money } from '../lib/image';
import { useT } from '../lib/i18n';

export function Selection() {
  const { s, products, go, removeSaved, checkout } = useStore();
  const t = useT();
  const total = s.saved.reduce((a, r) => a + r.price, 0);
  const countText = s.saved.length === 1 ? t('common.pieceOne') : t('common.pieceMany', { n: s.saved.length });

  if (s.saved.length === 0) {
    return (
      <div className="page">
        <h1 className="h-lg">{t('selection.title')}</h1>
        <div className="stack center" style={{ alignItems: 'center', gap: 16, padding: '44px 16px' }}>
          <div aria-hidden="true" style={{ width: 84, height: 84, borderRadius: 999, background: 'var(--color-accent-2-200)' }} />
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 280 }}>
            {t('selection.empty')}
          </p>
          <button type="button" className="btn btn--primary" onClick={() => go('collection')}>{t('selection.browse')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="h-lg">{t('selection.title')}</h1>

      <div className="stack" style={{ gap: 12 }}>
        {s.saved.map((row) => {
          // Stock is read from the catalogue, not the snapshot taken when the
          // piece was saved, so a staff edit shows up here straight away.
          const live = products.find((p) => p.id === row.productId);
          const stock = live?.stock ?? row.stock;
          return (
            <div key={row.key} className="row">
              <div className="row__thumb">
                <Img imageKey={row.resultKey ?? row.imageKey} alt={row.name} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{row.name}</p>
                <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                  {t('common.size')} {row.size} · {money(row.price)}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, fontWeight: 600, color: stock > 0 ? 'var(--color-accent-2-800)' : 'var(--color-accent-700)' }}>
                  {stock <= 0
                    ? t('selection.outOfStock')
                    : stock > 2
                      ? t('selection.inStock')
                      : t('selection.lowStock', { n: stock })}
                </p>
              </div>
              <button type="button" className="btn btn--ghost" style={{ color: 'var(--color-neutral-700)' }} onClick={() => removeSaved(row.key)}>
                {t('common.remove')}
              </button>
            </div>
          );
        })}
      </div>

      <div className="between" style={{ alignItems: 'baseline', padding: '0 4px' }}>
        <span className="muted" style={{ fontSize: 14 }}>{countText}</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 22 }}>{money(total)}</span>
      </div>

      <button type="button" className="btn btn--primary btn--block" onClick={() => void checkout()}>{t('selection.checkout')}</button>
      <p className="tiny muted center" style={{ margin: 0, padding: '0 12px' }}>
        {t('selection.checkoutHint')}
      </p>
    </div>
  );
}

export function Staff() {
  const { s, finish, deletePhoto, resetSelection, go } = useStore();
  const t = useT();
  const total = s.saved.reduce((a, r) => a + r.price, 0);
  const countText = s.saved.length === 1 ? t('common.pieceOne') : t('common.pieceMany', { n: s.saved.length });

  return (
    <div className="page">
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, lineHeight: 1.14 }}>{t('code.title')}</h1>

      <div
        style={{
          background: 'var(--color-accent-2-500)', borderRadius: 28, padding: '30px 24px',
          textAlign: 'center', color: '#fbfdf5', boxShadow: 'var(--shadow-md)',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .85 }}>
          {t('code.label')}
        </p>
        <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-heading)', fontSize: 56, lineHeight: 1.05, letterSpacing: '.06em' }}>
          {s.code}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 14, opacity: .92 }}>{countText} · {money(total)}</p>
      </div>

      <div className="stack">
        {s.saved.map((row) => (
          <div key={row.key} className="between" style={{ padding: '14px 16px', background: 'var(--color-neutral-200)', borderRadius: 18 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{row.name}</span>
            <span className="muted" style={{ fontSize: 13 }}>{t('common.size')} {row.size}</span>
          </div>
        ))}
      </div>

      {/* The customer decides what happens to her photo — the tablet does not
          decide for her. Keeping it lets her carry on trying pieces on with the
          same photo; deleting it takes it off the tablet there and then. */}
      <div className="stack" style={{ gap: 10 }}>
        {s.photoDeleted ? (
          <p className="notice center" style={{ margin: 0 }}>{t('code.photoDeleted')}</p>
        ) : (
          <>
            <p className="tiny muted center" style={{ margin: 0 }}>{t('code.photoHere')}</p>
            <div className="hstack" style={{ gap: 10 }}>
              <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={() => void deletePhoto()}>
                {t('code.deletePhoto')}
              </button>
              <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={() => go('collection')}>
                {t('code.tryMore')}
              </button>
            </div>
          </>
        )}

        <button type="button" className="btn btn--ghost btn--block" onClick={resetSelection}>
          {t('code.newSelection')}
        </button>
        <button type="button" className="btn btn--outline btn--block" onClick={() => void finish()}>
          {t('code.finish')}
        </button>
        <p className="tiny muted center" style={{ margin: 0 }}>{t('code.finishHint')}</p>
      </div>
    </div>
  );
}
