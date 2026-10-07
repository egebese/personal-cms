// Turns URLs into structured data: `unfurl` for a single block, `gather` for AI onboarding.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'

export const normUrl = (u: string) => {
  u = u.trim()
  if (!u) return ''
  if (/^@[\w.]+$/.test(u)) return '' // a bare handle has no platform; the caller says which
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.toString() : '' } catch { return '' }
}

const get = (url: string, json = false) =>
  fetch(url, {
    headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'en,tr;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
  })

const getJson = async (url: string) => {
  const r = await get(url, true)
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).hostname}`)
  return r.json<any>()
}

interface Html {
  url: string; title: string; meta: Record<string, string>; icon: string
  links: { href: string; text: string }[]; jsonld: string[]; next: string; text: string
}

async function readHtml(url: string): Promise<Html> {
  const res = await get(url)
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`)
  const out: Html = { url: res.url || url, title: '', meta: {}, icon: '', links: [], jsonld: [], next: '', text: '' }
  if (!(res.headers.get('content-type') || '').includes('html')) return out
  let a: { href: string; text: string } | null = null
  await new HTMLRewriter()
    .on('title', { text: (t) => { out.title += t.text } })
    .on('meta', {
      element: (e) => {
        const k = (e.getAttribute('property') || e.getAttribute('name') || '').toLowerCase()
        const v = e.getAttribute('content')
        if (!k || !v) return
        // citation_author repeats once per author; keep them all.
        out.meta[k] = k === 'citation_author' && out.meta[k] ? out.meta[k] + ', ' + v : out.meta[k] || v
      },
    })
    .on('link[rel]', {
      element: (e) => {
        const rel = e.getAttribute('rel') || ''
        if (/apple-touch-icon/.test(rel) || (/icon/.test(rel) && !out.icon)) out.icon = e.getAttribute('href') || out.icon
      },
    })
    .on('a[href]', {
      element: (e) => { a = { href: e.getAttribute('href') || '', text: '' }; out.links.push(a) },
      text: (t) => { if (a) a.text += t.text },
    })
    .on('script[type="application/ld+json"]', {
      element: () => { out.jsonld.push('') },
      text: (t) => { out.jsonld[out.jsonld.length - 1] += t.text },
    })
    .on('script#__NEXT_DATA__', { text: (t) => { if (out.next.length < 200_000) out.next += t.text } })
    .on('h1, h2, h3, p, li', {
      text: (t) => { if (out.text.length < 4000) out.text += t.text + (t.lastInTextNode ? ' ' : '') },
    })
    .transform(res)
    .arrayBuffer()
  const abs = (h: string) => { try { return new URL(h, out.url).toString() } catch { return '' } }
  out.icon = out.icon && abs(out.icon)
  const seen = new Set<string>()
  out.links = out.links
    .map((l) => ({ href: abs(l.href), text: l.text.replace(/\s+/g, ' ').trim().slice(0, 80) }))
    .filter((l) => /^(https?:|mailto:)/.test(l.href) && !seen.has(l.href) && seen.add(l.href))
    .slice(0, 120)
  out.text = out.text.replace(/\s+/g, ' ').trim()
  for (const k of ['og:image', 'twitter:image']) if (out.meta[k]) out.meta[k] = abs(out.meta[k])
  return out
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").trim()

// ---------- platform helpers ----------
async function arxiv(id: string) {
  const xml = await (await get(`https://export.arxiv.org/api/query?id_list=${id}`)).text()
  const entry = xml.split('<entry>')[1] || ''
  const pick = (tag: string) => decode(entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || '').replace(/\s+/g, ' ')
  const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1])
  return {
    title: pick('title'),
    authors: authors.length > 4 ? authors.slice(0, 3).join(', ') + ' et al.' : authors.join(', '),
    venue: 'arXiv',
    year: pick('published').slice(0, 4),
    abstract: pick('summary').slice(0, 600),
  }
}

async function crossref(doi: string) {
  const w = (await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)).message
  const authors = (w.author || []).map((a: any) => [a.given, a.family].filter(Boolean).join(' '))
  return {
    title: w.title?.[0] || '',
    authors: authors.length > 4 ? authors.slice(0, 3).join(', ') + ' et al.' : authors.join(', '),
    venue: w['container-title']?.[0] || w.publisher || '',
    year: String(w.issued?.['date-parts']?.[0]?.[0] || ''),
  }
}

const ghRepo = async (repo: string) => {
  const r = await getJson(`https://api.github.com/repos/${repo}`)
  return { repo: r.full_name, url: r.html_url, description: r.description || '', stars: r.stargazers_count, language: r.language || '', homepage: r.homepage || '' }
}

