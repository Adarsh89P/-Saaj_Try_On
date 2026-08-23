import { useEffect, useState } from 'react';
import { getImage } from '../lib/db';

const cache = new Map<string, string>();

/** Drops every cached object URL. Deleting a blob from IndexedDB is not enough
 *  on its own — a live object URL keeps the photo in memory and renderable, so
 *  this must run whenever the customer's images are wiped. */
export function clearImageCache() {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}

/** Renders an image held in IndexedDB. Object URLs are cached per key so a
 *  thumbnail re-appearing in a list does not re-read the blob every time. */
export function Img({ imageKey, alt, className }: { imageKey?: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | undefined>(() => (imageKey ? cache.get(imageKey) : undefined));

  useEffect(() => {
    if (!imageKey) { setUrl(undefined); return; }
    const cached = cache.get(imageKey);
    if (cached) { setUrl(cached); return; }
    let live = true;
    getImage(imageKey).then((blob) => {
      if (!live || !blob) return;
      const objectUrl = URL.createObjectURL(blob);
      cache.set(imageKey, objectUrl);
      setUrl(objectUrl);
    });
    return () => { live = false; };
  }, [imageKey]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}

/** A media box that falls back to the product name when there is no photo yet. */
export function Media({
  imageKey, label, className = 'media media--3x4',
}: { imageKey?: string; label: string; className?: string }) {
  return (
    <div className={className}>
      <Img imageKey={imageKey} alt={label} />
      {!imageKey && <span className="media__empty">{label}</span>}
    </div>
  );
}
