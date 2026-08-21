import { useStore } from '../store';
import { Media } from '../components/Img';
import { money } from '../lib/image';

export function Result() {
  const { s, product, products, go, setCompare, saveCurrent, startTryOn } = useStore();
  const alsoTry = products.filter((p) => p.id !== s.productId).slice(0, 6);

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
            <button type="button" className="btn btn--outline btn--block" onClick={() => go('collection')}>Browse everything</button>
          </div>
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
