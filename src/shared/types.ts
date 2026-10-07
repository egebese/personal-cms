export type Size = 's' | 'w' | 't' | 'l' | 'h' // 1x1, 2x1, 1x2, 2x2, full-width header row

export interface Block {
  id: string
  type: string
  size: Size
  data: Record<string, any>
}

export interface Page {
  id: string
  slug: string // '' = home
  title: string
  blocks: Block[]
}

export type CursorStyle = 'signature_arc' | 'spring_settle' | 'magnetic' | 'comet_swoop' | 'adaptive' | 'classic'
export type CursorTiming = 'fitts' | 'native' | 'fixed'

export interface Site {
  name: string
  bio: string
  avatar: string
  theme: { preset: string; accent: string; font: string }
  cursor: {
    style: CursorStyle
    timing: CursorTiming
    effects: { trail: boolean; glow: boolean; ripple: boolean; squish: boolean; magnet: boolean }
  }
}

export const defaultSite = (): Site => ({
  name: '',
  bio: '',
  avatar: '',
  theme: { preset: 'cloud', accent: '#3d2bff', font: 'bricolage' },
  cursor: {
    style: 'adaptive',
    timing: 'fitts',
    effects: { trail: true, glow: true, ripple: true, squish: true, magnet: true },
  },
})

// Slugs the worker owns; a page can't take them.
export const RESERVED = ['admin', 'api', 'go', 'media', 'assets', 'src', 'node_modules', '@vite', '@id', '@fs', 'favicon.ico', 'robots.txt']

export const cleanSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

export const validSlug = (s: string) => s === '' || (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && !RESERVED.includes(s))

export const uid = () => Math.random().toString(36).slice(2, 10)
