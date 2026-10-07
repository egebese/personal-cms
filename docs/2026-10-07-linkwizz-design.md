# linkwizz design (2026-10-07)

## Goal
A self-hosted, single-owner link-in-bio site with multiple pages (CMS-like), installable with one click on Cloudflare.
Serves creators, developers, indie makers, researchers and visual accounts through block types, and more audiences later by adding blocks.

## Decisions
- Single owner, password login (HMAC cookie). No multi-tenant, billing or username registry.
- One Worker: SSR public pages from the same React components the editor renders (WYSIWYG).
- D1 holds `settings` (site JSON), `pages` (blocks as JSON per page) and `events`. Schema applied lazily so the deploy button needs no migration step.
- Analytics in D1, not Analytics Engine: querying AE needs an account API token, which breaks one-click setup. Personal traffic volumes fit D1.
- Tracked links via `/go/:page/:block?i=n`, resolved from saved content (no open redirect).
- AI via fal `openrouter/router` OpenAI-compatible endpoint with tool calling; voice via fal Wizper (`language: null` to avoid translation to English).
- Onboarding: scrape in the Worker (HTMLRewriter, GitHub/arXiv/Crossref/iTunes/oEmbed/fxtwitter APIs), one forced `build_site` tool call, mirror images to R2, stream progress as NDJSON.
- Visible AI: tools execute client-side through a cursor overlay. Cua Driver itself is a macOS daemon and can't run in a browser, so its six motions are reimplemented in `src/cursor/motion.ts`.
- Blocks are a registry (`src/shared/blocks.tsx`) that drives rendering, forms, AI docs, validation and tracking.

## Out of scope (v1)
Long-form posts, scheduled links, link expiry, A/B tests, team access, custom CSS.
