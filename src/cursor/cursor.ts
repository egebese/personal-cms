// The Wizz cursor: an imperative overlay the AI agent drives so every edit is visible.
import { plan, type Pt } from './motion'
import { defaultSite, type Site } from '../shared/types'

export type Action = 'idle' | 'observe' | 'click' | 'drag' | 'text' | 'navigate'
const LABELS: Record<Action, string> = { idle: '', observe: 'Looking', click: 'Clicking', drag: 'Moving', text: 'Typing', navigate: 'Opening' }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const frame = () => new Promise((r) => requestAnimationFrame(r))
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

class WizzCursor {
  prefs: Site['cursor'] = defaultSite().cursor
  accent = '#3d2bff'
  pos: Pt = { x: innerWidth - 120, y: innerHeight - 80 }
  private el?: HTMLDivElement
  private label?: HTMLElement
  private canvas?: HTMLCanvasElement
  private trail: { x: number; y: number; t: number }[] = []
  private drawing = false
  private hideTimer: any

  private mount() {
    if (this.el) return
    this.el = document.createElement('div')
    this.el.className = 'wz-cursor'
    this.el.setAttribute('aria-hidden', 'true')
    this.el.innerHTML = `<svg class="wz-arrow" viewBox="0 0 28 28"><path d="M4 2.5 23.5 12 14 14.4 9.8 23.6z"/></svg>
      <span class="wz-tag"><b>Wizz</b><em></em></span>`
    this.label = this.el.querySelector('em')!
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'wz-trail'
    document.body.append(this.canvas, this.el)
    this.place()
  }

  configure(prefs: Site['cursor'], accent: string) {
    this.prefs = prefs
    this.accent = accent
    this.el?.style.setProperty('--wz', accent)
  }

  private place() {
    this.el!.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px)`
  }

  show(from?: Pt) {
    this.mount()
    clearTimeout(this.hideTimer)
    if (from && !this.el!.classList.contains('on')) { this.pos = from; this.place() }
    this.el!.style.setProperty('--wz', this.accent)
    this.el!.classList.toggle('glow', this.prefs.effects.glow)
    this.el!.classList.add('on')
  }

  hideSoon(ms = 1800) {
    clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => { this.el?.classList.remove('on'); this.state('idle') }, ms)
  }

  state(a: Action, text?: string) {
    this.mount()
    this.el!.dataset.action = a
    this.label!.textContent = text ?? LABELS[a]
  }

  // Moves to an element (scrolling it into view first) or a point, using the configured motion.
  async moveTo(target: Element | Pt | null, action: Action = 'observe', text?: string) {
    if (!target) return
    this.show()
    this.state(action, text)
    let to: Pt, w = 80
    if (target instanceof Element) {
      const r0 = target.getBoundingClientRect()
      if (r0.bottom < 60 || r0.top > innerHeight - 60) {
        target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })
        await sleep(reduced() ? 0 : 420)
      }
      const r = target.getBoundingClientRect()
      w = Math.min(r.width, r.height)
      // Aim a little left of centre with a few px of jitter, like a hand would.
      to = { x: r.left + r.width * (r.width > 120 ? 0.42 : 0.5) + (Math.random() * 8 - 4), y: r.top + r.height * 0.5 + (Math.random() * 8 - 4) }
    } else to = target

    const p = plan(this.prefs.style, this.prefs.timing, this.pos, to, w)
    const ms = reduced() ? 0 : p.ms
    const withTrail = this.prefs.effects.trail && (p.trail || this.prefs.style !== 'classic') && ms > 0
    const start = performance.now()
    for (;;) {
      const t = ms ? Math.min(1, (performance.now() - start) / ms) : 1
      this.pos = p.at(t)
      this.place()
      if (withTrail) this.addTrail()
      if (t >= 1) break
      await frame()
    }
    if (target instanceof Element && this.prefs.effects.magnet && p.magnet && !reduced()) this.magnet(target)
  }

  async click() {
    this.state('click')
    if (this.prefs.effects.squish) this.el!.animate([{ scale: 1 }, { scale: 0.82 }, { scale: 1 }], { duration: 220, easing: 'ease-out' })
    if (this.prefs.effects.ripple && !reduced()) {
      const r = document.createElement('span')
      r.className = 'wz-ripple'
      r.style.cssText = `left:${this.pos.x}px;top:${this.pos.y}px;--wz:${this.accent}`
      document.body.append(r)
      r.animate([{ scale: 0.2, opacity: 0.55 }, { scale: 1, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => r.remove())
    }
    await sleep(reduced() ? 0 : 180)
  }

  private magnet(el: Element) {
    const r = el.getBoundingClientRect()
    const dx = (this.pos.x - (r.left + r.width / 2)) / r.width * 6
    const dy = (this.pos.y - (r.top + r.height / 2)) / r.height * 6
    el.animate([{ translate: '0 0' }, { translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 360, easing: 'ease-out' })
  }

  private addTrail() {
    this.trail.push({ ...this.pos, t: performance.now() })
    if (!this.drawing) { this.drawing = true; requestAnimationFrame(this.draw) }
  }

  private draw = () => {
    const c = this.canvas!, ctx = c.getContext('2d')!
    const dpr = devicePixelRatio || 1
    if (c.width !== innerWidth * dpr) { c.width = innerWidth * dpr; c.height = innerHeight * dpr }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    const now = performance.now(), life = 260
    this.trail = this.trail.filter((p) => now - p.t < life)
    ctx.lineCap = 'round'
    ctx.strokeStyle = this.accent
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i]
      const k = 1 - (now - b.t) / life
      ctx.globalAlpha = k * 0.55
      ctx.lineWidth = 1 + k * 5
      ctx.beginPath(); ctx.moveTo(a.x + 4, a.y + 3); ctx.lineTo(b.x + 4, b.y + 3); ctx.stroke()
    }
    if (this.trail.length) requestAnimationFrame(this.draw)
    else this.drawing = false
  }
}

export const cursor = new WizzCursor()
export { sleep, frame }
