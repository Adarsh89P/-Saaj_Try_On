import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as db from './lib/db';
import { clearImageCache } from './components/Img';
import { runTryOn } from './lib/tryon';
import { ensureCatalogue, makeCode } from './lib/seed';
import { makeThumb } from './lib/image';
import { DEFAULT_SETTINGS, type Order, type Product, type SavedItem, type Settings } from './lib/types';
import { haptic } from './lib/haptics';

/** A short line of feedback at the bottom of the screen, optionally with one
 *  undo. Nothing in the kiosk is destructive enough to need a dialog, and a
 *  dialog in the middle of a shop stops the customer dead. */
export interface Toast {
  id: number;
  msg: string;
  tone: 'ok' | 'warn';
  undo?: () => void;
  undoLabel?: string;
}

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
  compare: 'before' | 'after' | 'slide';
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
  progress: 0, step: '', compare: 'slide', resultSimulated: false,
  pendingTryOn: false, code: makeCode(), photoDeleted: false,
});

interface Store {
  ready: boolean;
  toast?: Toast;
  notify: (msg: string, opts?: { tone?: 'ok' | 'warn'; undo?: () => void; undoLabel?: string }) => void;
  dismissToast: (id?: number) => void;
  products: Product[];
  settings: Settings;
  orders: Order[];
  s: Session;
  go: (screen: Screen) => void;
  back: () => void;
  setCat: (cat: string) => void;
  setQuery: (q: string) => void;
  setSize: (size: string) => void;
  setCompare: (c: 'before' | 'after' | 'slide') => void;
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
  for (const p of products) {
    if (p.imageKey) keep.add(p.imageKey);
    // Thumbnails are shop property too — miss this and every grid picture is
    // pruned the first time a customer finishes.
    if (p.thumbKey) keep.add(p.thumbKey);
  }
  await db.pruneImages(keep);
  clearImageCache();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [s, setS] = useState<Session>(freshSession);
  const [toast, setToast] = useState<Toast>();

  // A cancelled try-on must not write its result in late.
  const runId = useRef(0);
  const toastId = useRef(0);

  const notify = useCallback((msg: string, opts?: { tone?: 'ok' | 'warn'; undo?: () => void; undoLabel?: string }) => {
    setToast({ id: ++toastId.current, msg, tone: opts?.tone ?? 'ok', undo: opts?.undo, undoLabel: opts?.undoLabel });
  }, []);

  /** Ignores a stale id so a toast that has already been replaced cannot have
   *  its timer close the one that took its place. */
  const dismissToast = useCallback((id?: number) => {
    setToast((prev) => (prev && (id === undefined || prev.id === id) ? undefined : prev));
  }, []);

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

      // Pieces photographed before thumbnails existed get one now. This runs
      // after the kiosk is already usable, one at a time, so a big catalogue
      // does not stall the first screen.
      const needThumbs = catalogue.filter((p) => p.imageKey && !p.thumbKey);
      if (needThumbs.length) {
        const made = new Map<string, string>();
        for (const p of needThumbs) {
          try {
            const full = await db.getImage(p.imageKey!);
            if (full) made.set(p.id, await db.saveImage(await makeThumb(full), 'product'));
          } catch { /* a piece without a thumb still shows, just less cheaply */ }
        }
        if (made.size) {
          const withThumbs = catalogue.map((p) => (made.has(p.id) ? { ...p, thumbKey: made.get(p.id) } : p));
          setProducts(withThumbs);
          await db.saveProducts(withThumbs);
        }
      }
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

    setS((prev) => ({ ...prev, screen: 'processing', prev: 'product', progress: 0, step: 'step.reading', compare: 'slide', error: undefined }));

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
        resultSimulated: result.simulated, compare: 'slide',
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

  /** Reads the session directly rather than from inside a state updater: the
   *  toast is a side effect, and an updater that fires twice (or during a
   *  render pass) must stay pure. */
  const saveCurrent = useCallback(() => {
    const p = products.find((x) => x.id === s.productId);
    if (!p) return;
    const size = s.size || p.sizes[0];
    const key = `${p.id}-${size}`;
    if (s.saved.some((r) => r.key === key)) {
      haptic('warn');
      notify('toast.alreadySaved', { tone: 'warn' });
      setS((prev) => ({ ...prev, screen: 'selection', prev: prev.screen }));
      return;
    }
    const item: SavedItem = {
      key, productId: p.id, name: p.name, size, price: p.price,
      stock: p.stock, imageKey: p.imageKey, thumbKey: p.thumbKey,
      resultKey: s.screen === 'result' ? s.resultKey : undefined,
    };
    haptic('success');
    notify('toast.saved');
    setS((prev) => ({ ...prev, saved: [...prev.saved, item], screen: 'selection', prev: prev.screen }));
  }, [products, s, notify]);

  /** Removing is undoable: the row goes back where it was, not onto the end,
   *  so the list the customer is looking at does not reshuffle under her. */
  const removeSaved = useCallback((key: string) => {
    const at = s.saved.findIndex((r) => r.key === key);
    if (at < 0) return;
    const row = s.saved[at];
    haptic('warn');
    notify('toast.removed', {
      tone: 'warn',
      undoLabel: 'toast.undo',
      undo: () => setS((cur) => {
        if (cur.saved.some((r) => r.key === key)) return cur;
        const back = [...cur.saved];
        back.splice(Math.min(at, back.length), 0, row);
        return { ...cur, saved: back };
      }),
    });
    setS((prev) => ({ ...prev, saved: prev.saved.filter((r) => r.key !== key) }));
  }, [s.saved, notify]);

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
    notify('toast.photoDeleted');
  }, [products, notify]);

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
    await db.deleteImage(target?.thumbKey);
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

  const setCat = useCallback((cat: string) => patch({ cat }), [patch]);
  const setQuery = useCallback((query: string) => patch({ query }), [patch]);
  const setSize = useCallback((size: string) => patch({ size }), [patch]);
  const setCompare = useCallback((compare: 'before' | 'after' | 'slide') => patch({ compare }), [patch]);

  // Rebuilding this object on every render handed every consumer a new context
  // value each time, so a single keystroke in the search box re-rendered the
  // whole tree. Now only real state changes propagate.
  const value: Store = useMemo(() => ({
    ready, products, settings, orders, s, go, back, product, toast, notify, dismissToast,
    setCat, setQuery, setSize, setCompare,
    openProduct, setDraftPhoto, confirmPhoto, discardDraft,
    startTryOn, cancelTryOn, saveCurrent, removeSaved, checkout, deletePhoto, resetSelection, finish,
    saveProduct, addProducts, deleteProduct, updateSettings, markCollected, clearOrders,
  }), [
    ready, products, settings, orders, s, go, back, product, toast, notify, dismissToast,
    setCat, setQuery, setSize, setCompare,
    openProduct, setDraftPhoto, confirmPhoto, discardDraft,
    startTryOn, cancelTryOn, saveCurrent, removeSaved, checkout, deletePhoto, resetSelection, finish,
    saveProduct, addProducts, deleteProduct, updateSettings, markCollected, clearOrders,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
