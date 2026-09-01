export type Category = 'Sarees' | 'Kurtis' | 'Dresses' | 'Lehengas' | 'Blouses' | string;

export interface Product {
  id: string;
  name: string;
  cat: Category;
  price: number;
  color: string;
  sizes: string[];
  stock: number;
  /** Key into the image blob store (see lib/db.ts). Absent until a photo is added.
   *  Full size: this is what gets sent for a try-on. */
  imageKey?: string;
  /** Small copy of the same photo for grids and lists. Painting a 62px thumb
   *  from a 1400px original costs a full decode per tile. */
  thumbKey?: string;
  createdAt: number;
}

export interface SavedItem {
  key: string;
  productId: string;
  name: string;
  size: string;
  price: number;
  stock: number;
  imageKey?: string;
  thumbKey?: string;
  /** Blob key of the generated try-on, when one exists. */
  resultKey?: string;
}

export interface Order {
  code: string;
  items: Array<{ name: string; size: string; price: number }>;
  total: number;
  createdAt: number;
  status: 'waiting' | 'collected';
}

export type TryOnProviderId = 'demo' | 'gemini';

export type Lang = 'en' | 'hi';

export interface Settings {
  shopName: string;
  /** Language of the customer-facing screens. The Staff area stays English. */
  language: Lang;
  provider: TryOnProviderId;
  geminiKey: string;
  geminiModel: string;
  /** Text model used to read a garment photo when bulk-adding stock. */
  geminiTextModel: string;
  /** Billed requests allowed per day. 0 turns the cap off. */
  dailyRequestLimit: number;
  /** Runs new catalogue photos through background removal as they are added. */
  cleanGarmentPhotos: boolean;
  /** Demo provider only: how long the fake render takes, in seconds. */
  demoSeconds: number;
  privacyNotice: boolean;
  adminPin: string;
}

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'Jyotsna Saree Center',
  language: 'en',
  provider: 'demo',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash-image',
  geminiTextModel: 'gemini-2.5-flash',
  dailyRequestLimit: 200,
  cleanGarmentPhotos: true,
  demoSeconds: 2.6,
  privacyNotice: true,
  adminPin: '2468',
};

export const CATEGORIES: Category[] = ['Sarees', 'Kurtis', 'Dresses', 'Lehengas', 'Blouses'];
