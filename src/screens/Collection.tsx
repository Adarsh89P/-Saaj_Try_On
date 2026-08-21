import { useMemo } from 'react';
import { useStore } from '../store';
import { Media } from '../components/Img';
import { money } from '../lib/image';
import { CATEGORIES } from '../lib/types';

export function Collection() {
  const { s, products, setCat, setQuery, openProduct } = useStore();

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
      <h1 className="h-lg">Collection</h1>

      <input
        className="input"
        type="search"
        value={s.query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search sarees, kurtis, colours…"
        aria-label="Search the collection"
      />

      <div className="chiprow">
        {['All', ...CATEGORIES].map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={s.cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid2">
        {shown.map((p) => (
          <button key={p.id} type="button" className="tile" onClick={() => openProduct(p.id)}>
            <Media imageKey={p.imageKey} label={p.name} className="media media--3x4 media--r22" />
            <span className="tile__name">{p.name}</span>
            <span className="tile__meta">{money(p.price)} · {p.sizes.join(' · ')}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="notice center">
          Nothing here yet. Try another category, or ask a staff member what&rsquo;s just come in.
        </p>
      )}
    </div>
  );
}
