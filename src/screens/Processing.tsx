import { useStore } from '../store';

export function Processing() {
  const { s, settings, cancelTryOn } = useStore();
  const pct = Math.round(s.progress);

  return (
    <div
      className="page"
      style={{ minHeight: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 26 }}
    >
      <div className="spinner" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Creating your try-on" />

      <div className="stack" style={{ gap: 8 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1.2 }}>{s.step || 'Reading your photo'}</p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {settings.provider === 'gemini' ? 'Usually about 20 seconds. Keep this screen open.' : 'Just a moment. Keep this screen open.'}
        </p>
      </div>

      <div className="bar"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>

      <button type="button" className="btn btn--ghost" onClick={cancelTryOn}>Cancel</button>
    </div>
  );
}
