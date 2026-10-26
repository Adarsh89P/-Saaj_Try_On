import { useStore } from '../store';
import { Media, Img } from '../components/Img';
import { money } from '../lib/image';
import { useT } from '../lib/i18n';
import { CATEGORIES } from '../lib/types';
import { haptic } from '../lib/haptics';
import { CameraIcon } from '../components/Icon';

export function Home() {
  const { s, settings, products, go, openProduct, setCat } = useStore();
  const t = useT();
  const featured = [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div className="page">
      <div className="between">
        <p className="kicker">{settings.shopName}</p>
        <a className="btn btn--ghost" href="#/admin">{t('common.staff')}</a>
      </div>

      <h1 className="h-xl">{t('home.title')}</h1>

      {s.personKey ? (
        <div className="row" style={{ background: 'var(--color-card)', borderRadius: 'var(--radius-xl)', padding: '14px 16px', boxShadow: 'var(--shadow-md), 0 0 0 1.5px var(--color-accent-2-300)' }}>
          <div className="row__thumb" style={{ width: 52, height: 64, borderRadius: 14 }}>
            <Img imageKey={s.personKey} alt={t('photo.yourPhoto')} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 }}>{t('home.photoReady')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-neutral-700)' }}>{t('home.photoReadyHint')}</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => go('photo')}>{t('home.retake')}</button>
        </div>
      ) : (
        <div className="panel panel--invite">
          <div className="stack" style={{ gap: 18 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-lg)', lineHeight: 1.45, maxWidth: '30ch', color: '#fff3e2' }}>
              {t('home.intro')}
            </p>
            <button type="button" className="panel__cta" onClick={() => { haptic('select'); go('photo'); }}>
              <CameraIcon size={22} />
              {t('home.takePhoto')}
            </button>
          </div>
          {/* A glimpse of the stock, so the invitation shows what it is for. */}
          {featured.length >= 3 && (
            <div className="fan" aria-hidden="true">
              {featured.slice(0, 3).map((p) => (
                <div key={p.id}><Media imageKey={p.thumbKey ?? p.imageKey} label="" className="media" /></div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chiprow">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={s.cat === c}
            onClick={() => { haptic('select'); setCat(c); go('collection'); }}
          >
            {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      <div className="between" style={{ alignItems: 'baseline' }}>
        <h2 className="h-md">{t('home.newThisWeek')}</h2>
        <button type="button" className="btn btn--ghost" onClick={() => go('collection')}>{t('home.seeAll')}</button>
      </div>

      <div className="grid2">
        {featured.map((p) => (
          <button key={p.id} type="button" className="tile" onClick={() => { haptic('tap'); openProduct(p.id); }}>
            <Media imageKey={p.thumbKey ?? p.imageKey} label={p.name} className="media media--3x4 media--r22" />
            <span className="tile__name">{p.name}</span>
            <span className="tile__meta">{money(p.price)} · {p.sizes.join(' · ')}</span>
          </button>
        ))}
      </div>

      {products.length === 0 && <p className="notice">{t('home.emptyCatalogue')}</p>}
    </div>
  );
}
