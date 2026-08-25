import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { Img } from '../components/Img';
import { money } from '../lib/image';
import { PROVIDERS } from '../lib/tryon';
import { ProductForm } from './ProductForm';
import { BulkAdd } from './BulkAdd';
import { loadUsage, type Usage } from '../lib/db';
import { LANGUAGES } from '../lib/i18n';
import type { Lang, Product } from '../lib/types';

type Tab = 'catalogue' | 'pickups' | 'settings';

export function Admin({ onExit }: { onExit: () => void }) {
  const { settings } = useStore();
  const [unlocked, setUnlocked] = useState(!settings.adminPin);
  const [tab, setTab] = useState<Tab>('catalogue');

  if (!unlocked) return <PinGate pin={settings.adminPin} onUnlock={() => setUnlocked(true)} onExit={onExit} />;

  return (
    <>
      <div className="scroll">
        <div className="page">
          <div className="between">
            <h1 className="h-lg">Staff area</h1>
            <button type="button" className="btn btn--ghost" onClick={onExit}>Back to kiosk</button>
          </div>

          <div className="seg">
            <button type="button" aria-pressed={tab === 'catalogue'} onClick={() => setTab('catalogue')}>Catalogue</button>
            <button type="button" aria-pressed={tab === 'pickups'} onClick={() => setTab('pickups')}>Pickups</button>
            <button type="button" aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>
          </div>

          {tab === 'catalogue' && <Catalogue />}
          {tab === 'pickups' && <Pickups />}
          {tab === 'settings' && <SettingsPane />}
        </div>
      </div>
    </>
  );
}

function PinGate({ pin, onUnlock, onExit }: { pin: string; onUnlock: () => void; onExit: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === pin) onUnlock();
    else { setWrong(true); setValue(''); }
  };

  return (
    <div className="scroll">
      <form className="page" onSubmit={submit} style={{ maxWidth: 420 }}>
        <h1 className="h-lg">Staff area</h1>
        <p className="muted" style={{ margin: 0 }}>Enter the staff PIN to manage the catalogue and pickups.</p>
        {wrong && <p className="error">That PIN did not match. Try again.</p>}
        <div className="field">
          <label htmlFor="pin">PIN</label>
          <input
            id="pin" className="input" type="password" inputMode="numeric" autoComplete="off"
            value={value} onChange={(e) => { setValue(e.target.value); setWrong(false); }}
          />
        </div>
        <button type="submit" className="btn btn--primary btn--block">Unlock</button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>Back to kiosk</button>
      </form>
    </div>
  );
}

function Catalogue() {
  const { products } = useStore();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);
  const sorted = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const missingPhotos = products.filter((p) => !p.imageKey).length;

  return (
    <>
      <div className="between">
        <p className="muted" style={{ margin: 0 }}>{products.length} pieces in the catalogue</p>
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setBulk(true)}>Add several</button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>Add a piece</button>
        </div>
      </div>

      <div className="tablewrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Photo</th>
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col"><span className="tiny">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.imageKey
                    ? <Img imageKey={p.imageKey} alt="" className="admin-thumb" />
                    : <span className="admin-thumb" aria-label="No photo" />}
                </td>
                <td>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className="tiny muted" style={{ display: 'block' }}>{p.color} · {p.sizes.join(', ')}</span>
                </td>
                <td>{p.cat}</td>
                <td>{money(p.price)}</td>
                <td>{p.stock}</td>
                <td>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => setEditing(p)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && <p className="notice">No pieces yet. Add the first one to get the kiosk running.</p>}
      {missingPhotos > 0 && (
        <p className="notice">
          {missingPhotos === 1 ? '1 piece has' : `${missingPhotos} pieces have`} no photo yet. Those can be
          browsed and reserved, but the AI try-on needs a garment photo to work from.
        </p>
      )}

      {editing && (
        <ProductForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {bulk && <BulkAdd onClose={() => setBulk(false)} />}
    </>
  );
}

function Pickups() {
  const { orders, markCollected, clearOrders } = useStore();
  const [query, setQuery] = useState('');
  const shown = orders.filter((o) => !query.trim() || o.code.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <input
        className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a pickup code…" aria-label="Search pickup codes"
      />

      {shown.length === 0 && <p className="notice">No pickups yet. A code appears here the moment a customer taps &ldquo;Show shop staff&rdquo;.</p>}

      <div className="stack" style={{ gap: 12 }}>
        {shown.map((o) => (
          <div key={o.code} className="stack" style={{ background: 'var(--color-neutral-200)', borderRadius: 22, padding: 16, gap: 10 }}>
            <div className="between">
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 28, letterSpacing: '.06em' }}>{o.code}</span>
              <span className={o.status === 'waiting' ? 'badge badge--warn' : 'badge'}>
                {o.status === 'waiting' ? 'Waiting' : 'Collected'}
              </span>
            </div>
            <div className="stack" style={{ gap: 4 }}>
              {o.items.map((it, i) => (
                <div key={`${o.code}-${i}`} className="between">
                  <span style={{ fontSize: 14 }}>{it.name}</span>
                  <span className="tiny muted">Size {it.size} · {money(it.price)}</span>
                </div>
              ))}
            </div>
            <div className="between">
              <span className="tiny muted">{new Date(o.createdAt).toLocaleString('en-IN')}</span>
              <span style={{ fontWeight: 600 }}>{money(o.total)}</span>
            </div>
            {o.status === 'waiting' && (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void markCollected(o.code)}>
                Mark collected
              </button>
            )}
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => { if (confirm('Clear the whole pickup history?')) void clearOrders(); }}
        >
          Clear pickup history
        </button>
      )}
    </>
  );
}

