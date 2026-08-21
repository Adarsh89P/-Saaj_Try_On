import type { Product } from './types';

/** The catalogue the app starts with. Everything here is editable in
 *  Admin → Catalogue; this is only what a fresh install shows. */
export const SEED_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Kanjivaram Silk Saree', cat: 'Sarees', price: 4999, color: 'Maroon', sizes: ['Free size'], stock: 5, createdAt: 1 },
  { id: 'p2', name: 'Handblock Cotton Kurti', cat: 'Kurtis', price: 899, color: 'Indigo', sizes: ['S', 'M', 'L', 'XL'], stock: 14, createdAt: 2 },
  { id: 'p3', name: 'Chikankari Anarkali', cat: 'Kurtis', price: 1699, color: 'Ivory', sizes: ['M', 'L', 'XL'], stock: 6, createdAt: 3 },
  { id: 'p4', name: 'Georgette Party Saree', cat: 'Sarees', price: 2499, color: 'Emerald', sizes: ['Free size'], stock: 8, createdAt: 4 },
  { id: 'p5', name: 'Floral A-Line Dress', cat: 'Dresses', price: 1299, color: 'Rose', sizes: ['S', 'M', 'L'], stock: 10, createdAt: 5 },
  { id: 'p6', name: 'Sequin Lehenga Set', cat: 'Lehengas', price: 6499, color: 'Wine', sizes: ['S', 'M', 'L'], stock: 3, createdAt: 6 },
  { id: 'p7', name: 'Rayon Straight Kurti', cat: 'Kurtis', price: 749, color: 'Mustard', sizes: ['M', 'L', 'XL'], stock: 18, createdAt: 7 },
  { id: 'p8', name: 'Silk Saree Blouse', cat: 'Blouses', price: 649, color: 'Gold', sizes: ['34', '36', '38', '40'], stock: 12, createdAt: 8 },
];

/** Four-character pickup code, avoiding characters that read alike on a shelf tag. */
export function makeCode() {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY3479';
  let out = '';
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 4; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
