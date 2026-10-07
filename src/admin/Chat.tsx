import { useEffect, useRef, useState } from 'react'
import { runAgent, type ChatMsg } from './agent'
import { api } from './api'
import { Icon } from './ui'

// Kept outside the component so switching tabs doesn't lose the conversation.
let saved: ChatMsg[] = []

const ACTION: Record<string, (a: any) => string> = {
  add_block: (a) => `Added ${a.type}${a.data?.title ? `: ${a.data.title}` : ''}`,
  update_block: (a) => `Edited a block${a.size ? ` (size ${a.size})` : ''}`,
  remove_block: () => 'Removed a block',
  move_block: (a) => `Moved a block to position ${Number(a.index) + 1}`,
  update_profile: (a) => `Updated ${Object.keys(a).join(', ')}`,
  set_theme: (a) => `Theme: ${Object.values(a).join(', ')}`,
  add_page: (a) => `Created page /${a.slug}`,
  update_page: () => 'Updated page',
  open_page: (a) => `Opened /${a.slug}`,
  lookup_url: (a) => `Read ${a.url}`,
}

const SUGGESTIONS = [
  'Group my social links under a "Find me" title',
  'Make the first block large',
  'Switch to a dark theme with a green accent',
  'Add https://github.com/trycua/cua',
]

export function Chat({ falReady }: { falReady: boolean }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(saved)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const stop = useRef({ stop: false })
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => { saved = msgs; list.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [msgs])

  const send = async (text: string) => {
    text = text.trim()
    if (!text || busy) return
    setErr('')
    setInput('')
    setBusy(true)
    stop.current = { stop: false }
    const next = [...msgs, { role: 'user' as const, content: text }]
    setMsgs(next)
    try {
      await runAgent(next, (h) => { saved = h; setMsgs(h) }, stop.current)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Tool results keyed by call id, to mark failed actions.
  const results = new Map(msgs.filter((m) => m.role === 'tool').map((m) => [m.tool_call_id, m.content || '']))

  return (
    <div className="ad-chat">
      <div className="ad-chat-log" ref={list} aria-live="polite">
        {!msgs.length && (
          <div className="ad-chat-hello">
            <p><strong>Wizz edits your page for you.</strong> Type, or tap the mic and say what to change. You'll see it happen.</p>
            {!falReady && <p className="ad-error">Set the <code>FAL_KEY</code> secret to turn the assistant on.</p>}
            <div className="ad-chips">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} disabled={!falReady}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => {
          if (m.role === 'user') return <p key={i} className="ad-msg ad-msg-me">{m.content}</p>
          if (m.role === 'tool') return null
          return (
            <div key={i} className="ad-msg-ai">
              {m.content && <p className="ad-msg"><Rich text={m.content} /></p>}
              {m.tool_calls?.map((c) => {
                let a: any = {}
                try { a = JSON.parse(c.function.arguments || '{}') } catch {}
                const r = results.get(c.id)
                const failed = r?.includes('"error"')
                return (
                  <div key={c.id} className={'ad-action' + (failed ? ' fail' : '') + (r == null ? ' run' : '')}>
                    <i aria-hidden />{(ACTION[c.function.name] || (() => c.function.name))(a)}
                    {failed && <em>{JSON.parse(r!).error}</em>}
                  </div>
                )
              })}
            </div>
          )
        })}
        {busy && <div className="ad-typing" aria-label="Wizz is working"><span /><span /><span /></div>}
        {err && <p className="ad-error">{err}</p>}
      </div>
      <form className="ad-composer" onSubmit={(e) => { e.preventDefault(); send(input) }}>
        <textarea
          value={input}
          rows={1}
          placeholder={busy ? 'Wizz is working…' : 'Ask Wizz to change something'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } }}
          disabled={!falReady}
          aria-label="Message"
        />
        <Mic disabled={busy || !falReady} onText={(t) => send(t)} onError={setErr} />
        {busy
          ? <button type="button" className="ad-round" onClick={() => { stop.current.stop = true }} aria-label="Stop"><Icon name="stop" size={16} /></button>
          : <button className="ad-round ad-primary" data-cursor="chat-send" disabled={!input.trim() || !falReady} aria-label="Send"><Icon name="send" size={16} /></button>}
      </form>
    </div>
  )
}

// Models still reach for **bold** and `code`; render just those two.
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((t, i) =>
    t.startsWith('**') ? <strong key={i}>{t.slice(2, -2)}</strong> : t.startsWith('`') ? <code key={i}>{t.slice(1, -1)}</code> : t)}</>
}

// Click to record, click again to send. Audio goes to Wizper; the text is sent as a message.
function Mic({ disabled, onText, onError }: { disabled: boolean; onText: (t: string) => void; onError: (e: string) => void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'wait'>('idle')
  const [level, setLevel] = useState(0)
  const [secs, setSecs] = useState(0)
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; ctx: AudioContext; raf: number; t: any } | null>(null)

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
        if (blob.size < 2000) { setState('idle'); onError('That recording was too short. Click the mic, talk, then click it again.'); return }
        setState('wait')
        try {
          const { text } = await api.transcribe(blob)
          if (text) onText(text)
          else onError("Didn't catch that. Try again a little closer to the mic.")
        } catch (e: any) { onError(e.message) } finally { setState('idle') }
      }
      // Level meter so you can see it's listening.
      const ctx = new AudioContext()
      const an = ctx.createAnalyser()
      an.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.frequencyBinCount)
      const tick = () => {
        an.getByteTimeDomainData(buf)
        let peak = 0
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
        setLevel(peak / 128)
        rec.current!.raf = requestAnimationFrame(tick)
      }
      const t0 = Date.now()
      rec.current = { mr, stream, ctx, raf: 0, t: setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 250) }
      tick()
      mr.start()
      setSecs(0)
      setState('rec')
    } catch {
      onError('Microphone access was blocked. Allow it in the browser to talk to Wizz.')
    }
  }

  const finish = () => {
    const r = rec.current
    if (!r) return
    cancelAnimationFrame(r.raf)
    clearInterval(r.t)
    r.mr.stop()
    r.stream.getTracks().forEach((t) => t.stop())
    r.ctx.close()
    rec.current = null
  }
  useEffect(() => () => finish(), [])

  return (
    <button
      type="button"
      className={'ad-round ad-mic ' + state}
      style={{ ['--lvl' as any]: level.toFixed(2) }}
      disabled={disabled && state === 'idle'}
      onClick={() => (state === 'rec' ? finish() : state === 'idle' && start())}
      aria-label={state === 'rec' ? 'Stop and send' : 'Talk to Wizz'}
      aria-pressed={state === 'rec'}
    >
      {state === 'wait' ? <span className="ad-spinner sm" /> : <Icon name="mic" size={16} />}
      {state === 'rec' && <span className="ad-mic-time">0:{String(secs).padStart(2, '0')}</span>}
    </button>
  )
}
