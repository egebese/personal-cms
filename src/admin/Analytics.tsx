import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from './api'
import { useStore } from './store'
import { BLOCKS, host } from '../shared/blocks'

type Metric = 'views' | 'visitors' | 'clicks' | 'ctr'
const RANGES = ['24h', '7d', '30d', '90d']
const fmt = new Intl.NumberFormat()
const regions = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }) } catch { return null } })()
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '')

export function Analytics() {
  const [range, setRange] = useState('7d')
  const [filter, setFilter] = useState<{ k: string; v: string } | null>(null)
  const [metric, setMetric] = useState<Metric>('views')
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  const pages = useStore((s) => s.pages)

  useEffect(() => {
    const q = new URLSearchParams({ range, tz: String(-new Date().getTimezoneOffset()) })
    if (filter) q.set('f', `${filter.k}:${filter.v}`)
    setErr('')
    api.analytics(q.toString()).then(setData, (e) => setErr(e.message))
  }, [range, filter])

  const pageName = (id: string) => { const p = pages.find((x) => x.id === id); return p ? p.title + (p.slug ? ` /${p.slug}` : '') : 'Deleted page' }
  const blockName = (pid: string, bid: string, item: number, url: string) => {
    const b = pages.find((p) => p.id === pid)?.blocks.find((x) => x.id === bid)
    if (!b) return host(url) || 'Deleted block'
    const d = b.data
    const listItem = (d.items || d.images)?.[item]
    if (listItem) return `${d.title || BLOCKS[b.type].label}: ${listItem.title || host(listItem.url)}`
    if (b.type === 'app') return `${d.name || 'App'} (${['iOS', 'Android', 'Web'][item]})`
    return d.title || d.name || d.repo || host(url) || BLOCKS[b.type]?.label
  }

  if (err) return <div className="an"><p className="ad-error">{err}</p></div>
  if (!data) return <div className="an"><span className="ad-spinner" /></div>

  const t = data.totals
  const ctr = t.views ? (t.clicks / t.views) * 100 : 0
  const series = data.series.map((s: any) => ({ t: s.t, v: metric === 'ctr' ? (s.views ? (s.clicks / s.views) * 100 : 0) : s[metric] }))
  const empty = !t.views && !t.clicks && !filter

  return (
    <div className="an">
      <div className="an-bar">
        <div className="ad-seg" role="group" aria-label="Date range">
          {RANGES.map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}
        </div>
        {filter && (
          <button className="an-filter" onClick={() => setFilter(null)} aria-label="Remove filter">
            {filter.k}: {filter.k === 'page' ? pageName(filter.v) : filter.v} <span aria-hidden>×</span>
          </button>
        )}
      </div>

      <section className="an-panel">
        <div className="an-kpis" role="tablist">
          {([['views', 'Views', t.views], ['visitors', 'Visitors', t.visitors], ['clicks', 'Clicks', t.clicks], ['ctr', 'Click rate', ctr]] as const).map(([k, label, v]) => (
            <button key={k} role="tab" aria-selected={metric === k} onClick={() => setMetric(k)}>
              <span>{label}</span>
              <strong>{k === 'ctr' ? `${(v as number).toFixed(1)}%` : fmt.format(v as number)}</strong>
            </button>
          ))}
        </div>
        {empty
          ? <div className="an-empty"><p>No visits yet. Share <strong>{location.host}</strong> in your bios and they'll show up here, with where people came from and what they tapped.</p></div>
          : <Chart points={series} bucket={data.range.bucket} pct={metric === 'ctr'} />}
      </section>

      <div className="an-grid">
        <BarList title="Top links" rows={data.blocks.map((b: any) => ({ label: blockName(b.page, b.block, b.item, b.url), sub: host(b.url), n: b.clicks }))} unit="clicks" />
        <BarList title="Pages" rows={data.dims.page.map((r: any) => ({ label: pageName(r.k), n: r.views, key: r.k }))} onPick={(v) => setFilter({ k: 'page', v })} />
        <BarList title="Referrers" rows={data.dims.referrer.filter((r: any) => r.k).map((r: any) => ({ label: r.k, n: r.views, key: r.k }))} onPick={(v) => setFilter({ k: 'referrer', v })} />
        <BarList title="Countries" rows={data.dims.country.filter((r: any) => r.k).map((r: any) => ({ label: `${flag(r.k)} ${regions?.of(r.k) || r.k}`, n: r.views + r.clicks, key: r.k }))} onPick={(v) => setFilter({ k: 'country', v })} unit="events" />
        <BarList title="Devices" rows={data.dims.device.filter((r: any) => r.k).map((r: any) => ({ label: r.k, n: r.views, key: r.k }))} onPick={(v) => setFilter({ k: 'device', v })} />
        <BarList title="Browsers and apps" rows={data.dims.browser.filter((r: any) => r.k).map((r: any) => ({ label: r.k, n: r.views, key: r.k }))} onPick={(v) => setFilter({ k: 'browser', v })} />
        <BarList title="Operating systems" rows={data.dims.os.filter((r: any) => r.k).map((r: any) => ({ label: r.k, n: r.views, key: r.k }))} onPick={(v) => setFilter({ k: 'os', v })} />
        <BarList title="Campaigns (utm_source)" rows={data.dims.utm.filter((r: any) => r.k).map((r: any) => ({ label: r.k, n: r.views, key: r.k }))} onPick={(v) => setFilter({ k: 'utm', v })}
          empty={`Add ?utm_source=instagram to the link in each bio to see which one sends people.`} />
      </div>
    </div>
  )
}

