import * as React from 'react'
import {
  siInstagram, siX, siGithub, siYoutube, siTiktok, siThreads, siBluesky, siSubstack, siProducthunt,
  siDribbble, siBehance, siPinterest, siDiscord, siSpotify, siArxiv, siGooglescholar, siAppstore,
  siGoogleplay, siTwitch, siMedium, siHuggingface, siOrcid, siResearchgate, siMastodon, siFacebook,
  siSoundcloud, siVimeo, siBuymeacoffee, siPatreon, siKofi, siTelegram, siWhatsapp, siReddit,
  siLetterboxd, siGoodreads, siFigma, siNotion, siSnapchat,
} from 'simple-icons'
import type { Block, Size } from './types'

export type FieldKind = 'text' | 'textarea' | 'url' | 'image' | 'number' | 'list'
export interface Field { key: string; label: string; kind: FieldKind; of?: Field[] }

export interface BlockDef {
  label: string
  hint: string // one line, shown in the add menu and given to the AI
  sizes: Size[]
  size: Size
  fields: Field[]
  // Outbound URLs in a fixed order; /go/:page/:block?i=N redirects to links(block)[N].
  links: (d: any) => string[]
  view: (p: { d: any; size: Size; link: (i: number) => string }) => React.ReactNode
}

// ---------- brand detection ----------
type Icon = { path: string; hex: string; title: string }
const BRANDS: [RegExp, Icon][] = [
  [/(^|\.)instagram\.com$/, siInstagram], [/(^|\.)(x|twitter)\.com$/, siX], [/(^|\.)github\.com$/, siGithub],
  [/(^|\.)(youtube\.com|youtu\.be)$/, siYoutube], [/(^|\.)tiktok\.com$/, siTiktok], [/(^|\.)threads\.(net|com)$/, siThreads],
  [/(^|\.)bsky\.app$/, siBluesky], [/(^|\.)substack\.com$/, siSubstack], [/(^|\.)producthunt\.com$/, siProducthunt],
  [/(^|\.)dribbble\.com$/, siDribbble], [/(^|\.)behance\.net$/, siBehance], [/(^|\.)pinterest\.[a-z.]+$/, siPinterest],
  [/(^|\.)(discord\.gg|discord\.com)$/, siDiscord], [/(^|\.)spotify\.com$/, siSpotify], [/(^|\.)arxiv\.org$/, siArxiv],
  [/scholar\.google\./, siGooglescholar], [/(^|\.)apps\.apple\.com$/, siAppstore], [/(^|\.)play\.google\.com$/, siGoogleplay],
  [/(^|\.)twitch\.tv$/, siTwitch], [/(^|\.)medium\.com$/, siMedium], [/(^|\.)huggingface\.co$/, siHuggingface],
  [/(^|\.)orcid\.org$/, siOrcid], [/(^|\.)researchgate\.net$/, siResearchgate], [/(^|\.)(mastodon\.social|mstdn\.)/, siMastodon],
  [/(^|\.)facebook\.com$/, siFacebook], [/(^|\.)soundcloud\.com$/, siSoundcloud], [/(^|\.)vimeo\.com$/, siVimeo],
  [/(^|\.)buymeacoffee\.com$/, siBuymeacoffee], [/(^|\.)patreon\.com$/, siPatreon], [/(^|\.)ko-fi\.com$/, siKofi],
  [/(^|\.)(t\.me|telegram\.me)$/, siTelegram], [/(^|\.)(wa\.me|whatsapp\.com)$/, siWhatsapp], [/(^|\.)reddit\.com$/, siReddit],
  [/(^|\.)letterboxd\.com$/, siLetterboxd], [/(^|\.)goodreads\.com$/, siGoodreads], [/(^|\.)figma\.com$/, siFigma],
  [/(^|\.)notion\.(so|site)$/, siNotion], [/(^|\.)snapchat\.com$/, siSnapchat],
]
// LinkedIn isn't in simple-icons (trademark request); its glyph is drawn by hand.
const LINKEDIN: Icon = { title: 'LinkedIn', hex: '0A66C2', path: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z' }

export const host = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
export const brandOf = (url: string): Icon | null => {
  const h = host(url)
  if (!h) return url.startsWith('mailto:') ? { title: 'Email', hex: '444444', path: 'M2 5h20v14H2zM2 5l10 8 10-8' } : null
  if (/(^|\.)linkedin\.com$/.test(h)) return LINKEDIN
  return BRANDS.find(([re]) => re.test(h))?.[1] ?? null
}

// Brand colours that are too dark to read on dark themes get a light chip instead.
const BrandChip = ({ url, icon }: { url: string; icon?: string }) => {
  const b = brandOf(url)
  if (b) {
    const stroke = b.title === 'Email'
    return (
      <span className="lw-chip" style={{ background: '#' + b.hex }} aria-hidden>
        <svg viewBox="0 0 24 24" fill={stroke ? 'none' : '#fff'} stroke={stroke ? '#fff' : 'none'} strokeWidth={stroke ? 2 : 0}>
          <path d={b.path} />
        </svg>
      </span>
    )
  }
  if (icon) return <img className="lw-chip lw-chip-img" src={icon} alt="" loading="lazy" />
  return <span className="lw-chip lw-chip-blank" aria-hidden>{(host(url)[0] || '•').toUpperCase()}</span>
}

const Arrow = () => (
  <svg className="lw-arrow" viewBox="0 0 16 16" aria-hidden><path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
)

const num = (n: any) => {
  const v = Number(n) || 0
  return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(v)
}

const ytId = (url: string) => url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1]

