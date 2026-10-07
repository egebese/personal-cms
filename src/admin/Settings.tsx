import { useRef, useState } from 'react'
import { edit, getState, useStore } from './store'
import { api } from './api'
import { cursor, sleep } from '../cursor/cursor'
import type { CursorStyle, CursorTiming } from '../shared/types'
import { Icon } from './ui'

const STYLES: [CursorStyle, string, string][] = [
  ['adaptive', 'Adaptive', 'Careful for small targets, a swoop for long moves.'],
  ['signature_arc', 'Signature arc', 'One confident arc with a small follow-through.'],
  ['spring_settle', 'Spring settle', 'An arc that lands with one soft bounce.'],
  ['magnetic', 'Magnetic', 'Slows near the target, then is pulled in.'],
  ['comet_swoop', 'Comet swoop', 'A wide arc with a short trail.'],
  ['classic', 'Classic', 'The original straight glide.'],
]
const TIMINGS: [CursorTiming, string][] = [['fitts', 'Fitts'], ['native', 'Native'], ['fixed', 'Fixed']]
const EFFECTS = ['trail', 'glow', 'ripple', 'squish', 'magnet'] as const

export function Settings({ onRebuild }: { onRebuild: () => void }) {
  const site = useStore((s) => s.site)
  const c = site.cursor
  const stage = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)

  const play = async () => {
    if (playing) return
    setPlaying(true)
    const s = getState().site
    cursor.configure(s.cursor, s.theme.accent)
    const targets = [...stage.current!.querySelectorAll('.st-target')]
    const r = stage.current!.getBoundingClientRect()
    cursor.show({ x: r.left + 20, y: r.bottom - 20 })
    for (const t of [targets[0], targets[2], targets[1], targets[3], targets[0]]) {
      await cursor.moveTo(t, 'click')
      await cursor.click()
      await sleep(120)
    }
    cursor.hideSoon(600)
    setPlaying(false)
  }

  const exportJson = () => {
    const s = getState()
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([JSON.stringify({ site: s.site, pages: s.pages }, null, 2)], { type: 'application/json' })),
      download: `linkwizz-${new Date().toISOString().slice(0, 10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="st">
      <section className="st-section">
        <h2>Wizz cursor</h2>
        <p className="ad-muted">How the assistant's cursor moves when it edits your page.</p>
        <div className="st-styles" role="radiogroup" aria-label="Motion">
          {STYLES.map(([k, label, desc]) => (
            <button key={k} role="radio" aria-checked={c.style === k} onClick={() => edit((d) => { d.site.cursor.style = k })}>
              <strong>{label}</strong><span>{desc}</span>
            </button>
          ))}
        </div>
        <div className="st-row">
          <div className="ad-field">
            <span>Timing</span>
            <div className="ad-seg" role="group">
              {TIMINGS.map(([k, label]) => <button key={k} aria-pressed={c.timing === k} onClick={() => edit((d) => { d.site.cursor.timing = k })}>{label}</button>)}
            </div>
          </div>
          <div className="ad-field">
            <span>Effects</span>
            <div className="st-toggles">
              {EFFECTS.map((e) => (
                <label key={e} className="st-toggle">
                  <input type="checkbox" checked={c.effects[e]} onChange={(x) => edit((d) => { d.site.cursor.effects[e] = x.target.checked })} />
                  {e[0].toUpperCase() + e.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="st-stage" ref={stage}>
          <span className="st-target" style={{ left: '8%', top: '18%' }}>Small</span>
          <span className="st-target big" style={{ right: '6%', top: '14%' }}>Large card</span>
          <span className="st-target" style={{ left: '40%', bottom: '14%' }}>Button</span>
          <span className="st-target big" style={{ left: '12%', bottom: '10%', width: 90 }}>Tile</span>
          <button className="ad-btn ad-primary st-play" onClick={play} disabled={playing}>{playing ? 'Playing…' : 'Preview motion'}</button>
        </div>
      </section>

      <section className="st-section">
        <h2>Rebuild with AI</h2>
        <p className="ad-muted">Give Wizz your links again and it lays out a fresh site. Your current pages are replaced, and you can undo it.</p>
        <button className="ad-btn" onClick={onRebuild}><Icon name="sparkle" size={16} /> Rebuild from my links</button>
      </section>

      <section className="st-section">
        <h2>Your domain</h2>
        <p className="ad-muted">
          Your site is live at <strong>{location.host}</strong>. To use your own domain, open the Cloudflare dashboard,
          go to Workers &amp; Pages, pick this Worker, then Settings, Domains &amp; Routes, and add a custom domain. The domain must be on your Cloudflare account.
        </p>
      </section>

      <section className="st-section">
        <h2>Data</h2>
        <div className="st-row">
          <button className="ad-btn" onClick={exportJson}>Download a backup (JSON)</button>
          <button className="ad-btn" onClick={async () => { await api.logout(); location.reload() }}>Sign out</button>
        </div>
      </section>
    </div>
  )
}
