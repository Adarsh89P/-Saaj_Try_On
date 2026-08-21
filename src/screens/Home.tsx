import { useStore } from '../store';
import { Media, Img } from '../components/Img';
import { money } from '../lib/image';
import { CATEGORIES } from '../lib/types';

export function Home() {
  const { s, settings, products, go, openProduct, setCat } = useStore();
  const featured = [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div className="page">
      <div className="between">
        <p className="kicker">{settings.shopName}</p>
        <a className="btn btn--ghost" href="#/admin">Staff</a>
      </div>

      <h1 className="h-xl">See yourself in our collection</h1>

      {s.personKey ? (
        <div className="row" style={{ background: 'var(--color-accent-2-200)', borderRadius: 28, padding: '16px 18px' }}>
          <div className="row__thumb" style={{ width: 52, height: 64, borderRadius: 14 }}>
            <Img imageKey={s.personKey} alt="Your photo" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Your photo is ready</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-accent-2-800)' }}>Pick anything below to try it on</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => go('photo')}>Retake</button>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--color-accent-500)', borderRadius: 28, padding: '24px 22px 22px',
            display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-md)',
          }}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: '#fff8f1', maxWidth: 320 }}>
            Take one full-body photo and try on anything in the shop without leaving your seat.
          </p>
          <button
            type="button"
            className="btn"
            style={{ background: '#fffaf4', color: 'var(--color-accent-800)', boxShadow: 'var(--shadow-sm)', alignSelf: 'flex-start' }}
            onClick={() => go('photo')}
          >
            Take your photo
          </button>
        </div>
      )}

      <div className="chiprow">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={s.cat === c}
            onClick={() => { setCat(c); go('collection'); }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="between" style={{ alignItems: 'baseline' }}>
        <h2 className="h-md">New this week</h2>
        <button type="button" className="btn btn--ghost" onClick={() => go('collection')}>See all</button>
      </div>

      <div className="grid2">
        {featured.map((p) => (
          <button key={p.id} type="button" className="tile" onClick={() => openProduct(p.id)}>
            <Media imageKey={p.imageKey} label={p.name} className="media media--3x4 media--r22" />
            <span className="tile__name">{p.name}</span>
            <span className="tile__meta">{money(p.price)} · {p.sizes.join(' · ')}</span>
          </button>
        ))}
      </div>

      {products.length === 0 && (
        <p className="notice">
          The catalogue is empty. A staff member can add pieces from the Staff area.
        </p>
      )}
    </div>
  );
}
