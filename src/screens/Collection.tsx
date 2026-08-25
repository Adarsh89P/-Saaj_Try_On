import { useMemo } from 'react';
import { useStore } from '../store';
import { Media } from '../components/Img';
import { money } from '../lib/image';
import { useT } from '../lib/i18n';
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

      <input
        className="input"
        type="search"
        value={s.query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('collection.search')}
        aria-label={t('collection.searchLabel')}
      />

      <div className="chiprow">
        {['All', ...CATEGORIES].map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={s.cat === c} onClick={() => setCat(c)}>
            {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      <div className="grid2">
        {shown.map((p) => (
          <button key={p.id} type="button" className="tile" onClick={() => openProduct(p.id)}>
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
