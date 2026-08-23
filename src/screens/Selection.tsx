import { useStore } from '../store';
import { Img } from '../components/Img';
import { money } from '../lib/image';

export function Selection() {
  const { s, products, go, removeSaved, checkout } = useStore();
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
                <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>Size {row.size} · {money(row.price)}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, fontWeight: 600, color: stock > 0 ? 'var(--color-accent-2-800)' : 'var(--color-accent-700)' }}>
                  {stock <= 0 ? 'Out of stock' : stock > 2 ? 'In stock' : `Only ${stock} left`}
                </p>
              </div>
              <button type="button" className="btn btn--ghost" style={{ color: 'var(--color-neutral-700)' }} onClick={() => removeSaved(row.key)}>
                Remove
              </button>
            </div>
          );
        })}
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
  const { s, finish, deletePhoto, resetSelection, go } = useStore();
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

      {/* The customer decides what happens to her photo — the tablet does not
          decide for her. Keeping it lets her carry on trying pieces on with the
          same photo; deleting it takes it off the tablet there and then. */}
      <div className="stack" style={{ gap: 10 }}>
        {s.photoDeleted ? (
          <p className="notice center" style={{ margin: 0 }}>
            Your photo and try-ons have been deleted from this tablet. Your code above still works.
          </p>
        ) : (
          <>
            <p className="tiny muted center" style={{ margin: 0 }}>
              Your photo is still on this tablet so you can try more pieces on. Delete it whenever you like.
            </p>
            <div className="hstack" style={{ gap: 10 }}>
              <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={() => void deletePhoto()}>
                Delete my photo
              </button>
              <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={() => go('collection')}>
                Try more pieces
              </button>
            </div>
          </>
        )}

        <button type="button" className="btn btn--ghost btn--block" onClick={resetSelection}>
          Start a new selection — keep my photo
        </button>
        <button type="button" className="btn btn--outline btn--block" onClick={() => void finish()}>
          Finish — next customer
        </button>
        <p className="tiny muted center" style={{ margin: 0 }}>
          Finishing deletes the photo and clears the tablet for the next person.
        </p>
      </div>
    </div>
  );
}
