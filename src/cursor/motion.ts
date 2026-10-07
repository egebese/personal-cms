// Pure motion math for the Wizz cursor. Modelled on Cua Driver's six motions:
// signature_arc, spring_settle, magnetic, comet_swoop, adaptive, classic; with fitts / native / fixed timing.
import type { CursorStyle, CursorTiming } from '../shared/types'

export type Pt = { x: number; y: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInQuad = (t: number) => t * t
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2)
const easeOutBack = (t: number, s = 0.9) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2

// Fitts's law: time grows with log2(distance / target width + 1).
export function duration(timing: CursorTiming, d: number, w: number) {
  if (timing === 'fixed') return 650
  if (timing === 'native') return clamp(220 + 0.45 * d, 200, 900)
  return clamp(180 + 140 * Math.log2(d / Math.max(w, 8) + 1), 260, 1100)
}

// "Careful" = short hop or small target: adaptive switches behaviour on this.
const careful = (d: number, w: number) => d < 260 || w < 36

const BEND: Record<CursorStyle, number> = { classic: 0, signature_arc: 0.16, spring_settle: 0.12, magnetic: 0.08, comet_swoop: 0.32, adaptive: 0.2 }
const SLOW: Record<CursorStyle, number> = { classic: 1, signature_arc: 1, spring_settle: 1.15, magnetic: 1.2, comet_swoop: 1.1, adaptive: 1 }

// Progress along the path (may overshoot past 1 for follow-through and bounce).
export function progress(style: CursorStyle, t: number, d = 500, w = 80): number {
  t = clamp(t, 0, 1)
  switch (style) {
    case 'classic': return easeInOutCubic(t)
    case 'signature_arc': return easeOutBack(t, 0.9) // one arc, small follow-through past the target
    case 'spring_settle': return 1 - Math.exp(-7 * t) * Math.cos(8 * t) // overshoots ~6% once, then settles
    case 'magnetic': // glides in, hovers near the target, then gets pulled the last 12%
      return t < 0.7 ? 0.88 * easeOutCubic(t / 0.7) : 0.88 + 0.12 * easeInQuad((t - 0.7) / 0.3)
    case 'comet_swoop': return easeInOutQuart(t)
    case 'adaptive': return careful(d, w) ? progress('magnetic', t) : progress('comet_swoop', t)
  }
}

export interface Plan { ms: number; at: (t: number) => Pt; trail: boolean; magnet: boolean }

export function plan(style: CursorStyle, timing: CursorTiming, from: Pt, to: Pt, targetW = 80): Plan {
  const dx = to.x - from.x, dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  const bendK = style === 'adaptive' ? (careful(d, targetW) ? 0.04 : 0.22) : BEND[style]
  // Control point bows the path upward-ish, like a wrist arc.
  const nx = d ? -dy / d : 0, ny = d ? dx / d : 0
  const side = dx >= 0 ? -1 : 1
  const c = { x: (from.x + to.x) / 2 + nx * d * bendK * side, y: (from.y + to.y) / 2 + ny * d * bendK * side }
  const bez = (u: number): Pt => ({
    x: (1 - u) ** 2 * from.x + 2 * (1 - u) * u * c.x + u * u * to.x,
    y: (1 - u) ** 2 * from.y + 2 * (1 - u) * u * c.y + u * u * to.y,
  })
  const ms = d < 2 ? 0 : duration(timing, d, targetW) * SLOW[style]
  return {
    ms,
    // Past u=1 the quadratic extrapolates along its own tangent, which is exactly the overshoot direction we want.
    at: (t) => (t >= 1 ? to : bez(progress(style, t, d, targetW))),
    trail: style === 'comet_swoop' || (style === 'adaptive' && !careful(d, targetW)),
    magnet: style === 'magnetic' || (style === 'adaptive' && careful(d, targetW)),
  }
}
