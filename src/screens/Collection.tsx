import { useMemo } from 'react';
import { useStore } from '../store';
import { Media } from '../components/Img';
import { money } from '../lib/image';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/haptics';
import { CloseIcon } from '../components/Icon';
import { CATEGORIES } from '../lib/types';

export function Collection() {
  const { s, products, setCat, setQuery, openProduct } = useStore();
  const t = useT();

  const shown = useMemo(() => {
    const q = s.query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (s.cat === 'All' || p.cat === s.cat) &&
        (!q || `${p.name} ${p.color} ${p.cat}`.toLowerCase().includes(q)),
    );
  }, [products, s.cat, s.query]);

  return (
    <div className="page">
      <h1 className="h-lg">{t('collection.title')}</h1>

      <div className="searchwrap">
        <input
          className="input"
          type="search"
          value={s.query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('collection.search')}
          aria-label={t('collection.searchLabel')}
        />
        {s.query && (
          <button
            type="button"
            className="searchwrap__clear"
            aria-label={t('collection.clear')}
            onClick={() => { haptic('tap'); setQuery(''); }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="chiprow">
        {['All', ...CATEGORIES].map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={s.cat === c} onClick={() => { haptic('select'); setCat(c); }}>
            {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      {/* Filtering silently changes what is on screen; saying how many pieces
          are left is what tells the customer the tap did anything. */}
      {shown.length > 0 && (s.query.trim() !== '' || s.cat !== 'All') && (
        <p className="tiny muted" style={{ margin: 0, paddingLeft: 6 }}>
          {shown.length === 1 ? t('common.pieceOne') : t('common.pieceMany', { n: shown.length })}
        </p>
      )}

      <div className="grid2">
        {shown.map((p) => (
          <button key={p.id} type="button" className="tile" onClick={() => { haptic('tap'); openProduct(p.id); }}>
            <Media imageKey={p.thumbKey ?? p.imageKey} label={p.name} className="media media--3x4 media--r22" />
            <span className="tile__name">{p.name}</span>
            <span className="tile__meta">{money(p.price)} · {p.sizes.join(' · ')}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="notice center">{t('collection.empty')}</p>}
    </div>
  );
}
