import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as db from './lib/db';
import { clearImageCache } from './components/Img';
import { runTryOn } from './lib/tryon';
import { ensureCatalogue, makeCode } from './lib/seed';
import { DEFAULT_SETTINGS, type Order, type Product, type SavedItem, type Settings } from './lib/types';

export type Screen =
  | 'home' | 'photo' | 'preview' | 'collection' | 'product'
  | 'processing' | 'result' | 'selection' | 'staff';

interface Session {
  screen: Screen;
  prev: Screen;
  personKey?: string;
  draftKey?: string;
  cat: string;
  query: string;
  productId?: string;
  size?: string;
  saved: SavedItem[];
  progress: number;
  step: string;
  compare: 'before' | 'after';
  resultKey?: string;
  resultSimulated: boolean;
  pendingTryOn: boolean;
  code: string;
  /** Set once the photo has been deleted on request, so the pickup screen can
   *  say so instead of offering to delete it again. */
  photoDeleted: boolean;
  error?: string;
}

const freshSession = (): Session => ({
  screen: 'home', prev: 'home', cat: 'All', query: '', saved: [],
  progress: 0, step: '', compare: 'after', resultSimulated: false,
  pendingTryOn: false, code: makeCode(), photoDeleted: false,
});

interface Store {
  ready: boolean;
  products: Product[];
  settings: Settings;
  orders: Order[];
  s: Session;
  go: (screen: Screen) => void;
  back: () => void;
  setCat: (cat: string) => void;
  setQuery: (q: string) => void;
  setSize: (size: string) => void;
  setCompare: (c: 'before' | 'after') => void;
  openProduct: (id: string) => void;
  setDraftPhoto: (blob: Blob) => Promise<void>;
  confirmPhoto: () => void;
  discardDraft: () => void;
  startTryOn: (productId?: string) => Promise<void>;
  cancelTryOn: () => void;
  saveCurrent: () => void;
  removeSaved: (key: string) => void;
  checkout: () => Promise<void>;
  deletePhoto: () => Promise<void>;
  resetSelection: () => void;
  finish: () => Promise<void>;
  product: Product | undefined;
  saveProduct: (p: Product) => Promise<void>;
  addProducts: (list: Product[]) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  markCollected: (code: string) => Promise<void>;
  clearOrders: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

/** Deletes every stored image except the shop's own product photos — so the
 *  customer's photo and every try-on made from it go, and the catalogue stays.
 *  Revoking the object URLs matters as much as the delete: without it the photo
 *  is gone from IndexedDB but still held in memory and renderable. */
async function wipeCustomerImages(products: Product[]) {
  const keep = new Set<string>();
  for (const p of products) if (p.imageKey) keep.add(p.imageKey);
  await db.pruneImages(keep);
  clearImageCache();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [s, setS] = useState<Session>(freshSession);

  // A cancelled try-on must not write its result in late.
  const runId = useRef(0);

  useEffect(() => {
    (async () => {
      const [stored, loadedSettings, loadedOrders] = await Promise.all([
        db.loadProducts(), db.loadSettings(), db.loadOrders(),
      ]);
      const seeded = await ensureCatalogue(stored);
      const catalogue = seeded ?? stored ?? [];
      setProducts(catalogue);
      if (seeded) await db.saveProducts(seeded);

      setSettings(loadedSettings);
      setOrders(loadedOrders);
      setReady(true);

      // A session that ended in a crash, a reload or a flat battery never ran
      // its own wipe, so its photos are still here. Nothing is on screen yet,
      // so startup is the safe moment to clear whatever was left behind.
      await wipeCustomerImages(catalogue);
    })();
  }, []);

  const patch = useCallback((p: Partial<Session>) => setS((prev) => ({ ...prev, ...p })), []);

  const go = useCallback((screen: Screen) => {
    setS((prev) => ({ ...prev, screen, prev: prev.screen, error: undefined }));
  }, []);

  const back = useCallback(() => {
    setS((prev) => ({ ...prev, screen: prev.prev === prev.screen ? 'home' : prev.prev, error: undefined }));
  }, []);

  const product = useMemo(() => products.find((p) => p.id === s.productId), [products, s.productId]);

  const openProduct = useCallback((id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setS((prev) => ({ ...prev, screen: 'product', prev: 'collection', productId: id, size: p.sizes[0], error: undefined }));
  }, [products]);

  const setDraftPhoto = useCallback(async (blob: Blob) => {
    const key = await db.saveImage(blob, 'person');
    setS((prev) => {
      void db.deleteImage(prev.draftKey);
      return { ...prev, draftKey: key, screen: 'preview', prev: 'photo', photoDeleted: false, error: undefined };
    });
  }, []);

  const discardDraft = useCallback(() => {
    setS((prev) => {
      void db.deleteImage(prev.draftKey);
      return { ...prev, draftKey: undefined, screen: 'photo', prev: 'home' };
    });
  }, []);

  const doTryOn = useCallback(async (personKey: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const id = ++runId.current;

    setS((prev) => ({ ...prev, screen: 'processing', prev: 'product', progress: 0, step: 'step.reading', compare: 'after', error: undefined }));

    try {
      const [person, garment] = await Promise.all([db.getImage(personKey), p.imageKey ? db.getImage(p.imageKey) : undefined]);
      if (!person) throw new Error('error.photoGone');

      const result = await runTryOn({ person, garment, product: p }, settings, (percent, step) => {
        if (runId.current === id) setS((prev) => ({ ...prev, progress: percent, step }));
      });
      if (runId.current !== id) return;

      const key = await db.saveImage(result.image, 'result');
      setS((prev) => ({
        ...prev, screen: 'result', progress: 100, resultKey: key,
        resultSimulated: result.simulated, compare: 'after',
        productId, size: prev.size ?? p.sizes[0],
      }));
    } catch (err) {
      if (runId.current !== id) return;
      setS((prev) => ({
        ...prev,
        screen: 'product',
        error: err instanceof Error ? err.message : 'error.tryOn',
      }));
    }
  }, [products, settings]);

  const startTryOn = useCallback(async (productId?: string) => {
    const id = productId ?? s.productId;
    if (!id) return;
    if (!s.personKey) {
      const p = products.find((x) => x.id === id);
      setS((prev) => ({ ...prev, screen: 'photo', prev: 'product', productId: id, size: prev.size ?? p?.sizes[0], pendingTryOn: true }));
      return;
    }
    const p = products.find((x) => x.id === id);
    setS((prev) => ({ ...prev, productId: id, size: prev.productId === id ? prev.size : p?.sizes[0] }));
    await doTryOn(s.personKey, id);
  }, [s, products, doTryOn]);

  const cancelTryOn = useCallback(() => {
    runId.current++;
    setS((prev) => ({ ...prev, screen: prev.productId ? 'product' : 'collection', progress: 0 }));
  }, []);

  const confirmPhoto = useCallback(() => {
    setS((prev) => {
      if (!prev.draftKey) return prev;
      void db.deleteImage(prev.personKey);
      const next: Session = { ...prev, personKey: prev.draftKey, draftKey: undefined };
      if (prev.pendingTryOn && prev.productId) {
        next.pendingTryOn = false;
        // Kick the render off once state has settled.
        queueMicrotask(() => void doTryOn(next.personKey!, next.productId!));
        return next;
      }
      return { ...next, screen: 'collection', prev: 'home' };
    });
  }, [doTryOn]);

  const saveCurrent = useCallback(() => {
    setS((prev) => {
      const p = products.find((x) => x.id === prev.productId);
      if (!p) return prev;
      const size = prev.size || p.sizes[0];
      const key = `${p.id}-${size}`;
      if (prev.saved.some((r) => r.key === key)) return { ...prev, screen: 'selection', prev: prev.screen };
      const item: SavedItem = {
        key, productId: p.id, name: p.name, size, price: p.price,
        stock: p.stock, imageKey: p.imageKey,
        resultKey: prev.screen === 'result' ? prev.resultKey : undefined,
      };
      return { ...prev, saved: [...prev.saved, item], screen: 'selection', prev: prev.screen };
    });
  }, [products]);

  const removeSaved = useCallback((key: string) => {
    setS((prev) => ({ ...prev, saved: prev.saved.filter((r) => r.key !== key) }));
  }, []);

  const checkout = useCallback(async () => {
    const order: Order = {
      code: s.code,
      items: s.saved.map((r) => ({ name: r.name, size: r.size, price: r.price })),
      total: s.saved.reduce((a, r) => a + r.price, 0),
      createdAt: Date.now(),
      status: 'waiting',
    };
    const next = [order, ...orders.filter((o) => o.code !== order.code)].slice(0, 100);
    setOrders(next);
    await db.saveOrders(next);
    go('staff');
  }, [s.code, s.saved, orders, go]);

  /** Deletes the photo and every try-on made from it, but keeps the pickup code
   *  and the saved list — those are names and sizes only. Offered at the pickup
   *  screen so the customer decides, rather than the tablet deciding for her. */
  const deletePhoto = useCallback(async () => {
    runId.current++;
    await wipeCustomerImages(products);
    setS((prev) => ({
      ...prev,
      personKey: undefined,
      draftKey: undefined,
      resultKey: undefined,
      photoDeleted: true,
      saved: prev.saved.map((r) => ({ ...r, resultKey: undefined })),
    }));
  }, [products]);

  /** Clears the selection and the code but keeps the photo, so the same
   *  customer can start choosing again without standing for another photo. */
  const resetSelection = useCallback(() => {
    setS((prev) => ({
      ...prev,
      saved: [],
      code: makeCode(),
      screen: 'collection',
      prev: 'home',
      productId: undefined,
      resultKey: undefined,
      error: undefined,
    }));
  }, []);

  /** Wipes the customer's photo and try-ons, then hands the tablet to the next person. */
  const finish = useCallback(async () => {
    runId.current++;
    setS(freshSession());
    await wipeCustomerImages(products);
  }, [products]);

  const saveProduct = useCallback(async (p: Product) => {
    const next = products.some((x) => x.id === p.id)
      ? products.map((x) => (x.id === p.id ? p : x))
      : [...products, p];
    setProducts(next);
    await db.saveProducts(next);
  }, [products]);

  /** One write and one re-render for a whole batch, rather than one per piece. */
  const addProducts = useCallback(async (list: Product[]) => {
    if (!list.length) return;
    const next = [...products, ...list];
    setProducts(next);
    await db.saveProducts(next);
  }, [products]);

  const deleteProduct = useCallback(async (id: string) => {
    const target = products.find((x) => x.id === id);
    const next = products.filter((x) => x.id !== id);
    setProducts(next);
    await db.saveProducts(next);
    await db.deleteImage(target?.imageKey);
    setS((prev) => (prev.productId === id ? { ...prev, productId: undefined } : prev));
  }, [products]);

  const updateSettings = useCallback(async (p: Partial<Settings>) => {
    const next = { ...settings, ...p };
    setSettings(next);
    await db.saveSettings(next);
  }, [settings]);

  const markCollected = useCallback(async (code: string) => {
    const next = orders.map((o) => (o.code === code ? { ...o, status: 'collected' as const } : o));
    setOrders(next);
    await db.saveOrders(next);
  }, [orders]);

  const clearOrders = useCallback(async () => {
    setOrders([]);
    await db.saveOrders([]);
  }, []);

  const value: Store = {
    ready, products, settings, orders, s, go, back, product,
    setCat: (cat) => patch({ cat }),
    setQuery: (query) => patch({ query }),
    setSize: (size) => patch({ size }),
    setCompare: (compare) => patch({ compare }),
    openProduct, setDraftPhoto, confirmPhoto, discardDraft,
    startTryOn, cancelTryOn, saveCurrent, removeSaved, checkout, deletePhoto, resetSelection, finish,
    saveProduct, addProducts, deleteProduct, updateSettings, markCollected, clearOrders,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
