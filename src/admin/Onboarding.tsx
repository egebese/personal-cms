import { useState } from 'react'
import { api } from './api'
import { edit } from './store'
import { startBuild } from './agent'
import { brandOf } from '../shared/blocks'
import { uid } from '../shared/types'
import { Icon, Logo } from './ui'

type Row = { url: string; status: 'start' | 'ok' | 'fail'; source?: string; error?: string }
const PLACEHOLDERS = ['instagram.com/you', 'x.com/you', 'github.com/you', 'your old linktr.ee/you', 'yoursite.com']

export function Onboarding({ falReady, onClose }: { falReady: boolean; onClose?: () => void }) {
  const [urls, setUrls] = useState<string[]>(['', '', ''])
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<'form' | 'run'>('form')
  const [rows, setRows] = useState<Row[]>([])
  const [steps, setSteps] = useState<Record<string, 'start' | 'ok'>>({})
  const [err, setErr] = useState('')

  const filled = urls.map((u) => u.trim()).filter(Boolean)

  const build = async () => {
    setPhase('run'); setErr(''); setRows([]); setSteps({})
    try {
      await api.import(filled, note, (e) => {
        if (e.step === 'scrape') setRows((r) => [...r.filter((x) => x.url !== e.url), { url: e.url, status: e.status, source: e.source, error: e.error }])
        else if (e.step === 'error') setErr(e.error)
        else if (e.step === 'done') { startBuild(e.site, e.pages); onClose?.() }
        else setSteps((s) => ({ ...s, [e.step]: e.status }))
      })
    } catch (e: any) { setErr(e.message) }
  }

  const scratch = () => {
    edit((d) => { d.pages = [{ id: uid(), slug: '', title: 'Home', blocks: [] }] })
    onClose?.()
  }

  if (phase === 'run') {
    return (
      <div className="ob">
        <div className="ob-card">
          <Logo />
          <h1 className="ob-title">Building your page</h1>
          <ul className="ob-steps">
            {rows.map((r) => (
              <li key={r.url} className={r.status}>
                <Status s={r.status} />
                <span>{r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                <em>{r.status === 'ok' ? r.source : r.status === 'fail' ? 'could not read, kept the link' : 'reading'}</em>
              </li>
            ))}
            {steps.ai && <li className={steps.ai}><Status s={steps.ai} /><span>Choosing blocks and layout</span></li>}
            {steps.images && <li className={steps.images}><Status s={steps.images} /><span>Saving photos and repo stats</span></li>}
          </ul>
          {err && (
            <>
              <p className="ad-error">{err}</p>
              <div className="ob-actions">
                <button className="ad-btn ad-primary" onClick={build}>Try again</button>
                <button className="ad-btn" onClick={() => setPhase('form')}>Edit links</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ob">
      <form className="ob-card" onSubmit={(e) => { e.preventDefault(); if (filled.length || note.trim()) build() }}>
        <div className="ob-head">
          <Logo />
          {onClose && <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>}
        </div>
        <h1 className="ob-title">Where are you online?</h1>
        <p className="ad-muted">Wizz reads these pages and builds your site from them: photo, bio, links, projects and papers. You can change everything after.</p>
        {!falReady && <p className="ad-error">AI setup needs the <code>FAL_KEY</code> secret. You can still start from scratch.</p>}
        <div className="ob-urls">
          {urls.map((u, i) => {
            const b = brandOf(/^https?:/.test(u) ? u : 'https://' + u)
            return (
              <label key={i} className="ob-url">
                <span className="ob-brand" style={b ? { background: '#' + b.hex } : undefined}>
                  {b ? <svg viewBox="0 0 24 24" fill="#fff"><path d={b.path} /></svg> : <Icon name="link" size={16} />}
                </span>
                <input
                  value={u}
                  placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
                  inputMode="url"
                  autoCapitalize="off"
                  aria-label={`Link ${i + 1}`}
                  onChange={(e) => {
                    const n = urls.map((x, j) => (j === i ? e.target.value : x))
                    if (i === n.length - 1 && e.target.value && n.length < 12) n.push('')
                    setUrls(n)
                  }}
                />
              </label>
            )
          })}
        </div>
        <label className="ad-field">
          <span>Anything else? <em>optional</em></span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="I'm a researcher working on video models. Put my papers first, keep it minimal." />
        </label>
        <div className="ob-actions">
          <button className="ad-btn ad-primary" disabled={!falReady || !(filled.length || note.trim())}><Icon name="sparkle" size={16} /> Build my page</button>
          <button type="button" className="ad-btn" onClick={onClose || scratch}>{onClose ? 'Cancel' : 'Start from scratch'}</button>
        </div>
      </form>
    </div>
  )
}

const Status = ({ s }: { s: string }) =>
  s === 'start' ? <span className="ad-spinner sm" /> : s === 'ok' ? <span className="ob-dot ok">✓</span> : <span className="ob-dot fail">!</span>
