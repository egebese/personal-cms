import type { Env } from './env'
import { clearCookie, isAdmin, passwordOk, sessionCookie } from './auth'
import { checkState, ensureSchema, getPage, getPageById, getSite, listPages, saveState } from './db'
import { chat, FalError, transcribe } from './fal'
import { gather, normUrl, unfurl } from './scrape'
import { logEvent, report } from './analytics'
import { isBot } from './ua'
import { emptyPage, renderPage } from './render'
import { BLOCKS } from '../src/shared/blocks'
import { BUILD_SITE_TOOL, EDITOR_TOOLS, chatSystem, importSystem } from '../src/shared/ai'
import { cleanSlug, defaultSite, uid, validSlug, type Page, type Site } from '../src/shared/types'

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
const fail = (error: string, status = 400) => json({ error }, status)

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname

    // Static assets, the admin SPA and Vite's dev modules.
    if (path === '/admin' || path.startsWith('/admin/')) return env.ASSETS.fetch(new Request(new URL('/admin', url), req))
    if (/^\/(assets|src|node_modules|@)/.test(path) || (/\.\w{2,5}$/.test(path) && !path.startsWith('/media/'))) return env.ASSETS.fetch(req)

    try {
      await ensureSchema(env)
      if (path.startsWith('/api/')) return await api(req, env, ctx, url)
      if (path.startsWith('/media/')) return await media(env, path.slice(7))
      if (path.startsWith('/go/')) return await go(req, env, ctx, url)
      return await publicPage(req, env, ctx, url)
    } catch (e: any) {
      if (e instanceof FalError) return fail(e.message, 502)
      console.error(e)
      return path.startsWith('/api/') ? fail('Server error: ' + (e?.message || e), 500) : emptyPage('Something went wrong.', 500)
    }
  },
} satisfies ExportedHandler<Env>

// ---------- public ----------
async function publicPage(req: Request, env: Env, ctx: ExecutionContext, url: URL) {
  const slug = decodeURIComponent(url.pathname.slice(1)).replace(/\/$/, '')
  if (!validSlug(slug)) return emptyPage('Page not found.')
  const pages = await listPages(env)
  if (!pages.length) return Response.redirect(new URL('/admin', url).toString(), 302) // fresh install
  const page = pages.find((p) => p.slug === slug)
  if (!page) return emptyPage('Page not found.')
  const site = await getSite(env)
  // The owner's own visits and bots don't count.
  const ua = req.headers.get('user-agent') || ''
  if (!isBot(ua) && !(await isAdmin(env, req))) ctx.waitUntil(logEvent(env, req, 'view', { page: page.id }).catch(console.error))
  return new Response(renderPage(site, page, pages, url.origin), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  })
}

// Tracked redirect. The target is looked up from saved content, so /go can't be used as an open redirect.
async function go(req: Request, env: Env, ctx: ExecutionContext, url: URL) {
  const [, , pageId, blockId] = url.pathname.split('/')
  const item = Number(url.searchParams.get('i') || 0)
  const page = await getPageById(env, pageId)
  const block = page?.blocks.find((b) => b.id === blockId)
  const target = block && BLOCKS[block.type]?.links(block.data)[item]
  if (!target || !/^(https?:|mailto:)/.test(target)) return emptyPage('Link not found.')
  if (!isBot(req.headers.get('user-agent') || '') && !(await isAdmin(env, req)))
    ctx.waitUntil(logEvent(env, req, 'click', { page: pageId, block: blockId, item, url: target }).catch(console.error))
  return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'no-store', 'referrer-policy': 'origin' } })
}

async function media(env: Env, key: string) {
  const obj = await env.MEDIA.get(key)
  if (!obj) return new Response('Not found', { status: 404 })
  const h = new Headers({ 'cache-control': 'public, max-age=31536000, immutable', etag: obj.httpEtag })
  obj.writeHttpMetadata(h)
  return new Response(obj.body, { headers: h })
}

