// Inline icons (no icon font or CDN). All are decorative: aria-hidden.
import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  ...p,
});

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="10" /><path d="m7.5 12.5 3 3 6-6.5" /></svg>
);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4.5M12 17h.01" /></svg>
);
export const IconCross = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>
);
export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
);
export const IconSpinner = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className={`spin ${p.className ?? ''}`}><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>
);
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>
);
export const IconFile = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M8 13h8M8 17h8" /></svg>
);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
);
export const IconZoom = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8v6M8 11h6" /></svg>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
);
export const IconArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
);
export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);

/** App mark: a bottle with a label and a check. */
export const BrandMark = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" {...p}>
    <rect x="0" y="0" width="40" height="40" rx="9" fill="#ffffff" fillOpacity="0.12" />
    <path d="M17 6h6v5l3 4v17a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V15l3-4Z" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
    <rect x="14.5" y="18" width="11" height="9" rx="1.5" fill="#ffffff" />
    <path d="m17.3 22.6 2 2 3.6-3.8" fill="none" stroke="#17304f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
