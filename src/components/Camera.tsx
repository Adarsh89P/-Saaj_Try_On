import { useCallback, useEffect, useRef, useState } from 'react';
import { shrink } from '../lib/image';

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
      setMessage(
        name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow it in the browser settings, or upload a photo instead.'
          : 'No camera available on this device. Upload a photo instead.',
      );
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
      if (blob) { stop(); await onCapture(await shrink(blob)); }
    } finally {
      setBusy(false);
    }
  }, [status, facing, onCapture, stop]);

  const pickFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      stop();
      await onCapture(await shrink(file));
    } catch {
      setMessage('That file could not be read as an image.');
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
        <p className="cam__hint">
          Stand so your whole body fits the outline
        </p>
      </div>

      {message && <p className="error">{message}</p>}

      {status === 'live' ? (
        <>
          <button type="button" className="btn btn--primary btn--block" onClick={capture} disabled={busy}>
            {busy ? 'Saving…' : 'Take the photo'}
          </button>
          <button
            type="button"
            className="btn btn--outline btn--block"
            onClick={() => { const next = facing === 'user' ? 'environment' : 'user'; setFacing(next); void start(next); }}
          >
            Switch camera
          </button>
        </>
      ) : (
        <button type="button" className="btn btn--primary btn--block" onClick={() => void start(facing)} disabled={status === 'starting'}>
          {status === 'starting' ? 'Opening camera…' : 'Open camera'}
        </button>
      )}

      <button type="button" className="btn btn--outline btn--block" onClick={() => fileRef.current?.click()} disabled={busy}>
        Upload from device
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