// Copies a remote image into R2 so the site doesn't depend on expiring CDN links (Instagram's expire in days).
async function mirror(env: Env, src: string): Promise<string> {
  if (!/^https?:/.test(src)) return src
  try {
    const r = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
    const type = r.headers.get('content-type') || ''
    if (!r.ok || !type.startsWith('image/')) return src
    const key = uid() + uid() + '.' + (type.split('/')[1].split(/[;+]/)[0] || 'img')
    await env.MEDIA.put(key, r.body, { httpMetadata: { contentType: type } })
    return '/media/' + key
  } catch { return src }
}

// ---------- api ----------
async function api(req: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const route = req.method + ' ' + url.pathname.slice(4)

  if (route === 'POST /login') {
    const { password } = await req.json<any>().catch(() => ({}))
    if (!env.ADMIN_PASSWORD) return fail('ADMIN_PASSWORD is not set. Add it as a Worker secret, then reload.', 500)
    if (!(await passwordOk(env, String(password || '')))) {
      await new Promise((r) => setTimeout(r, 600)) // slows down guessing
      return fail('Wrong password.', 401)
    }
    return json({ ok: true }, 200, { 'set-cookie': await sessionCookie(env, url) })
  }
  if (route === 'POST /logout') return json({ ok: true }, 200, { 'set-cookie': clearCookie })
  if (route === 'GET /me') return json({ admin: await isAdmin(env, req), configured: { password: !!env.ADMIN_PASSWORD, fal: !!env.FAL_KEY } })

  if (!(await isAdmin(env, req))) return fail('Sign in first.', 401)
  // Cookie is SameSite=Lax; also refuse cross-site writes outright.
  const origin = req.headers.get('origin')
  if (req.method !== 'GET' && origin && origin !== url.origin) return fail('Cross-site request blocked.', 403)

  switch (route) {
    case 'GET /state': {
      const [site, pages] = await Promise.all([getSite(env), listPages(env)])
      return json({ site, pages })
    }
    case 'PUT /state': {
      const { site, pages } = await req.json<any>()
      const err = checkState(site, pages)
      if (err) return fail(err)
      await saveState(env, site, pages)
      return json({ ok: true, savedAt: Date.now() })
    }
    case 'POST /upload': {
      const type = req.headers.get('content-type') || ''
      if (!type.startsWith('image/')) return fail('Only images can be uploaded.')
      const len = Number(req.headers.get('content-length') || 0)
      if (len > 10 * 1024 * 1024) return fail('Images must be under 10 MB.')
      const key = uid() + uid() + '.' + (type.split('/')[1].split(/[;+]/)[0] || 'img')
      await env.MEDIA.put(key, req.body, { httpMetadata: { contentType: type } })
      return json({ url: '/media/' + key })
    }
    case 'POST /unfurl': {
      const { url: u } = await req.json<any>()
      try { return json(await unfurl(String(u || ''))) } catch (e: any) { return fail(`Couldn't read that link: ${e.message}`, 422) }
    }
    case 'POST /transcribe': {
      const type = req.headers.get('content-type') || 'audio/webm'
      const text = await transcribe(env, await req.arrayBuffer(), type)
      return json({ text })
    }
    case 'POST /chat': {
      const { messages, context } = await req.json<any>()
      if (!Array.isArray(messages)) return fail('messages must be an array')
      const r = await chat(env, {
        messages: [{ role: 'system', content: chatSystem(JSON.stringify(context)) }, ...messages.slice(-40)],
        tools: EDITOR_TOOLS,
        max_tokens: 4000,
      })
      return json({ message: r.choices?.[0]?.message, usage: r.usage })
    }
    case 'GET /analytics':
      return json(await report(env, url.searchParams))
    case 'POST /import':
      return importSite(req, env, ctx)
  }
  return fail('Not found', 404)
}