// ---------- unfurl: one URL -> the best block ----------
export async function unfurl(raw: string): Promise<{ type: string; size?: string; data: Record<string, any> }> {
  const url = normUrl(raw)
  if (!url) throw new Error('That is not a valid URL')
  const u = new URL(url)
  const h = u.hostname.replace(/^www\./, '')
  const seg = u.pathname.split('/').filter(Boolean)

  if (h === 'github.com' && seg.length >= 2 && !['orgs', 'settings', 'sponsors'].includes(seg[0])) {
    return { type: 'github', data: await ghRepo(`${seg[0]}/${seg[1]}`).catch(() => ({ url, repo: `${seg[0]}/${seg[1]}` })) }
  }
  const ax = h.endsWith('arxiv.org') && url.match(/(?:abs|pdf|html)\/([\w.\-/]+?)(?:v\d+)?(?:\.pdf)?$/)
  if (ax) return { type: 'paper', data: { url: `https://arxiv.org/abs/${ax[1]}`, ...(await arxiv(ax[1])) } }
  const doi = (h === 'doi.org' || h === 'dx.doi.org') && u.pathname.slice(1)
  if (doi) return { type: 'paper', data: { url, ...(await crossref(decodeURIComponent(doi)).catch(() => ({}))) } }
  if (/\.(png|jpe?g|gif|webp|avif)$/i.test(u.pathname)) return { type: 'image', data: { src: url } }

  if (h === 'apps.apple.com') {
    const id = url.match(/id(\d+)/)?.[1]
    if (id) {
      const a = (await getJson(`https://itunes.apple.com/lookup?id=${id}`)).results?.[0]
      if (a) return { type: 'app', data: { name: a.trackName, icon: a.artworkUrl512 || a.artworkUrl100, tagline: (a.description || '').split('\n')[0].slice(0, 90), ios: url, web: a.sellerUrl || '' } }
    }
  }
  if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(h) && !/^(@|c\/|channel|user)/.test(seg.join('/'))) {
    const o = await getJson(`https://${h.includes('vimeo') ? 'vimeo.com/api/oembed.json' : 'www.youtube.com/oembed'}?format=json&url=${encodeURIComponent(url)}`).catch(() => null)
    if (o) return { type: 'media', data: { url, title: o.title || '', thumbnail: o.thumbnail_url || '' } }
  }
  if (h === 'x.com' || h === 'twitter.com') {
    const p = seg[0] && (await getJson(`https://api.fxtwitter.com/${seg[0]}`).catch(() => null))?.user
    if (p) return { type: 'link', data: { url, title: p.name, subtitle: '@' + p.screen_name } }
  }

  const page = await readHtml(url)
  const m = page.meta
  if (m['citation_title']) {
    return { type: 'paper', data: { url, title: m['citation_title'], authors: m['citation_author'] || '', venue: m['citation_journal_title'] || m['citation_conference_title'] || h, year: (m['citation_publication_date'] || m['citation_date'] || '').slice(0, 4) } }
  }
  if (h === 'play.google.com') {
    return { type: 'app', data: { name: (m['og:title'] || page.title).replace(/ - Apps on Google Play$/, ''), icon: m['og:image'] || '', tagline: (m['og:description'] || '').slice(0, 90), android: url } }
  }
  const title = decode(m['og:title'] || m['twitter:title'] || page.title || '')
  const desc = decode(m['og:description'] || m['description'] || '')
  return {
    type: 'link',
    data: { url: page.url, title: title.slice(0, 80), subtitle: desc.length > 70 ? '' : desc, image: m['og:image'] || m['twitter:image'] || '', icon: page.icon || '' },
  }
}

// ---------- gather: one URL -> compact text for the onboarding model ----------
export async function gather(raw: string): Promise<{ url: string; source: string; content: string }> {
  const url = normUrl(raw)
  if (!url) throw new Error('not a URL')
  const u = new URL(url)
  const h = u.hostname.replace(/^www\./, '')
  const seg = u.pathname.split('/').filter(Boolean)
  const cap = (o: unknown) => JSON.stringify(o).slice(0, 6000)

  if ((h === 'x.com' || h === 'twitter.com') && seg[0]) {
    const p = (await getJson(`https://api.fxtwitter.com/${seg[0]}`)).user
    return { url, source: 'X profile', content: cap({ name: p.name, handle: '@' + p.screen_name, bio: p.description, location: p.location, website: p.website?.url, avatar: (p.avatar_url || '').replace('_normal', '_400x400'), followers: p.followers }) }
  }
  if (h === 'github.com' && seg.length === 1) {
    const [p, repos] = await Promise.all([
      getJson(`https://api.github.com/users/${seg[0]}`),
      getJson(`https://api.github.com/users/${seg[0]}/repos?per_page=100&sort=updated`),
    ])
    const top = (repos as any[]).filter((r) => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8)
    return {
      url, source: 'GitHub profile',
      content: cap({ name: p.name, login: p.login, bio: p.bio, blog: p.blog, company: p.company, location: p.location, avatar: p.avatar_url, twitter: p.twitter_username, followers: p.followers, top_repos: top.map((r) => ({ repo: r.full_name, url: r.html_url, description: r.description, stars: r.stargazers_count, language: r.language, homepage: r.homepage })) }),
    }
  }
  if (h === 'github.com' && seg.length >= 2) return { url, source: 'GitHub repo', content: cap(await ghRepo(`${seg[0]}/${seg[1]}`)) }

  const page = await readHtml(url)
  // Linktree and most Next.js bio sites ship their links in __NEXT_DATA__.
  let links: unknown = page.links.map((l) => `${l.text || '-'} | ${l.href}`)
  try {
    const pp = JSON.parse(page.next)?.props?.pageProps
    if (pp?.links) links = pp.links.map((l: any) => `${l.title} | ${l.url}`)
    if (pp?.account?.profilePictureUrl) page.meta['og:image'] = pp.account.profilePictureUrl
  } catch {}
  const content = cap({
    title: decode(page.title), description: decode(page.meta['og:description'] || page.meta['description'] || ''),
    image: page.meta['og:image'] || '', icon: page.icon,
    jsonld: page.jsonld.map((j) => j.slice(0, 800)),
    links,
    text: page.text.slice(0, 1500),
  })
  return { url: page.url, source: h, content }
}
