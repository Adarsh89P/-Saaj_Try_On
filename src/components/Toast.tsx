import { useEffect } from 'react';
import { useStore } from '../store';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/haptics';
import { CloseIcon } from './Icon';

/** One line of feedback above the bottom nav. It never blocks the screen and it
 *  never needs dismissing — the shop's customers are standing up, often with a
 *  staff member beside them, and a modal at that moment stops the whole flow. */
export function ToastHost({ liftedOverNav = false }: { liftedOverNav?: boolean }) {
  const { toast, dismissToast } = useStore();
  const t = useT();

  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    // An undo has to outlive the glance that notices it went wrong.
    const ms = toast.undo ? 7000 : 3400;
    const timer = window.setTimeout(() => dismissToast(id), ms);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  return (
    <div className={liftedOverNav ? 'toast-host toast-host--lifted' : 'toast-host'} aria-live="polite" aria-atomic="true">
      {toast && (
        // Keyed on the id so a second toast replays the entrance instead of
        // silently swapping its words while it sits there.
        <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
          <span className="toast__msg">{t(toast.msg)}</span>
          {toast.undo && (
            <button
              type="button"
              className="toast__action"
              onClick={() => { haptic('select'); toast.undo?.(); dismissToast(toast.id); }}
            >
              {t(toast.undoLabel ?? 'toast.undo')}
            </button>
          )}
          <button
            type="button"
            className="toast__close"
            aria-label={t('toast.dismiss')}
            onClick={() => dismissToast(toast.id)}
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
