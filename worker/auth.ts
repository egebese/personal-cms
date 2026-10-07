import type { Env } from './env'

const enc = new TextEncoder()
const COOKIE = 'lw_session'
const DAYS = 30

const key = (env: Env) =>
  crypto.subtle.importKey('raw', enc.encode('lw-session:' + env.ADMIN_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256(s: string) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))
}

// Compares digests so the check takes the same time whatever the input.
export async function passwordOk(env: Env, given: string) {
  if (!env.ADMIN_PASSWORD) return false
  const [a, b] = await Promise.all([sha256(given), sha256(env.ADMIN_PASSWORD)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function sessionCookie(env: Env, url: URL) {
  const exp = Date.now() + DAYS * 864e5
  const sig = hex(await crypto.subtle.sign('HMAC', await key(env), enc.encode(String(exp))))
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`

export async function isAdmin(env: Env, req: Request) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|; )${COOKIE}=(\\d+)\\.([0-9a-f]+)`))
  if (!m || Number(m[1]) < Date.now() || !env.ADMIN_PASSWORD) return false
  const sig = new Uint8Array(m[2].match(/../g)!.map((h) => parseInt(h, 16)))
  return crypto.subtle.verify('HMAC', await key(env), sig, enc.encode(m[1]))
}