// AI onboarding: scrape every source, let the model lay out the site, mirror images, stream progress as NDJSON.
async function importSite(req: Request, env: Env, ctx: ExecutionContext) {
  const { urls, note } = await req.json<any>()
  const list: string[] = [...new Set<string>((urls || []).map(normUrl).filter(Boolean))].slice(0, 12)
  if (!list.length && !note) return fail('Add at least one link or a few words about yourself.')
  const { readable, writable } = new TransformStream()
  const w = writable.getWriter()
  const send = (o: unknown) => w.write(new TextEncoder().encode(JSON.stringify(o) + '\n'))

  ctx.waitUntil((async () => {
    try {
      const sources = await Promise.all(list.map(async (u) => {
        await send({ step: 'scrape', url: u, status: 'start' })
        try {
          const s = await gather(u)
          await send({ step: 'scrape', url: u, status: 'ok', source: s.source })
          return s
        } catch (e: any) {
          await send({ step: 'scrape', url: u, status: 'fail', error: e.message })
          return { url: u, source: 'unreadable', content: `(could not fetch: ${e.message}; the URL itself is still valid)` }
        }
      }))
      await send({ step: 'ai', status: 'start' })
      const r = await chat(env, {
        messages: [
          { role: 'system', content: importSystem },
          { role: 'user', content: `Notes from the owner: ${note || '(none)'}\n\nSources:\n` + sources.map((s) => `### ${s.url} (${s.source})\n${s.content}`).join('\n\n') },
        ],
        tools: [BUILD_SITE_TOOL],
        tool_choice: { type: 'function', function: { name: 'build_site' } },
        max_tokens: 8000,
      })
      const call = r.choices?.[0]?.message?.tool_calls?.[0]
      if (!call) throw new Error('The model did not return a site. Try again.')
      const plan = JSON.parse(call.function.arguments)
      await send({ step: 'ai', status: 'ok' })

      await send({ step: 'images', status: 'start' })
      const { site, pages } = await finishPlan(env, plan)
      await send({ step: 'images', status: 'ok' })
      await send({ step: 'done', site, pages, cost: r.usage?.cost })
    } catch (e: any) {
      await send({ step: 'error', error: e.message || String(e) })
    } finally {
      await w.close()
    }
  })())
  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } })
}

// Normalises the model's plan into valid state and fills in real data for repos, papers and apps.
async function finishPlan(env: Env, plan: any): Promise<{ site: Site; pages: Page[] }> {
  const site: Site = { ...defaultSite(), name: String(plan.name || ''), bio: String(plan.bio || '').slice(0, 300), avatar: String(plan.avatar || '') }
  Object.assign(site.theme, plan.theme || {})
  const used = new Set<string>()
  const pages: Page[] = (plan.pages || []).map((p: any, i: number) => {
    let slug = i === 0 ? '' : cleanSlug(p.slug || p.title || 'page')
    if (!validSlug(slug) || used.has(slug)) slug = (slug || 'page') + '-' + (i + 1)
    used.add(slug)
    return {
      id: uid(), slug, title: String(p.title || (i ? slug : 'Home')),
      blocks: (p.blocks || []).filter((b: any) => BLOCKS[b?.type]).map((b: any) => {
        const def = BLOCKS[b.type]
        return { id: uid(), type: b.type, size: def.sizes.includes(b.size) ? b.size : def.size, data: b.data || {} }
      }),
    }
  })
  if (!pages.length) pages.push({ id: uid(), slug: '', title: 'Home', blocks: [] })

  const jobs: Promise<unknown>[] = [mirror(env, site.avatar).then((u) => { site.avatar = u })]
  for (const b of pages.flatMap((p) => p.blocks)) {
    const d = b.data
    const needs = (b.type === 'github' && d.stars == null) || (b.type === 'paper' && !d.title) || (b.type === 'app' && !d.icon && d.ios)
    if (needs) jobs.push(unfurl(d.url || d.ios || (d.repo ? 'https://github.com/' + d.repo : '')).then((x) => { if (x.type === b.type) b.data = { ...x.data, ...stripEmpty(d) } }).catch(() => {}))
    for (const k of ['image', 'icon', 'src', 'thumbnail']) if (d[k]) jobs.push(mirror(env, d[k]).then((u) => { d[k] = u }))
    for (const x of d.images || []) if (x.src) jobs.push(mirror(env, x.src).then((u) => { x.src = u }))
  }
  await Promise.all(jobs)
  return { site, pages }
}

const stripEmpty = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null))
