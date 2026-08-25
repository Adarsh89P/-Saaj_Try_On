import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { Home } from './screens/Home';
import { Collection } from './screens/Collection';
import { Photo, PhotoPreview } from './screens/Photo';
import { Product } from './screens/Product';
import { Processing } from './screens/Processing';
import { Result } from './screens/Result';
import { Selection, Staff } from './screens/Selection';
import { Admin } from './admin/Admin';
import { useT } from './lib/i18n';
import './styles/app.css';

const NAV = ['home', 'collection', 'selection'] as const;

function Kiosk() {
  const { ready, s, go } = useStore();
  const t = useT();

  if (!ready) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100%' }}>
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  const showNav = s.screen === 'home' || s.screen === 'collection' || s.screen === 'selection';

  return (
    <>
      <div className="scroll" key={s.screen}>
        {s.screen === 'home' && <Home />}
        {s.screen === 'collection' && <Collection />}
        {s.screen === 'photo' && <Photo />}
        {s.screen === 'preview' && <PhotoPreview />}
        {s.screen === 'product' && <Product />}
        {s.screen === 'processing' && <Processing />}
        {s.screen === 'result' && <Result />}
        {s.screen === 'selection' && <Selection />}
        {s.screen === 'staff' && <Staff />}
      </div>

      {showNav && (
        <nav className="nav" aria-label="Main">
          {NAV.map((key) => (
            <button
              key={key}
              type="button"
              aria-current={s.screen === key ? 'page' : undefined}
              onClick={() => go(key)}
            >
              {key === 'selection' && s.saved.length > 0
                ? t('nav.selectionCount', { n: s.saved.length })
                : t(`nav.${key}`)}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}

/** Two surfaces on one install: the customer kiosk, and #/admin for staff. */
function Shell() {
  const [route, setRoute] = useState(() => window.location.hash);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const isAdmin = route.startsWith('#/admin');

  return (
    <div className="app">
      {isAdmin ? <Admin onExit={() => { window.location.hash = ''; }} /> : <Kiosk />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
