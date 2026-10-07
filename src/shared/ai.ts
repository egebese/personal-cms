import { BLOCKS } from './blocks'
import { FONTS, PRESETS } from './theme'
import type { Field } from './blocks'

const fieldDoc = (f: Field): string =>
  f.kind === 'list' ? `${f.key}: [{${f.of!.map(fieldDoc).join(', ')}}]` : `${f.key}${f.kind === 'number' ? ' (number)' : ''}`

export const BLOCK_DOCS = Object.entries(BLOCKS)
  .map(([type, d]) => `- ${type}: ${d.hint} Sizes: ${d.sizes.join('|')}. Data: {${d.fields.map(fieldDoc).join(', ')}}`)
  .join('\n')

export const LAYOUT_DOCS = `Grid: 4 columns on desktop, 2 on phones. Sizes: s = 1x1 square, w = 2 wide x 1 tall, t = 1 wide x 2 tall, l = 2x2, h = full-width section title (heading only).
Good layouts mix sizes so each section fills whole rows (widths per row add up to 4), e.g. w+s+s, l + four s, t+t+w.`

const types = Object.keys(BLOCKS)
const sizes = ['s', 'w', 't', 'l', 'h']
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } })

// Executed in the browser, so every change is animated by the Wizz cursor.
export const EDITOR_TOOLS = [
  fn('add_block', 'Add a block to the current page.', {
    type: { type: 'string', enum: types },
    data: { type: 'object', description: 'Fields for this block type. For a URL you have not looked up, send just {url} and the editor fills the rest.' },
    size: { type: 'string', enum: sizes },
    index: { type: 'integer', description: '0-based position. Omit to append at the end.' },
  }, ['type', 'data']),
  fn('update_block', 'Change a block. Send only the data fields that change; they are merged.', {
    id: { type: 'string' }, data: { type: 'object' }, size: { type: 'string', enum: sizes },
  }, ['id']),
  fn('remove_block', 'Delete a block.', { id: { type: 'string' } }, ['id']),
  fn('move_block', 'Move a block to a new 0-based position on its page.', { id: { type: 'string' }, index: { type: 'integer' } }, ['id', 'index']),
  fn('update_profile', 'Change the name, bio or avatar image URL.', { name: { type: 'string' }, bio: { type: 'string' }, avatar: { type: 'string' } }),
  fn('set_theme', 'Change the look of the site.', {
    preset: { type: 'string', enum: Object.keys(PRESETS) },
    accent: { type: 'string', description: 'Hex colour like #3d2bff' },
    font: { type: 'string', enum: Object.keys(FONTS), description: 'Display font for name and titles' },
  }),
  fn('add_page', 'Create a new page and open it. slug is the URL path without slashes.', { title: { type: 'string' }, slug: { type: 'string' } }, ['title', 'slug']),
  fn('update_page', 'Rename the current page or change its address.', { title: { type: 'string' }, slug: { type: 'string' } }),
  fn('open_page', 'Switch the editor to another page.', { slug: { type: 'string', description: 'Empty string for the home page' } }, ['slug']),
  fn('lookup_url', 'Fetch a URL and get the block it would become (type + data), without adding it.', { url: { type: 'string' } }, ['url']),
]

export const chatSystem = (context: string) => `You are Wizz, the assistant inside linkwizz, a personal link-in-bio site editor.
The owner talks to you (often by voice, so expect transcription slips) and you edit their site with the tools.
Every tool call is animated on screen with your cursor, so act directly instead of describing what you would do.

Rules:
- Make the change, then reply with one short sentence saying what you did. Reply in the owner's language.
- Use real URLs only: ones already on the site, ones the owner gives you, or ones lookup_url returns. Never invent links.
- Keep copy short and in the owner's voice. Titles under 40 characters.
- When asked to "make it look better" or reorganise, think in rows: ${LAYOUT_DOCS}
- If a request is ambiguous about which block, pick the most likely one from the state and say which you changed.

Block types:
${BLOCK_DOCS}

Current editor state (JSON):
${context}`

export const BUILD_SITE_TOOL = fn('build_site', 'Create the whole personal site.', {
  name: { type: 'string' },
  bio: { type: 'string', description: 'Max 160 characters, first person or neutral, in the language the person uses publicly.' },
  avatar: { type: 'string', description: 'Best profile photo URL found in the sources, or empty.' },
  theme: {
    type: 'object',
    properties: { preset: { type: 'string', enum: Object.keys(PRESETS) }, accent: { type: 'string' }, font: { type: 'string', enum: Object.keys(FONTS) } },
  },
  pages: {
    type: 'array',
    description: 'First page is home (slug ""). Add more pages only when there is enough material for them.',
    items: {
      type: 'object',
      properties: {
        slug: { type: 'string' }, title: { type: 'string' },
        blocks: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: types }, size: { type: 'string', enum: sizes }, data: { type: 'object' } }, required: ['type', 'size', 'data'] } },
      },
      required: ['slug', 'title', 'blocks'],
    },
  },
}, ['name', 'bio', 'avatar', 'theme', 'pages'])

export const importSystem = `You build a personal link-in-bio site (bento grid style) from scraped sources about one person.
Decide who they are from the evidence: a creator/influencer, a developer, an indie maker, a researcher, a visual artist, or a mix. Shape the site for that:
- creator: social profiles first as small link blocks, latest/featured content, a short note.
- developer: GitHub repos (github blocks with real star counts), projects, writing.
- indie maker: app blocks for products (App Store / Play / web), launch links, a short note on what they build.
- researcher: paper blocks, a Saved list of references, Google Scholar / ORCID links.
- visual: image and board blocks from their own images, portfolio links.

Rules:
- Only use URLs and images that appear in the sources. Never invent URLs, numbers or facts.
- Home page has 6-16 blocks. Group with heading blocks when there are 2+ groups. Make sections fill whole rows.
- Create extra pages (e.g. "projects", "research", "work") only if there are 6+ items for them; the home page then links the best ones.
- Don't repeat the bio in a note block; a note should say something the bio doesn't (current focus, an offer, a highlight).
- Social profile URLs become small (s) link blocks with just url and a short title like "Instagram" or "@handle".
- Pick a theme preset and accent that fit the person's own imagery or brand colours if visible; otherwise cloud with #3d2bff.

${LAYOUT_DOCS}

Block types:
${BLOCK_DOCS}

Call build_site exactly once.`
