import { useCallback, useRef, useState } from 'react';
import { Img } from './Img';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/haptics';
import { CompareIcon } from './Icon';

/** Drag-to-compare between the customer's own photo and the try-on.
 *
 *  The two tabs above it answer "what does it look like on"; this answers
 *  "is that really me" — which is the question people actually ask, and they
 *  ask it by moving their finger back and forth over the picture. Keeping both
 *  is deliberate: the tabs are the discoverable control, the drag is the one
 *  that convinces. */
export function Compare({ beforeKey, afterKey }: { beforeKey?: string; afterKey?: string }) {
  const [pos, setPos] = useState(55);
  const box = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const lastNotch = useRef(55);
  const t = useT();

  const moveTo = useCallback((clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const next = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPos(next);
    // A tick every tenth of the width, so the drag has a texture under the
    // finger without buzzing continuously all the way across.
    if (Math.abs(next - lastNotch.current) >= 10) { lastNotch.current = next; haptic('tap'); }
  }, []);

  // Both images have to be present for the comparison to mean anything; with
  // only one, showing a handle over it would be a lie.
  if (!beforeKey || !afterKey) {
    return (
      <div className="media media--3x4">
        <Img imageKey={afterKey ?? beforeKey} alt={t('result.after')} />
      </div>
    );
  }

  return (
    <div className="cmp-wrap">
      <div
        ref={box}
        className={dragging ? 'cmp is-dragging' : 'cmp'}
        onPointerDown={(e) => {
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => { if (dragging) moveTo(e.clientX); }}
        onPointerUp={(e) => {
          setDragging(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <div className="cmp__layer"><Img imageKey={beforeKey} alt={t('result.before')} /></div>
        <div className="cmp__layer cmp__layer--top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Img imageKey={afterKey} alt={t('result.after')} />
        </div>

        <span className="cmp__tag cmp__tag--l">{t('result.before')}</span>
        <span className="cmp__tag cmp__tag--r">{t('result.after')}</span>

        <div className="cmp__line" style={{ left: `${pos}%` }} aria-hidden="true">
          <span className="cmp__grip"><CompareIcon /></span>
        </div>
      </div>

      {/* The real control for anyone on a keyboard or a screen reader; the
          pointer drag above is a convenience laid over it, not a replacement. */}
      <input
        className="cmp__range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(pos)}
        aria-label={t('result.compareLabel')}
        onChange={(e) => setPos(Number(e.target.value))}
      />
      <p className="tiny muted center" style={{ margin: 0 }}>{t('result.compareHint')}</p>
    </div>
  );
}
