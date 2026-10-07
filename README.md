# linkwizz

A personal link-in-bio site you host yourself on Cloudflare. Bento-style grid, drag-and-drop editor, dub-style click analytics, and an AI assistant (Wizz) that builds and edits the page while you watch its cursor do it.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/egebese/personal-cms)

## What you get

- **Pages at `/` and `/<slug>`**: a home page plus as many extra pages as you want (`/research`, `/apps`, ...). Use your own domain from the Cloudflare dashboard.
- **Blocks**: link (auto brand icons for 40 platforms), section title, note, GitHub repo (live stars), paper (arXiv, DOI, any page with citation meta), app (App Store / Google Play / web), image, board (mood board), video, saved list.
- **Editor at `/admin`**: drag to reorder, four sizes per block, paste a link or an image anywhere to add it, undo/redo, phone and desktop preview, six themes, five display fonts.
- **AI onboarding**: paste your Instagram, X, GitHub, site or old Linktree. A Worker reads them and the model lays out your photo, bio, pages and blocks. Images are copied into R2 so expiring CDN links don't break your page.
- **Wizz assistant**: chat or talk (Wizper speech-to-text). Every change is acted out by an on-screen cursor using one of six motions modelled on Cua Driver (adaptive, signature arc, spring settle, magnetic, comet swoop, classic) with Fitts / native / fixed timing and trail, glow, ripple, squish and magnet effects.
- **Analytics**: views, unique visitors (daily-rotating hash, no cookies), clicks and click rate over 24h/7d/30d/90d, with top links, pages, referrers, countries, devices, in-app browsers (Instagram, TikTok, X...), OS and `utm_source`. Click any row to filter. Every outbound link goes through `/go/...`, which only redirects to URLs saved on your page.

## Deploy

### One click

Press the button above. Cloudflare forks the repo, creates the D1 database and R2 bucket, and asks for two secrets:

| Secret | What it is |
|---|---|
| `ADMIN_PASSWORD` | Password for `/admin` |
| `FAL_KEY` | [fal.ai API key](https://fal.ai/dashboard/keys) for the assistant, onboarding and voice |

Open `https://<your-worker>.workers.dev/admin`, sign in, and paste your links. The database schema is created on the first request, so there is no migration step.

### From your machine

```bash
npm install
npx wrangler login
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put FAL_KEY
npm run build && npx wrangler deploy   # creates the D1 database and R2 bucket on first deploy
```

### Your own domain

Cloudflare dashboard → Workers & Pages → linkwizz → Settings → Domains & Routes → Add → Custom domain. The domain has to be on the same Cloudflare account.

## Develop

```bash
cp .dev.vars.example .dev.vars   # fill in both values
npm install
npm run dev                      # http://localhost:5173/admin
npm test                         # motion math, UA parsing, slugs
npm run typecheck
```

## How it fits together

One Worker serves everything:

```
worker/index.ts      routes: public pages (SSR), /go redirects, /media (R2), /api/*, /admin (SPA)
worker/scrape.ts     unfurl one URL into a block; gather sources for onboarding
worker/fal.ts        fal openrouter/router (OpenAI-compatible, tool calling) + Wizper
worker/analytics.ts  event logging and the report queries (D1)
src/shared/          block registry, themes, layout and CSS used by both SSR and the editor
src/admin/           editor, inspector, Wizz chat + agent, analytics, settings, onboarding
src/cursor/          motion math (pure, tested) and the cursor overlay
```

The assistant's tools run in the browser, not on the server: the model asks for `add_block`, `move_block` and so on, and `src/admin/agent.ts` performs each one with the cursor, then sends the result back. That is what makes the edits visible.

### Adding a block type

Add one entry to `BLOCKS` in `src/shared/blocks.tsx`: label, hint, allowed sizes, fields, `links()` (outbound URLs, for tracking) and `view()`. The editor form, add menu, AI prompts, validation and click tracking all read from it. Add CSS for it in `src/shared/public.css`.

### Model

`AI_MODEL` in `wrangler.jsonc` (default `anthropic/claude-sonnet-4.6`). Any model on fal's OpenRouter router that supports tool calling works.

## License

MIT
