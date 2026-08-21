import { useStore } from '../store';
import { Img } from '../components/Img';
import { money } from '../lib/image';

export function Selection() {
  const { s, go, removeSaved, checkout } = useStore();
  const total = s.saved.reduce((a, r) => a + r.price, 0);
  const countText = s.saved.length === 1 ? '1 piece' : `${s.saved.length} pieces`;

  if (s.saved.length === 0) {
    return (
      <div className="page">
        <h1 className="h-lg">My selection</h1>
        <div className="stack center" style={{ alignItems: 'center', gap: 16, padding: '44px 16px' }}>
          <div aria-hidden="true" style={{ width: 84, height: 84, borderRadius: 999, background: 'var(--color-accent-2-200)' }} />
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 280 }}>
            Nothing saved yet. Try a few pieces on and keep the ones you like here.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => go('collection')}>Browse the collection</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="h-lg">My selection</h1>

      <div className="stack" style={{ gap: 12 }}>
        {s.saved.map((row) => (
          <div key={row.key} className="row">
            <div className="row__thumb">
              <Img imageKey={row.resultKey ?? row.imageKey} alt={row.name} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{row.name}</p>
              <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>Size {row.size} · {money(row.price)}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent-2-800)' }}>
                {row.stock > 2 ? 'In stock' : `Only ${row.stock} left`}
              </p>
            </div>
            <button type="button" className="btn btn--ghost" style={{ color: 'var(--color-neutral-700)' }} onClick={() => removeSaved(row.key)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="between" style={{ alignItems: 'baseline', padding: '0 4px' }}>
        <span className="muted" style={{ fontSize: 14 }}>{countText}</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 22 }}>{money(total)}</span>
      </div>

      <button type="button" className="btn btn--primary btn--block" onClick={() => void checkout()}>Show shop staff</button>
      <p className="tiny muted center" style={{ margin: 0, padding: '0 12px' }}>
        Staff will bring only these pieces to the trial room.
      </p>
    </div>
  );
}

export function Staff() {
  const { s, finish } = useStore();
  const total = s.saved.reduce((a, r) => a + r.price, 0);
  const countText = s.saved.length === 1 ? '1 piece' : `${s.saved.length} pieces`;

  return (
    <div className="page">
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, lineHeight: 1.14 }}>Show this to any staff member</h1>

      <div
        style={{
          background: 'var(--color-accent-2-500)', borderRadius: 28, padding: '30px 24px',
          textAlign: 'center', color: '#fbfdf5', boxShadow: 'var(--shadow-md)',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .85 }}>
          Pickup code
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
            <span className="muted" style={{ fontSize: 13 }}>Size {row.size}</span>
          </div>
        ))}
      </div>

      <p className="tiny muted center" style={{ margin: 0 }}>
        Your photo and try-ons are wiped when you tap Finish.
      </p>
      <button type="button" className="btn btn--outline btn--block" onClick={() => void finish()}>Finish and clear</button>
    </div>
  );
}
