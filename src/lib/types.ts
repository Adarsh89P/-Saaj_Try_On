export type Category = 'Sarees' | 'Kurtis' | 'Dresses' | 'Lehengas' | 'Blouses' | string;

export interface Product {
  id: string;
  name: string;
  cat: Category;
  price: number;
  color: string;
  sizes: string[];
  stock: number;
  /** Key into the image blob store (see lib/db.ts). Absent until a photo is added. */
  imageKey?: string;
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

export interface Settings {
  shopName: string;
  provider: TryOnProviderId;
  geminiKey: string;
  geminiModel: string;
  /** Demo provider only: how long the fake render takes, in seconds. */
  demoSeconds: number;
  privacyNotice: boolean;
  adminPin: string;
}

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'JyotsnaSareeCenter',
  provider: 'demo',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash-image',
  demoSeconds: 2.6,
  privacyNotice: true,
  adminPin: '2468',
};

export const CATEGORIES: Category[] = ['Sarees', 'Kurtis', 'Dresses', 'Lehengas', 'Blouses'];
