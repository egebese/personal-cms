import type { Site } from './types'

// Each preset: page bg, card bg, ink, muted ink, hairline, card shadow.
// shadow is joined into a box-shadow list, so it can't be 'none'.
export const PRESETS: Record<string, { label: string; bg: string; card: string; ink: string; muted: string; line: string; shadow: string }> = {
  cloud: { label: 'Cloud', bg: '#f2f3f6', card: '#ffffff', ink: '#17181d', muted: '#6d707b', line: '#e4e6ec', shadow: '0 1px 2px rgba(23,24,29,.05), 0 6px 20px -8px rgba(23,24,29,.08)' },
  night: { label: 'Night', bg: '#121318', card: '#1c1d24', ink: '#f2f2f5', muted: '#9a9cab', line: '#2a2c35', shadow: '0 0 #0000' },
  peach: { label: 'Peach', bg: '#fbe7dc', card: '#fff6f1', ink: '#2c1a13', muted: '#8a6658', line: '#f1d3c4', shadow: '0 1px 2px rgba(44,26,19,.06)' },
  moss: { label: 'Moss', bg: '#e3ece0', card: '#f7faf5', ink: '#17251a', muted: '#5d705f', line: '#cfdccb', shadow: '0 1px 2px rgba(23,37,26,.06)' },
  cobalt: { label: 'Cobalt', bg: '#1d2b85', card: '#26369a', ink: '#eef0ff', muted: '#aab3f0', line: '#3343b0', shadow: '0 0 #0000' },
  paper: { label: 'Paper', bg: '#ffffff', card: '#ffffff', ink: '#111111', muted: '#6b6b6b', line: '#e6e6e6', shadow: '0 0 #0000' },
}

export const FONTS: Record<string, { label: string; family: string; google: string }> = {
  bricolage: { label: 'Bricolage', family: '"Bricolage Grotesque", system-ui, sans-serif', google: 'Bricolage+Grotesque:opsz,wght@12..96,400..800' },
  instrument: { label: 'Instrument', family: '"Instrument Serif", Georgia, serif', google: 'Instrument+Serif' },
  space: { label: 'Space', family: '"Space Grotesk", system-ui, sans-serif', google: 'Space+Grotesk:wght@400..700' },
  fraunces: { label: 'Fraunces', family: 'Fraunces, Georgia, serif', google: 'Fraunces:opsz,wght@9..144,400..800' },
  mono: { label: 'Mono', family: '"JetBrains Mono", ui-monospace, monospace', google: 'JetBrains+Mono:wght@400..700' },
}

export const fontHref = (font: string) =>
  `https://fonts.googleapis.com/css2?family=${(FONTS[font] || FONTS.bricolage).google}&family=Inter:wght@400..700&display=swap`

export function themeVars(site: Site): Record<string, string> {
  const p = PRESETS[site.theme.preset] || PRESETS.cloud
  const f = FONTS[site.theme.font] || FONTS.bricolage
  return {
    '--lw-bg': p.bg, '--lw-card': p.card, '--lw-ink': p.ink, '--lw-muted': p.muted,
    '--lw-line': p.line, '--lw-shadow': p.shadow, '--lw-accent': site.theme.accent || '#3d2bff',
    '--lw-display': f.family,
  }
}

export const varsToCss = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
