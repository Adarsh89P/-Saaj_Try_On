import { useStore } from '../store';
import { Img } from '../components/Img';
import { money } from '../lib/image';
import { useT } from '../lib/i18n';
import { HangerIcon } from '../components/Icon';
import { haptic } from '../lib/haptics';

export function Selection() {
  const { s, products, go, removeSaved, checkout } = useStore();
  const t = useT();
  const total = s.saved.reduce((a, r) => a + r.price, 0);
  const countText = s.saved.length === 1 ? t('common.pieceOne') : t('common.pieceMany', { n: s.saved.length });

  if (s.saved.length === 0) {
    return (
      <div className="page">
        <h1 className="h-lg">{t('selection.title')}</h1>
        <div className="empty">
          <HangerIcon className="icon empty__art" />
          <p className="empty__text">{t('selection.empty')}</p>
          <button type="button" className="btn btn--primary" onClick={() => { haptic('select'); go('collection'); }}>
            {t('selection.browse')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="h-lg">{t('selection.title')}</h1>

      <div className="list">
        {s.saved.map((row) => {
          // Stock is read from the catalogue, not the snapshot taken when the
          // piece was saved, so a staff edit shows up here straight away.
          const live = products.find((p) => p.id === row.productId);
          const stock = live?.stock ?? row.stock;
          return (
            <div key={row.key} className="row">
              <div className="row__thumb">
                <Img imageKey={row.resultKey ?? row.thumbKey ?? row.imageKey} alt={row.name} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 600, lineHeight: 1.3 }}>{row.name}</p>
                <p className="muted" style={{ margin: '3px 0 0', fontSize: 'var(--text-sm)' }}>
                  {t('common.size')} {row.size} · {money(row.price)}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', fontWeight: 600, color: stock > 0 ? 'var(--color-accent-2-800)' : 'var(--color-accent-700)' }}>
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
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{countText}</span>
        <span className="money" style={{ fontSize: 'var(--text-xl)' }}>{money(total)}</span>
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
      <h1 className="h-lg">{t('code.title')}</h1>

      <div className="panel panel--code">
        <p className="panel__label">{t('code.label')}</p>
        <p className="panel__code">{s.code}</p>
        <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)' }}>{countText} · {money(total)}</p>
      </div>

      <div className="stack">
        {s.saved.map((row) => (
          <div key={row.key} className="between" style={{ padding: '14px 4px', borderBottom: '1px solid var(--color-divider)' }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{row.name}</span>
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{t('common.size')} {row.size}</span>
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
