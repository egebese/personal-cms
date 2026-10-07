import type { Env } from './env'
import { BLOCKS } from '../src/shared/blocks'
import { defaultSite, validSlug, type Page, type Site } from '../src/shared/types'

// Schema is applied lazily on first request so the one-click deploy needs no migration step.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
     position INTEGER NOT NULL DEFAULT 0, blocks TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS events (ts INTEGER NOT NULL, kind TEXT NOT NULL, page TEXT, block TEXT, item INTEGER,
     url TEXT, visitor TEXT, country TEXT, city TEXT, device TEXT, browser TEXT, os TEXT, referrer TEXT, utm TEXT)`,
  `CREATE INDEX IF NOT EXISTS events_ts ON events(ts)`,
]
let ready: Promise<unknown> | null = null
export const ensureSchema = (env: Env) =>
  (ready ??= env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { ready = null; throw e }))

export async function getSite(env: Env): Promise<Site> {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'site'`).first<{ value: string }>()
  const d = defaultSite()
  if (!row) return d
  const s = JSON.parse(row.value)
  return { ...d, ...s, theme: { ...d.theme, ...s.theme }, cursor: { ...d.cursor, ...s.cursor, effects: { ...d.cursor.effects, ...s.cursor?.effects } } }
}

export async function listPages(env: Env): Promise<Page[]> {
  const { results } = await env.DB.prepare(`SELECT id, slug, title, blocks FROM pages ORDER BY position`).all<any>()
  return results.map((r) => ({ id: r.id, slug: r.slug, title: r.title, blocks: JSON.parse(r.blocks) }))
}

export async function getPage(env: Env, slug: string): Promise<Page | null> {
  const r = await env.DB.prepare(`SELECT id, slug, title, blocks FROM pages WHERE slug = ?`).bind(slug).first<any>()
  return r && { id: r.id, slug: r.slug, title: r.title, blocks: JSON.parse(r.blocks) }
}

export async function getPageById(env: Env, id: string): Promise<Page | null> {
  const r = await env.DB.prepare(`SELECT id, slug, title, blocks FROM pages WHERE id = ?`).bind(id).first<any>()
  return r && { id: r.id, slug: r.slug, title: r.title, blocks: JSON.parse(r.blocks) }
}

// Validates the editor's whole state. Returns an error string or null.
export function checkState(site: any, pages: any): string | null {
  if (!site || typeof site !== 'object' || typeof site.name !== 'string') return 'site is malformed'
  if (!Array.isArray(pages) || !pages.length) return 'at least one page is required'
  const slugs = new Set<string>()
  for (const p of pages) {
    if (typeof p.id !== 'string' || typeof p.title !== 'string' || !Array.isArray(p.blocks)) return 'page is malformed'
    if (!validSlug(p.slug)) return `"${p.slug}" can't be used as a page address`
    if (slugs.has(p.slug)) return `two pages use the address "/${p.slug}"`
    slugs.add(p.slug)
    for (const b of p.blocks) {
      const def = BLOCKS[b?.type]
      if (!def) return `unknown block type "${b?.type}"`
      if (!def.sizes.includes(b.size)) return `${def.label} can't be size "${b.size}"`
      if (typeof b.id !== 'string' || typeof b.data !== 'object') return 'block is malformed'
    }
  }
  if (!slugs.has('')) return 'one page must be the home page (empty address)'
  return null
}

export async function saveState(env: Env, site: Site, pages: Page[]) {
  const now = Date.now()
  const ids = pages.map((p) => p.id)
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(JSON.stringify(site)),
    env.DB.prepare(`DELETE FROM pages WHERE id NOT IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)),
    // Park slugs first so swapping two pages' addresses doesn't trip the UNIQUE constraint.
    env.DB.prepare(`UPDATE pages SET slug = '~' || id`),
    ...pages.map((p, i) =>
      env.DB.prepare(
        `INSERT INTO pages (id, slug, title, position, blocks, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, title = excluded.title, position = excluded.position,
         blocks = excluded.blocks, updated_at = excluded.updated_at`,
      ).bind(p.id, p.slug, p.title, i, JSON.stringify(p.blocks), now),
    ),
  ])
}