function SettingsPane() {
  const { settings, updateSettings } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [usage, setUsage] = useState<Usage>();

  useEffect(() => { void loadUsage().then(setUsage); }, []);

  return (
    <>
      <div className="field">
        <label htmlFor="shop">Shop name</label>
        <input id="shop" className="input" value={settings.shopName} onChange={(e) => void updateSettings({ shopName: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor="lang">Customer language</label>
        <select
          id="lang" className="select" value={settings.language}
          onChange={(e) => void updateSettings({ language: e.target.value as Lang })}
        >
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <p className="tiny muted" style={{ margin: '4px 0 0', paddingLeft: 6 }}>
          Changes the screens the customer sees. This Staff area always stays in English.
        </p>
      </div>

      <div className="field">
        <label htmlFor="engine">Try-on engine</label>
        <select
          id="engine" className="select" value={settings.provider}
          onChange={(e) => void updateSettings({ provider: e.target.value as typeof settings.provider })}
        >
          {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <p className="tiny muted" style={{ margin: '4px 0 0', paddingLeft: 6 }}>
          {PROVIDERS.find((p) => p.id === settings.provider)?.note}
        </p>
      </div>

      {settings.provider === 'demo' && (
        <div className="field">
          <label htmlFor="secs">Demo render time — {settings.demoSeconds.toFixed(1)}s</label>
          <input
            id="secs" type="range" min={1} max={8} step={0.2} value={settings.demoSeconds}
            onChange={(e) => void updateSettings({ demoSeconds: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-accent-500)' }}
          />
        </div>
      )}

      {settings.provider === 'gemini' && (
        <>
          <div className="field">
            <label htmlFor="key">Gemini API key</label>
            <input
              id="key" className="input" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false}
              value={settings.geminiKey} onChange={(e) => void updateSettings({ geminiKey: e.target.value.trim() })}
              placeholder="AIza…"
            />
            <button type="button" className="btn btn--ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Hide key' : 'Show key'}
            </button>
          </div>
          <div className="hstack" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="model">Image model</label>
              <input id="model" className="input" value={settings.geminiModel} onChange={(e) => void updateSettings({ geminiModel: e.target.value.trim() })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="tmodel">Photo-reading model</label>
              <input id="tmodel" className="input" value={settings.geminiTextModel} onChange={(e) => void updateSettings({ geminiTextModel: e.target.value.trim() })} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="cap">Daily request limit</label>
            <input
              id="cap" className="input" type="number" inputMode="numeric" min={0}
              value={settings.dailyRequestLimit}
              onChange={(e) => void updateSettings({ dailyRequestLimit: Math.max(0, Math.round(Number(e.target.value))) })}
            />
            <p className="tiny muted" style={{ margin: '4px 0 0', paddingLeft: 6 }}>
              Every try-on, background removal and photo reading counts as one billed request.
              {' '}<strong>{usage?.count ?? 0} used today.</strong>
              {settings.dailyRequestLimit > 0
                ? ` The kiosk stops asking Google once it reaches ${settings.dailyRequestLimit} and says so.`
                : ' Set to 0, so there is no ceiling — a busy day can run up a bill.'}
            </p>
          </div>
          <label className="hstack" style={{ gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={settings.cleanGarmentPhotos}
              onChange={(e) => void updateSettings({ cleanGarmentPhotos: e.target.checked })}
              style={{ width: 22, height: 22, accentColor: 'var(--color-accent-500)' }}
            />
            <span style={{ fontSize: 14 }}>Remove the background from new catalogue photos</span>
          </label>
          <p className="tiny muted" style={{ margin: '-4px 0 0', paddingLeft: 32 }}>
            Cuts the piece out of the shop background as it is added, which makes every try-on of it
            better. One extra billed request per photo, and you can keep the original if the cutout is
            wrong.
          </p>

          <p className="notice">
            The key is stored on this tablet only and is sent straight to Google with each try-on. Anyone who
            can reach this Staff area can read it, so use a key restricted to this shop&rsquo;s billing and rotate
            it if the tablet is ever lost.
          </p>
        </>
      )}

      <div className="field">
        <label htmlFor="pin-set">Staff PIN</label>
        <input
          id="pin-set" className="input" inputMode="numeric" value={settings.adminPin}
          onChange={(e) => void updateSettings({ adminPin: e.target.value.trim() })}
        />
        <p className="tiny muted" style={{ margin: '4px 0 0', paddingLeft: 6 }}>Leave empty to open the Staff area without a PIN.</p>
      </div>

      <label className="hstack" style={{ gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox" checked={settings.privacyNotice}
          onChange={(e) => void updateSettings({ privacyNotice: e.target.checked })}
          style={{ width: 22, height: 22, accentColor: 'var(--color-accent-500)' }}
        />
        <span style={{ fontSize: 14 }}>Show the privacy note on the photo screen</span>
      </label>
    </>
  );
}
