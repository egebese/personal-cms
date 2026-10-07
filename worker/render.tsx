import * as React from 'react'
import { renderToString } from 'react-dom/server'
import css from '../src/shared/public.css?raw'
import { PublicLayout } from '../src/shared/layout'
import { fontHref, themeVars, varsToCss } from '../src/shared/theme'
import type { Page, Site } from '../src/shared/types'

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function renderPage(site: Site, page: Page, pages: Page[], origin: string) {
  const body = renderToString(
    <PublicLayout
      site={site}
      page={page}
      pages={pages}
      link={(b, i) => `/go/${page.id}/${b.id}${i ? `?i=${i}` : ''}`}
    />,
  )
  const name = site.name || 'linkwizz'
  const title = page.slug ? `${page.title} | ${name}` : name
  const abs = (u: string) => (u && u.startsWith('/') ? origin + u : u)
  const vars = themeVars(site)
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(site.bio)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(site.bio)}">
<meta property="og:type" content="profile"><meta property="og:url" content="${esc(origin + '/' + page.slug)}">
${site.avatar ? `<meta property="og:image" content="${esc(abs(site.avatar))}"><link rel="icon" href="${esc(site.avatar)}">` : ''}
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="${vars['--lw-bg']}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontHref(site.theme.font)}">
<style>html,body{margin:0;height:100%;background:${vars['--lw-bg']}}${css}</style>
</head><body><div class="lw-root" style="${esc(varsToCss(vars))}">${body}</div></body></html>`
}

export const emptyPage = (msg: string, status = 404) =>
  new Response(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(msg)}</title>
<body style="font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#555"><p>${esc(msg)}</p></body>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
