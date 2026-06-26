import type { SVGProps } from 'react';

// The Lucide micro-set Grove needs, inlined as path data so the app carries no
// icon dependency and every glyph inherits `currentColor` + the CSS-sized box
// (HANDOFF constraint 4: Lucide, ~1.75 stroke, no emoji). One default-exported
// component keyed by `name` keeps the Fast-Refresh "one component per file" rule.
const PATHS: Record<string, string> = {
  search: 'M21 21l-4.34-4.34M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  plus: 'M5 12h14M12 5v14',
  pencil: 'M21.17 6.83l-3-3L4 18l-1 4 4-1zM14.5 6.5l3 3',
  send: 'M12 19V5M5 12l7-7 7 7',
  x: 'M18 6L6 18M6 6l12 12',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  unlink:
    'M16.5 9.4l2.1-2.1a3 3 0 000-4.2l-.7-.7a3 3 0 00-4.2 0L11.6 4.5M7.5 14.6l-2.1 2.1a3 3 0 000 4.2l.7.7a3 3 0 004.2 0l1.9-1.9M8 12l8 0',
  alert: 'M10.3 3.8L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.8a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  sparkles:
    'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4M5 17v2M6 18H4',
  file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h6',
  'file-plus': 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M12 12v6M9 15h6',
  check: 'M20 6L9 17l-5-5',
  undo: 'M3 7v6h6M3 13a9 9 0 109-9 9 9 0 00-7.5 4',
  external: 'M15 3h6v6M10 14L21 3M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  message: 'M21 11.5a8.5 8.5 0 01-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1121 11.5z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  stop: 'M6 6h12v12H6z',
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: keyof typeof PATHS | string;
}

export default function Icon({ name, ...rest }: IconProps) {
  const d = PATHS[name] || '';
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={'M' + seg} />
      ))}
    </svg>
  );
}
