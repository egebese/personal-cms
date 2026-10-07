// Small shared UI pieces for the admin.
const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  send: 'M5 12h14M13 6l6 6-6 6',
  stop: 'M7 7h10v10H7z',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5s.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  close: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4M15 9h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="ad-logo">
      <svg viewBox="0 0 28 28" width="20" height="20" aria-hidden><path d="M4 2.5 23.5 12 14 14.4 9.8 23.6z" fill="var(--ad-accent)" /></svg>
      linkwizz
    </span>
  )
}

// Square size glyphs for the size switcher.
export function SizeGlyph({ size }: { size: string }) {
  const r: Record<string, [number, number]> = { s: [8, 8], w: [16, 8], t: [8, 16], l: [16, 16], h: [18, 4] }
  const [w, h] = r[size] || [8, 8]
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <rect x={(20 - w) / 2} y={(20 - h) / 2} width={w} height={h} rx="2.5" fill="currentColor" />
    </svg>
  )
}

export const SIZE_NAMES: Record<string, string> = { s: 'Small', w: 'Wide', t: 'Tall', l: 'Large', h: 'Full row' }
