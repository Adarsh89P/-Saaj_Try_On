import { useStore } from '../store';
import { Camera } from '../components/Camera';
import { Media } from '../components/Img';
import { useT } from '../lib/i18n';

export function Photo() {
  const { settings, back, setDraftPhoto } = useStore();
  const t = useT();
  const tips = [t('photo.tip1'), t('photo.tip2'), t('photo.tip3')];

  return (
    <div className="page">
      <button type="button" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={back}>
        {t('common.back')}
      </button>

      <h1 className="h-lg">{t('photo.title')}</h1>

      <Camera onCapture={setDraftPhoto} />

      <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {tips.map((tip, i) => (
          <li key={tip} className="hstack" style={{ gap: 12 }}>
            <span
              aria-hidden="true"
              style={{
                width: 30, height: 30, flex: 'none', borderRadius: 999,
                background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-800)',
                display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--color-neutral-800)' }}>{tip}</span>
          </li>
        ))}
      </ol>

      {settings.privacyNotice && (
        <p className="notice">
          {t('photo.privacy')}
          {settings.provider === 'gemini' && t('photo.privacyGemini')}
        </p>
      )}
    </div>
  );
}

export function PhotoPreview() {
  const { s, discardDraft, confirmPhoto } = useStore();
  const t = useT();

  return (
    <div className="page">
      <h1 className="h-lg">{t('photo.previewTitle')}</h1>

      <Media imageKey={s.draftKey} label={t('photo.yourPhoto')} />

      <div className="hstack" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="badge">{t('photo.badgeBody')}</span>
        <span className="badge">{t('photo.badgeLight')}</span>
      </div>

      <div className="hstack" style={{ gap: 10 }}>
        <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={discardDraft}>
          {t('home.retake')}
        </button>
        <button type="button" className="btn btn--primary" style={{ flex: 1.4 }} onClick={confirmPhoto}>
          {t('photo.usePhoto')}
        </button>
      </div>
    </div>
  );
}
