import type { Env } from './env'
import { sha256 } from './auth'
import { parseUA, refHost } from './ua'

export async function logEvent(env: Env, req: Request, kind: 'view' | 'click', e: { page: string; block?: string; item?: number; url?: string }) {
  const ua = req.headers.get('user-agent') || ''
  const ip = req.headers.get('cf-connecting-ip') || ''
  const day = new Date().toISOString().slice(0, 10)
  // Daily-rotating hash: counts unique visitors per day without storing IPs or setting cookies.
  const visitor = (await sha256(`${day}|${ip}|${ua}|${env.ADMIN_PASSWORD}`)).slice(0, 16)
  const cf = (req as any).cf || {}
  const { device, browser, os } = parseUA(ua)
  const self = new URL(req.url).hostname
  const ref = req.headers.get('referer')
  // On a click the referer is our own page, so its utm params still describe the visit.
  let utm = ''
  try {
    const q = kind === 'view' ? new URL(req.url).searchParams : new URL(ref || '').searchParams
    utm = q.get('utm_source') || q.get('ref') || ''
  } catch {}
  await env.DB.prepare(
    `INSERT INTO events (ts, kind, page, block, item, url, visitor, country, city, device, browser, os, referrer, utm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    Date.now(), kind, e.page, e.block ?? null, e.item ?? null, e.url ?? null, visitor,
    cf.country || null, cf.city || null, device, browser, os,
    kind === 'view' ? refHost(ref, self) : null, utm.slice(0, 60) || null,
  ).run()
}

const DIMS = ['referrer', 'country', 'city', 'device', 'browser', 'os', 'utm', 'page'] as const
const RANGES: Record<string, [number, number]> = { // [span, bucket]
  '24h': [864e5, 36e5], '7d': [7 * 864e5, 864e5], '30d': [30 * 864e5, 864e5], '90d': [90 * 864e5, 864e5],
}

export async function report(env: Env, q: URLSearchParams) {
  const [span, bucket] = RANGES[q.get('range') || '7d'] || RANGES['7d']
  const off = Math.max(-840, Math.min(840, Number(q.get('tz')) || 0)) * 60e3 // browser's offset from UTC
  const now = Date.now()
  const since = Math.floor((now + off) / bucket) * bucket - off - span + bucket
  // Optional drill-down filter, e.g. f=country:TR. Column names come from the whitelist, never the query.
  const [fk, ...fv] = (q.get('f') || '').split(':')
  const filter = (DIMS as readonly string[]).includes(fk) && fv.length ? ` AND ${fk} IS ?` : ''
  const args = filter ? [since, fv.join(':') === 'null' ? null : fv.join(':')] : [since]
  const where = `WHERE ts >= ?${filter}`
  const all = <T,>(sql: string) => env.DB.prepare(sql).bind(...args).all<T>().then((r) => r.results)

  const [totals, series, blocks, ...dims] = await Promise.all([
    all<any>(`SELECT SUM(kind = 'view') views, SUM(kind = 'click') clicks, COUNT(DISTINCT CASE WHEN kind = 'view' THEN visitor END) visitors FROM events ${where}`),
    all<any>(`SELECT ((ts + ${off}) / ${bucket}) * ${bucket} - ${off} t, SUM(kind = 'view') views, SUM(kind = 'click') clicks,
              COUNT(DISTINCT CASE WHEN kind = 'view' THEN visitor END) visitors FROM events ${where} GROUP BY t ORDER BY t`),
    all<any>(`SELECT page, block, item, MAX(url) url, COUNT(*) clicks FROM events ${where} AND kind = 'click'
              GROUP BY page, block, item ORDER BY clicks DESC LIMIT 25`),
    ...DIMS.map((d) => all<any>(`SELECT ${d} k, SUM(kind = 'view') views, SUM(kind = 'click') clicks FROM events ${where}
              GROUP BY k ORDER BY views DESC, clicks DESC LIMIT 12`)),
  ])
  const byT = new Map(series.map((s) => [s.t, s]))
  const filled = []
  for (let t = since; t <= now; t += bucket) filled.push(byT.get(t) || { t, views: 0, clicks: 0, visitors: 0 })
  return {
    range: { since, bucket },
    totals: { views: totals[0]?.views || 0, clicks: totals[0]?.clicks || 0, visitors: totals[0]?.visitors || 0 },
    series: filled,
    blocks,
    dims: Object.fromEntries(DIMS.map((d, i) => [d, dims[i]])),
  }
}
