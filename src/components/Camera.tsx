import { useCallback, useEffect, useRef, useState } from 'react';
import { shrink } from '../lib/image';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/haptics';

type Status = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported';

/** Live camera capture with an upload fallback. Frames never leave the device
 *  here — the captured blob is handed straight back to the caller. */
export function Camera({ onCapture }: { onCapture: (blob: Blob) => void | Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [count, setCount] = useState<number>();
  const [flash, setFlash] = useState(false);
  const t = useT();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (mode: 'user' | 'environment') => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return; }
    setStatus('starting');
    setMessage(undefined);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1707 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus('live');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setStatus(name === 'NotAllowedError' ? 'denied' : 'unsupported');
      setMessage(name === 'NotAllowedError' ? t('cam.denied') : t('cam.unsupported'));
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || status !== 'live') return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (facing === 'user') {
        // Un-mirror the selfie view so the saved photo matches reality.
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
      if (blob) {
        setFlash(true);
        haptic('success');
        stop();
        await onCapture(await shrink(blob));
      }
    } finally {
      setBusy(false);
    }
  }, [status, facing, onCapture, stop]);

  /** A self-timer, not an instant shutter. Getting a whole body in frame means
   *  standing two steps back from the tablet, which is two steps further than
   *  anyone can reach the button from — without the count, every photo is of
   *  someone leaning towards the screen. */
  const startTimer = useCallback(() => {
    if (status !== 'live' || count !== undefined) return;
    haptic('select');
    setCount(3);
  }, [status, count]);

  const stopTimer = useCallback(() => setCount(undefined), []);

  // The count runs here rather than on an interval inside setCount: taking the
  // photo is a side effect, and a state updater that fires twice would fire it
  // twice with it. Unmounting clears the pending step, so a countdown left
  // behind cannot capture from a stream that has already been stopped.
  useEffect(() => {
    if (count === undefined) return;
    if (count === 0) { setCount(undefined); void capture(); return; }
    const id = window.setTimeout(() => { haptic('tap'); setCount(count - 1); }, 1000);
    return () => window.clearTimeout(id);
  }, [count, capture]);

  const pickFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      stop();
      await onCapture(await shrink(file));
    } catch {
      setMessage(t('cam.badFile'));
    } finally {
      setBusy(false);
    }
  }, [onCapture, stop]);

  return (
    <div className="stack">
      <div className={status === 'live' ? 'cam' : 'cam cam--idle'}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ display: status === 'live' ? 'block' : 'none', transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        <div className="cam__guide"><i /></div>
        {count !== undefined
          ? <div className="cam__count" key={count} aria-hidden="true">{count}</div>
          : <p className="cam__hint">{t('cam.guide')}</p>}
        {flash && (
          <div className="cam__flash" onAnimationEnd={() => setFlash(false)} />
        )}
      </div>

      {message && <p className="error">{message}</p>}

      {status === 'live' ? (
        count !== undefined ? (
          <button type="button" className="btn btn--outline btn--block" onClick={stopTimer}>
            {t('cam.stopTimer')}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--primary btn--block" onClick={startTimer} disabled={busy}>
              {busy ? t('cam.saving') : t('cam.take')}
            </button>
            <p className="tiny muted center" style={{ margin: '-4px 0 0' }}>{t('cam.timerHint')}</p>
            <button
              type="button"
              className="btn btn--outline btn--block"
              onClick={() => { const next = facing === 'user' ? 'environment' : 'user'; setFacing(next); void start(next); }}
            >
              {t('cam.switch')}
            </button>
          </>
        )
      ) : (
        <button type="button" className="btn btn--primary btn--block" onClick={() => void start(facing)} disabled={status === 'starting'}>
          {status === 'starting' ? t('cam.opening') : t('cam.open')}
        </button>
      )}

      <button type="button" className="btn btn--outline btn--block" onClick={() => fileRef.current?.click()} disabled={busy}>
        {t('cam.upload')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}
