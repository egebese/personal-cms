async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch('/api' + path, init)
  const j: any = await r.json().catch(() => ({ error: `Request failed (${r.status})` }))
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`)
  return j
}
const send = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  me: () => call<{ admin: boolean; configured: { password: boolean; fal: boolean } }>('/me'),
  login: (password: string) => call('/login', send('POST', { password })),
  logout: () => call('/logout', { method: 'POST' }),
  state: () => call('/state'),
  save: (site: unknown, pages: unknown) => call('/state', send('PUT', { site, pages })),
  unfurl: (url: string) => call<{ type: string; size?: string; data: any }>('/unfurl', send('POST', { url })),
  chat: (messages: unknown[], context: unknown) => call<{ message: any; usage?: any }>('/chat', send('POST', { messages, context })),
  analytics: (q: string) => call('/analytics?' + q),
  upload: (file: Blob) => call<{ url: string }>('/upload', { method: 'POST', headers: { 'content-type': file.type }, body: file }),
  transcribe: (audio: Blob) => call<{ text: string }>('/transcribe', { method: 'POST', headers: { 'content-type': audio.type || 'audio/webm' }, body: audio }),
  // NDJSON stream of progress events.
  async import(urls: string[], note: string, onEvent: (e: any) => void) {
    const r = await fetch('/api/import', send('POST', { urls, note }))
    if (!r.ok || !r.body) throw new Error(((await r.json().catch(() => ({}))) as any).error || `Import failed (${r.status})`)
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += value
      const lines = buf.split('\n')
      buf = lines.pop()!
      for (const l of lines) if (l.trim()) onEvent(JSON.parse(l))
    }
  },
}
