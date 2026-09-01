import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore, type Screen } from './store';
import { Home } from './screens/Home';
import { Collection } from './screens/Collection';
import { Photo, PhotoPreview } from './screens/Photo';
import { Product } from './screens/Product';
import { Processing } from './screens/Processing';
import { Result } from './screens/Result';
import { Selection, Staff } from './screens/Selection';
import { Admin } from './admin/Admin';
import { ToastHost } from './components/Toast';
import { HomeSkeleton } from './components/Skeleton';
import { haptic } from './lib/haptics';
import { useT } from './lib/i18n';
import './styles/app.css';

const NAV = ['home', 'collection', 'selection'] as const;

/** How deep into the flow each screen sits. A screen that is deeper than the
 *  one before it slides in from the right and a shallower one from the left,
 *  so the animation says "further in" or "back out" rather than just "changed".
 */
const DEPTH: Record<Screen, number> = {
  home: 0, collection: 1, photo: 1, preview: 2,
  product: 2, processing: 3, result: 4, selection: 5, staff: 6,
};

function Kiosk() {
  const { ready, s, go } = useStore();
  const t = useT();

  // Read during render and committed after, so the class for this render is
  // decided against the screen we are actually coming from.
  const lastDepth = useRef(DEPTH[s.screen]);
  const depth = DEPTH[s.screen];
  const dir = depth < lastDepth.current ? 'back' : 'fwd';
  useEffect(() => { lastDepth.current = depth; }, [depth]);

  // The tap that saves a piece happens on another screen, so the count in the
  // nav has to draw attention to itself when it changes.
  const saved = s.saved.length;
  const [bump, setBump] = useState(false);
  const lastSaved = useRef(saved);
  useEffect(() => {
    if (saved === lastSaved.current) return;
    lastSaved.current = saved;
    setBump(true);
    const timer = window.setTimeout(() => setBump(false), 450);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (!ready) return <HomeSkeleton />;

  const showNav = s.screen === 'home' || s.screen === 'collection' || s.screen === 'selection';

  return (
    <>
      <div className={`scroll screen screen--${dir}`} key={s.screen}>
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
              className={key === 'selection' && bump ? 'is-bumped' : undefined}
              aria-current={s.screen === key ? 'page' : undefined}
              onClick={() => { haptic('select'); go(key); }}
            >
              {key === 'selection' && s.saved.length > 0
                ? t('nav.selectionCount', { n: s.saved.length })
                : t(`nav.${key}`)}
            </button>
          ))}
        </nav>
      )}

      <ToastHost liftedOverNav={showNav} />
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
