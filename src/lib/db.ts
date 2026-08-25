import { createStore, get, set, del, keys } from 'idb-keyval';
import { DEFAULT_SETTINGS, type Order, type Product, type Settings } from './types';

const store = createStore('saaj-tryon', 'kv');

const PRODUCTS = 'products';
const ORDERS = 'orders';
const SETTINGS = 'settings';
const IMG = 'img:';

/* ── images ─────────────────────────────────────────────────────────── */

export function newImageKey(prefix = 'img') {
  return `${IMG}${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function putImage(key: string, blob: Blob) {
  await set(key, blob, store);
  return key;
}

export async function saveImage(blob: Blob, prefix?: string) {
  return putImage(newImageKey(prefix), blob);
}

export async function getImage(key: string): Promise<Blob | undefined> {
  return get<Blob>(key, store);
}

export async function deleteImage(key?: string) {
  if (key) await del(key, store);
}

/** Drops every stored image that no product or order still points at. */
export async function pruneImages(keep: Set<string>) {
  const all = await keys(store);
  await Promise.all(
    all
      .filter((k): k is string => typeof k === 'string' && k.startsWith(IMG) && !keep.has(k))
      .map((k) => del(k, store)),
  );
}

/* ── products ───────────────────────────────────────────────────────── */

export async function loadProducts(): Promise<Product[] | undefined> {
  return get<Product[]>(PRODUCTS, store);
}

export async function saveProducts(products: Product[]) {
  await set(PRODUCTS, products, store);
}

/* ── orders ─────────────────────────────────────────────────────────── */

export async function loadOrders(): Promise<Order[]> {
  return (await get<Order[]>(ORDERS, store)) ?? [];
}

export async function saveOrders(orders: Order[]) {
  await set(ORDERS, orders, store);
}

/* ── billed-request usage ───────────────────────────────────────────── */

const USAGE = 'usage';

export interface Usage {
  /** Local calendar day, so the count rolls over when the shop opens, not at UTC midnight. */
  date: string;
  count: number;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadUsage(): Promise<Usage> {
  const stored = await get<Usage>(USAGE, store);
  return stored?.date === today() ? stored : { date: today(), count: 0 };
}

/** Counts an attempt, not a success — a request that errors after reaching
 *  Google may still be billed, so the guard has to assume it was. */
export async function bumpUsage(by = 1): Promise<Usage> {
  const current = await loadUsage();
  const next = { date: current.date, count: current.count + by };
  await set(USAGE, next, store);
  return next;
}

/* ── one-shot flags ─────────────────────────────────────────────────── */

const FLAGS = 'flags';

/** Records that a one-time migration has run, so it never runs twice and
 *  cannot undo a change the shop made afterwards. */
export async function getFlag(name: string): Promise<boolean> {
  const flags = await get<Record<string, boolean>>(FLAGS, store);
  return Boolean(flags?.[name]);
}

export async function setFlag(name: string) {
  const flags = (await get<Record<string, boolean>>(FLAGS, store)) ?? {};
  flags[name] = true;
  await set(FLAGS, flags, store);
}

/* ── settings ───────────────────────────────────────────────────────── */

export async function loadSettings(): Promise<Settings> {
  const stored = await get<Partial<Settings>>(SETTINGS, store);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(settings: Settings) {
  await set(SETTINGS, settings, store);
}
