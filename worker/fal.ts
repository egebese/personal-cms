import type { Env } from './env'

const auth = (env: Env) => ({ Authorization: 'Key ' + env.FAL_KEY })

export class FalError extends Error {}

// fal's OpenRouter router speaks the OpenAI chat.completions protocol, tools included.
export async function chat(env: Env, body: Record<string, unknown>) {
  if (!env.FAL_KEY) throw new FalError('FAL_KEY is not set. Add it as a Worker secret.')
  const r = await fetch('https://fal.run/openrouter/router/openai/v1/chat/completions', {
    method: 'POST',
    headers: { ...auth(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.AI_MODEL || 'anthropic/claude-sonnet-4.6', ...body }),
  })
  const text = await r.text()
  if (!r.ok) throw new FalError(`AI request failed (${r.status}): ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

// Wizper only takes a hosted file, so the clip goes to fal storage first.
export async function transcribe(env: Env, audio: ArrayBuffer, type: string) {
  if (!env.FAL_KEY) throw new FalError('FAL_KEY is not set. Add it as a Worker secret.')
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: { ...auth(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: type, file_name: 'voice.' + (type.split('/')[1]?.split(';')[0] || 'webm') }),
  })
  if (!init.ok) throw new FalError(`Upload failed (${init.status})`)
  const { upload_url, file_url } = await init.json<any>()
  const put = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': type }, body: audio })
  if (!put.ok) throw new FalError(`Upload failed (${put.status})`)
  // language: null = auto-detect. Leaving it out makes Wizper translate to English.
  const r = await fetch('https://fal.run/fal-ai/wizper', {
    method: 'POST',
    headers: { ...auth(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: file_url, task: 'transcribe', language: null }),
  })
  if (!r.ok) throw new FalError(`Transcription failed (${r.status}): ${(await r.text()).slice(0, 200)}`)
  const j = await r.json<any>()
  return String(j.text || '').trim()
}