// ---------- registry ----------
export const BLOCKS: Record<string, BlockDef> = {
  link: {
    label: 'Link',
    hint: 'Any URL. Social profiles get their brand icon automatically.',
    sizes: ['s', 'w', 't', 'l'],
    size: 's',
    fields: [
      { key: 'url', label: 'URL', kind: 'url' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'subtitle', label: 'Subtitle', kind: 'text' },
      { key: 'image', label: 'Preview image', kind: 'image' },
      { key: 'icon', label: 'Icon', kind: 'image' },
    ],
    links: (d) => [d.url],
    view: ({ d, size, link }) => (
      <a className="lw-fill" href={link(0)} target="_blank" rel="noopener">
        <div className="lw-link-body">
          <BrandChip url={d.url || ''} icon={d.icon} />
          <div className="lw-link-text">
            <strong>{d.title || host(d.url) || 'Untitled link'}</strong>
            {d.subtitle ? <span>{d.subtitle}</span> : <span className="lw-muted">{host(d.url)}</span>}
          </div>
        </div>
        {d.image && size !== 's' && <img className="lw-link-img" src={d.image} alt="" loading="lazy" />}
        <Arrow />
      </a>
    ),
  },

  heading: {
    label: 'Section title',
    hint: 'A full-width title that splits the grid into sections.',
    sizes: ['h'],
    size: 'h',
    fields: [{ key: 'text', label: 'Text', kind: 'text' }],
    links: () => [],
    view: ({ d }) => <h2 className="lw-h">{d.text || 'Section'}</h2>,
  },

  text: {
    label: 'Note',
    hint: 'A short paragraph: an intro, a status, what you are working on.',
    sizes: ['s', 'w', 't', 'l'],
    size: 'w',
    fields: [{ key: 'text', label: 'Text', kind: 'textarea' }],
    links: () => [],
    view: ({ d }) => <p className="lw-text">{d.text || 'Write something.'}</p>,
  },

  github: {
    label: 'GitHub repo',
    hint: 'A repository with stars, language and description.',
    sizes: ['s', 'w', 't', 'l'],
    size: 'w',
    fields: [
      { key: 'url', label: 'Repo URL', kind: 'url' },
      { key: 'repo', label: 'owner/name', kind: 'text' },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'stars', label: 'Stars', kind: 'number' },
      { key: 'language', label: 'Language', kind: 'text' },
    ],
    links: (d) => [d.url || (d.repo ? 'https://github.com/' + d.repo : '')],
    view: ({ d, link }) => (
      <a className="lw-fill lw-gh" href={link(0)} target="_blank" rel="noopener">
        <BrandChip url="https://github.com" />
        <code className="lw-gh-name">{d.repo || 'owner/repo'}</code>
        {d.description && <p className="lw-clamp">{d.description}</p>}
        <div className="lw-meta">
          <span>★ {num(d.stars)}</span>
          {d.language && <span>{d.language}</span>}
        </div>
      </a>
    ),
  },

  paper: {
    label: 'Paper',
    hint: 'A research paper: arXiv, DOI or any PDF.',
    sizes: ['s', 'w', 't', 'l'],
    size: 'w',
    fields: [
      { key: 'url', label: 'URL', kind: 'url' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'authors', label: 'Authors', kind: 'text' },
      { key: 'venue', label: 'Venue', kind: 'text' },
      { key: 'year', label: 'Year', kind: 'text' },
    ],
    links: (d) => [d.url],
    view: ({ d, link }) => (
      <a className="lw-fill lw-paper" href={link(0)} target="_blank" rel="noopener">
        <span className="lw-paper-venue">{[d.venue || host(d.url), d.year].filter(Boolean).join(' ')}</span>
        <strong className="lw-paper-title">{d.title || 'Untitled paper'}</strong>
        {d.authors && <span className="lw-muted lw-clamp1">{d.authors}</span>}
      </a>
    ),
  },

  app: {
    label: 'App',
    hint: 'An app or product with App Store, Google Play and web links.',
    sizes: ['s', 'w', 't', 'l'],
    size: 'w',
    fields: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'tagline', label: 'Tagline', kind: 'text' },
      { key: 'icon', label: 'Icon', kind: 'image' },
      { key: 'ios', label: 'App Store URL', kind: 'url' },
      { key: 'android', label: 'Google Play URL', kind: 'url' },
      { key: 'web', label: 'Website', kind: 'url' },
    ],
    links: (d) => [d.ios || '', d.android || '', d.web || ''],
    view: ({ d, link }) => (
      <div className="lw-fill lw-app">
        <div className="lw-app-head">
          {d.icon ? <img className="lw-app-icon" src={d.icon} alt="" loading="lazy" /> : <span className="lw-app-icon lw-chip-blank">{(d.name || '?')[0]}</span>}
          <div className="lw-link-text">
            <strong>{d.name || 'App'}</strong>
            {d.tagline && <span className="lw-clamp1">{d.tagline}</span>}
          </div>
        </div>
        <div className="lw-stores">
          {d.ios && <a href={link(0)} target="_blank" rel="noopener">iOS</a>}
          {d.android && <a href={link(1)} target="_blank" rel="noopener">Android</a>}
          {d.web && <a href={link(2)} target="_blank" rel="noopener">Web</a>}
        </div>
      </div>
    ),
  },

  image: {
    label: 'Image',
    hint: 'A single photo or artwork, optionally linking somewhere.',
    sizes: ['s', 'w', 't', 'l'],
    size: 'l',
    fields: [
      { key: 'src', label: 'Image', kind: 'image' },
      { key: 'caption', label: 'Caption', kind: 'text' },
      { key: 'url', label: 'Link', kind: 'url' },
    ],
    links: (d) => [d.url || ''],
    view: ({ d, link }) => {
      const img = d.src ? <img className="lw-cover" src={d.src} alt={d.caption || ''} loading="lazy" /> : <div className="lw-cover lw-empty-img" />
      const cap = d.caption && <span className="lw-caption">{d.caption}</span>
      return d.url
        ? <a className="lw-fill lw-media" href={link(0)} target="_blank" rel="noopener">{img}{cap}</a>
        : <div className="lw-fill lw-media">{img}{cap}</div>
    },
  },

  board: {
    label: 'Board',
    hint: 'A mood board / gallery of several images, for visual work.',
    sizes: ['w', 't', 'l'],
    size: 'l',
    fields: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'images', label: 'Images', kind: 'list', of: [{ key: 'src', label: 'Image', kind: 'image' }, { key: 'url', label: 'Link', kind: 'url' }] },
    ],
    links: (d) => (d.images || []).map((x: any) => x.url || ''),
    view: ({ d, link }) => {
      const imgs: any[] = (d.images || []).slice(0, 6)
      return (
        <div className={'lw-fill lw-board lw-board-' + Math.max(1, Math.min(imgs.length, 6))}>
          {imgs.map((x, i) => {
            const im = <img src={x.src} alt="" loading="lazy" />
            return x.url ? <a key={i} href={link(i)} target="_blank" rel="noopener">{im}</a> : <span key={i}>{im}</span>
          })}
          {!imgs.length && <span className="lw-empty-img" />}
          {d.title && <span className="lw-caption">{d.title}</span>}
        </div>
      )
    },
  },

  media: {
    label: 'Video',
    hint: 'A YouTube or Vimeo video, shown as a thumbnail.',
    sizes: ['w', 'l', 's', 't'],
    size: 'w',
    fields: [
      { key: 'url', label: 'Video URL', kind: 'url' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'thumbnail', label: 'Thumbnail', kind: 'image' },
    ],
    links: (d) => [d.url],
    view: ({ d, link }) => {
      const id = ytId(d.url || '')
      const thumb = d.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '')
      return (
        <a className="lw-fill lw-media lw-video" href={link(0)} target="_blank" rel="noopener">
          {thumb ? <img className="lw-cover" src={thumb} alt="" loading="lazy" /> : <div className="lw-cover lw-empty-img" />}
          <span className="lw-play" aria-hidden><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
          {d.title && <span className="lw-caption">{d.title}</span>}
        </a>
      )
    },
  },

  collection: {
    label: 'Saved list',
    hint: 'A titled list of saved links: reading list, references, tools, favourites.',
    sizes: ['w', 't', 'l'],
    size: 't',
    fields: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'items', label: 'Items', kind: 'list', of: [{ key: 'title', label: 'Title', kind: 'text' }, { key: 'url', label: 'URL', kind: 'url' }, { key: 'note', label: 'Note', kind: 'text' }] },
    ],
    links: (d) => (d.items || []).map((x: any) => x.url || ''),
    view: ({ d, link }) => (
      <div className="lw-fill lw-list">
        <strong className="lw-list-title">{d.title || 'Saved'}</strong>
        <ul>
          {(d.items || []).map((x: any, i: number) => (
            <li key={i}>
              <a href={link(i)} target="_blank" rel="noopener">
                <span>{x.title || host(x.url) || 'Untitled'}</span>
                {x.note && <em>{x.note}</em>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
}

export function BlockView({ block, link }: { block: Block; link: (i: number) => string }) {
  const def = BLOCKS[block.type]
  if (!def) return null
  return <>{def.view({ d: block.data || {}, size: block.size, link })}</>
}

export const cellClass = (b: Block) => `lw-cell lw-size-${b.size}`

// The public grid. `wrap` lets the editor replace the cell (drag handles, selection);
// it must render an element with cellClass(b) so the grid spans stay right.
export function Grid({ blocks, link, wrap }: {
  blocks: Block[]
  link: (b: Block, i: number) => string
  wrap?: (b: Block, card: React.ReactNode) => React.ReactNode
}) {
  return (
    <div className="lw-grid">
      {blocks.map((b) => {
        const card = (
          <div className={`lw-card lw-t-${b.type}`} data-block={b.id}>
            <BlockView block={b} link={(i) => link(b, i)} />
          </div>
        )
        return wrap
          ? <React.Fragment key={b.id}>{wrap(b, card)}</React.Fragment>
          : <div className={cellClass(b)} key={b.id}>{card}</div>
      })}
    </div>
  )
}
