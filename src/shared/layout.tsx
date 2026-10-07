import * as React from 'react'
import type { Block, Page, Site } from './types'
import { Grid } from './blocks'

// Shared by the SSR'd public page and the editor canvas, so what you edit is what ships.
export function PublicLayout({ site, page, pages, link, wrap, profile, pageHref }: {
  site: Site
  page: Page
  pages: Pick<Page, 'slug' | 'title'>[]
  link: (b: Block, i: number) => string
  wrap?: (b: Block, card: React.ReactNode) => React.ReactNode
  profile?: React.ReactNode // editor swaps in editable fields
  pageHref?: (slug: string) => string
}) {
  const href = pageHref || ((s: string) => '/' + s)
  return (
    <div className="lw-page">
      <header className="lw-profile">
        {profile || (
          <>
            {site.avatar
              ? <img className="lw-avatar" src={site.avatar} alt="" />
              : <span className="lw-avatar lw-avatar-blank">{(site.name || '?')[0]}</span>}
            <h1 className="lw-name">{site.name || 'Your name'}</h1>
            {site.bio && <p className="lw-bio">{site.bio}</p>}
          </>
        )}
        {pages.length > 1 && (
          <nav className="lw-tabs" aria-label="Pages">
            {pages.map((p) => (
              <a key={p.slug} href={href(p.slug)} aria-current={p.slug === page.slug ? 'page' : undefined}>{p.title}</a>
            ))}
          </nav>
        )}
      </header>
      <main className="lw-main">
        <Grid blocks={page.blocks} link={link} wrap={wrap} />
      </main>
    </div>
  )
}