function BarList({ title, rows, onPick, unit = 'views', empty = 'Nothing yet.' }: {
  title: string; rows: { label: string; sub?: string; n: number; key?: string }[]; onPick?: (k: string) => void; unit?: string; empty?: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <section className="an-card">
      <header><h3>{title}</h3><span>{unit}</span></header>
      {rows.length ? (
        <ul>
          {rows.map((r, i) => (
            <li key={i}>
              <button disabled={!onPick || r.key == null} onClick={() => onPick?.(r.key!)} title={onPick ? 'Filter by this' : undefined}>
                <i style={{ width: `${(r.n / max) * 100}%` }} aria-hidden />
                <span className="an-label">{r.label}{r.sub && r.sub !== r.label && <em>{r.sub}</em>}</span>
                <b>{fmt.format(r.n)}</b>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="ad-muted an-none">{empty}</p>}
    </section>
  )
}

function Chart({ points, bucket, pct }: { points: { t: number; v: number }[]; bucket: number; pct: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current!)
    return () => ro.disconnect()
  }, [])
  const h = 240, pad = { l: 36, r: 8, t: 12, b: 26 }
  const max = Math.max(pct ? 5 : 4, ...points.map((p) => p.v))
  const nice = pct ? Math.ceil(max / 5) * 5 : Math.ceil(max / 4) * 4
  const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / nice) * (h - pad.t - pad.b)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const area = `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const label = (t: number) => new Date(t).toLocaleString(undefined, bucket < 864e5 ? { hour: 'numeric' } : { month: 'short', day: 'numeric' })
  const every = Math.ceil(points.length / Math.max(2, Math.floor(w / 90)))
  const hp = hover != null ? points[hover] : null

  return (
    <div className="an-chart" ref={box}
      onPointerMove={(e) => {
        const r = box.current!.getBoundingClientRect()
        const i = Math.round(((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (points.length - 1))
        setHover(Math.max(0, Math.min(points.length - 1, i)))
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={w} height={h} role="img" aria-label="Activity over time">
        <defs>
          <linearGradient id="an-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--ad-accent)" stopOpacity=".22" />
            <stop offset="1" stopColor="var(--ad-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((k) => (
          <g key={k}>
            <line x1={pad.l} x2={w - pad.r} y1={y(nice * k)} y2={y(nice * k)} className="an-grid-line" />
            <text x={pad.l - 8} y={y(nice * k) + 4} textAnchor="end" className="an-axis">{fmt.format(Math.round(nice * k))}{pct ? '%' : ''}</text>
          </g>
        ))}
        {points.map((p, i) => i % every === 0 && <text key={p.t} x={x(i)} y={h - 6} textAnchor="middle" className="an-axis">{label(p.t)}</text>)}
        <path d={area} fill="url(#an-fill)" />
        <path d={line} fill="none" stroke="var(--ad-accent)" strokeWidth="2" strokeLinejoin="round" />
        {hp && (
          <>
            <line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={y(0)} className="an-hover-line" />
            <circle cx={x(hover!)} cy={y(hp.v)} r="4.5" fill="var(--ad-surface)" stroke="var(--ad-accent)" strokeWidth="2" />
          </>
        )}
      </svg>
      {hp && (
        <div className="an-tip" style={{ left: Math.min(w - 140, Math.max(0, x(hover!) - 60)) }}>
          <span>{new Date(hp.t).toLocaleString(undefined, bucket < 864e5 ? { weekday: 'short', hour: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <strong>{pct ? hp.v.toFixed(1) + '%' : fmt.format(hp.v)}</strong>
        </div>
      )}
    </div>
  )
}
