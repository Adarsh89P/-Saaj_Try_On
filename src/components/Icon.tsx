/** The kiosk's own line icons.
 *
 *  Drawn here rather than pulled from a set: there are four of them, an icon
 *  package would be more bytes than the whole stylesheet, and this app has to
 *  install and run offline on a shop tablet. They share one geometry — 1.6
 *  stroke, round caps, 24-unit box — so they sit together as one family. */

type Props = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
});

export function CloseIcon({ size = 18, className = 'icon' }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** The grip on the compare slider: arrows pointing the two ways it moves. */
export function CompareIcon({ size = 20, className = 'icon' }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 8L6 12l4 4M14 8l4 4-4 4" />
    </svg>
  );
}

/** The empty selection: a hanger, because what goes here is garments. */
export function HangerIcon({ size = 92, className = 'icon' }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.2}>
      <path d="M12 8.6a2.3 2.3 0 1 1 2.3-2.3" />
      <path d="M12 8.6v2.1" />
      <path d="M12 10.7 3.9 16.2a1.4 1.4 0 0 0 .8 2.6h14.6a1.4 1.4 0 0 0 .8-2.6L12 10.7Z" />
    </svg>
  );
}
