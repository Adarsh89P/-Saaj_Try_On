/** Short vibrations for the kiosk's own touches. The tablet is the only thing
 *  the customer is holding, so a tap that answers back is the difference
 *  between "did that work?" and knowing it did. Silent no-op where the device
 *  or the browser has no vibrator, which is every desktop and every iPad. */

type Pattern = 'tap' | 'select' | 'success' | 'warn';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  select: 14,
  success: [12, 40, 22],
  warn: [22, 60, 22],
};

export function haptic(kind: Pattern = 'tap') {
  // Someone who has asked for less motion has not asked for less vibration,
  // but a kiosk left buzzing in a quiet shop is worse than one that is still.
  if (!('vibrate' in navigator)) return;
  try { navigator.vibrate(PATTERNS[kind]); } catch { /* refused; nothing to do */ }
}
