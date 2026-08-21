import { useStore } from '../store';
import { Media } from '../components/Img';
import { money } from '../lib/image';

export function Product() {
  const { s, product, back, setSize, startTryOn, saveCurrent } = useStore();

  if (!product) {
    return (
      <div className="page">
        <button type="button" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={back}>← Collection</button>
        <p className="notice">That piece is no longer in the catalogue.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <button type="button" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={back}>
        ← Collection
      </button>

      <div className="split">
        <Media imageKey={product.imageKey} label={product.name} />

        <div className="stack" style={{ gap: 18 }}>
          {s.error && <p className="error">{s.error}</p>}

          <div className="stack" style={{ gap: 6 }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1.15 }}>{product.name}</h1>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 600, color: 'var(--color-accent-700)' }}>{money(product.price)}</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
              {product.cat} · {product.color} · {product.stock} in stock
            </p>
          </div>

          <div className="stack">
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
              Size
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
              {s.personKey ? 'Try it on' : 'Take a photo to try it on'}
            </button>
            <button type="button" className="btn btn--outline btn--block" onClick={saveCurrent}>
              Add to my selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
