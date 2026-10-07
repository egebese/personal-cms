import { useEffect, useState } from 'react'
import { api } from './api'
import { getState, load, redo, undo, useStore, save } from './store'
import { Editor } from './Editor'
import { Analytics } from './Analytics'
import { Settings } from './Settings'
import { Onboarding } from './Onboarding'
import { Logo, Icon } from './ui'

type Tab = 'editor' | 'analytics' | 'settings'
const tabFromHash = (): Tab => (location.hash.replace('#/', '') as Tab) || 'editor'

export function App() {
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading')
  const [config, setConfig] = useState({ password: true, fal: true })
  const [err, setErr] = useState('')

  const boot = async () => {
    try {
      const me = await api.me()
      setConfig(me.configured)
      if (!me.admin) return setAuth('out')
      await load()
      setAuth('in')
    } catch (e: any) { setErr(e.message) }
  }
  useEffect(() => { boot() }, [])

  if (err) return <div className="ad-center"><p className="ad-error">{err}</p></div>
  if (auth === 'loading') return <div className="ad-center"><span className="ad-spinner" /></div>
  if (auth === 'out') return <Login configured={config.password} onDone={boot} />
  return <Shell falReady={config.fal} />
}

function Login({ configured, onDone }: { configured: boolean; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try { await api.login(pw); onDone() } catch (x: any) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="ad-center ad-login">
      <form onSubmit={submit} className="ad-login-card">
        <Logo />
        {configured ? (
          <>
            <label className="ad-field">
              <span>Password</span>
              <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            </label>
            {err && <p className="ad-error">{err}</p>}
            <button className="ad-btn ad-primary" disabled={busy || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </>
        ) : (
          <p className="ad-muted">Set the <code>ADMIN_PASSWORD</code> secret on this Worker, then reload. Locally, put it in <code>.dev.vars</code>.</p>
        )}
      </form>
    </div>
  )
}

function Shell({ falReady }: { falReady: boolean }) {
  const [tab, setTab] = useState<Tab>(tabFromHash())
  const pages = useStore((s) => s.pages)
  const saveState = useStore((s) => s.save)
  const saveError = useStore((s) => s.saveError)
  const [rebuild, setRebuild] = useState(false)

  useEffect(() => {
    const on = () => setTab(tabFromHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, [contenteditable]')
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
    }
    const leave = (e: BeforeUnloadEvent) => { if (getState().save !== 'saved') e.preventDefault() }
    addEventListener('keydown', key)
    addEventListener('beforeunload', leave)
    return () => { removeEventListener('keydown', key); removeEventListener('beforeunload', leave) }
  }, [])

  if (!pages.length || rebuild) return <Onboarding falReady={falReady} onClose={pages.length ? () => setRebuild(false) : undefined} />

  const go = (t: Tab) => { location.hash = '#/' + t }
  return (
    <div className="ad-shell">
      <header className="ad-top">
        <Logo />
        <nav className="ad-tabs" aria-label="Sections">
          {(['editor', 'analytics', 'settings'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
              {t === 'editor' ? 'Editor' : t === 'analytics' ? 'Analytics' : 'Settings'}
            </button>
          ))}
        </nav>
        <div className="ad-top-right">
          <span className={'ad-save ad-save-' + saveState} title={saveError}>
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Unsaved'}
          </span>
          {saveState === 'error' && <button className="ad-btn ad-small" onClick={save}>Retry</button>}
          <a className="ad-btn ad-small" href="/" target="_blank" rel="noopener"><Icon name="external" /> <span className="ad-hide-sm">View site</span></a>
        </div>
      </header>
      {tab === 'editor' && <Editor falReady={falReady} />}
      {tab === 'analytics' && <Analytics />}
      {tab === 'settings' && <Settings onRebuild={() => setRebuild(true)} />}
    </div>
  )
}
