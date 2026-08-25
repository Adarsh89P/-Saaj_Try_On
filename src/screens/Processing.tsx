import { useStore } from '../store';
import { useT } from '../lib/i18n';

export function Processing() {
  const { s, settings, cancelTryOn } = useStore();
  const t = useT();
  const pct = Math.round(s.progress);

  return (
    <div
      className="page"
      style={{ minHeight: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 26 }}
    >
      <div
        className="spinner" role="progressbar"
        aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('processing.label')}
      />

      <div className="stack" style={{ gap: 8 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1.2 }}>
          {t(s.step || 'step.reading')}
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {settings.provider === 'gemini' ? t('processing.waitGemini') : t('processing.waitDemo')}
        </p>
      </div>

      <div className="bar"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>

      <button type="button" className="btn btn--ghost" onClick={cancelTryOn}>{t('common.cancel')}</button>
    </div>
  );
}
