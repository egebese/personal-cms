// Runs the assistant's tool calls against the editor, with the Wizz cursor acting each one out.
import { api } from './api'
import { cursor, frame, sleep } from '../cursor/cursor'
import { addBlock, currentPage, edit, findBlock, getState, newPage, setUI } from './store'
import { BLOCKS } from '../shared/blocks'
import { cleanSlug, validSlug, type Size } from '../shared/types'

const q = (sel: string) => document.querySelector(sel)
const blockEl = (id: string) => q(`[data-block="${id}"]`)
const settle = async () => { await frame(); await frame() }

// Types `text` into a field one chunk at a time so the edit reads as typing.
async function typeInto(apply: (partial: string) => void, text: string) {
  cursor.state('text')
  const steps = Math.min(text.length, 28)
  for (let i = 1; i <= steps; i++) {
    apply(text.slice(0, Math.ceil((text.length * i) / steps)))
    await sleep(22)
  }
}

const TEXT_KEYS = ['title', 'text', 'name', 'caption', 'tagline']

async function fillFromUrl(type: string, data: any) {
  const url = data.url || data.ios || data.android
  const missing = url && !(data.title || data.name || data.repo)
  if (!missing) return { type, data }
  cursor.state('observe', 'Reading link')
  const u = await api.unfurl(url).catch(() => null)
  if (!u) return { type, data }
  // Keep the model's type when it asked for something specific, unless the link clearly is something else.
  return { type: type === 'link' ? u.type : type, data: { ...u.data, ...data } }
}

export type ToolResult = Record<string, unknown>

export async function runTool(name: string, args: any): Promise<ToolResult> {
  const s = getState()
  switch (name) {
    case 'add_block': {
      if (!BLOCKS[args.type]) return { error: `unknown type ${args.type}` }
      await cursor.moveTo(q('[data-cursor="add"]'), 'click')
      await cursor.click()
      const filled = await fillFromUrl(args.type, args.data || {})
      const def = BLOCKS[filled.type] || BLOCKS[args.type]
      const type = BLOCKS[filled.type] ? filled.type : args.type
      const size: Size = def.sizes.includes(args.size) ? args.size : def.size
      const text = TEXT_KEYS.map((k) => [k, filled.data[k]]).find(([, v]) => typeof v === 'string' && v)
      const id = addBlock({ type, size, data: text ? { ...filled.data, [text[0]]: '' } : filled.data }, args.index)
      setUI({ selected: id })
      await settle()
      await cursor.moveTo(blockEl(id), 'text')
      if (text) await typeInto((v) => edit((d) => { findBlock(id, d)!.block.data[text[0]] = v }, { history: false }), text[1])
      return { ok: true, id, type, size }
    }
    case 'update_block': {
      const f = findBlock(args.id)
      if (!f) return { error: 'no block with that id' }
      if (f.page.id !== s.current) { setUI({ current: f.page.id }); await settle() }
      await cursor.moveTo(blockEl(args.id), 'click')
      await cursor.click()
      setUI({ selected: args.id })
      const data = { ...(args.data || {}) }
      const textKey = Object.keys(data).find((k) => TEXT_KEYS.includes(k) && typeof data[k] === 'string')
      const rest = { ...data }
      if (textKey) delete rest[textKey]
      edit((d) => {
        const b = findBlock(args.id, d)!.block
        Object.assign(b.data, rest)
        if (args.size && BLOCKS[b.type].sizes.includes(args.size)) b.size = args.size
      })
      if (textKey) await typeInto((v) => edit((d) => { findBlock(args.id, d)!.block.data[textKey] = v }, { history: false }), data[textKey])
      return { ok: true }
    }
    case 'remove_block': {
      const f = findBlock(args.id)
      if (!f) return { error: 'no block with that id' }
      if (f.page.id !== s.current) { setUI({ current: f.page.id }); await settle() }
      const el = blockEl(args.id)
      await cursor.moveTo(el, 'click')
      await cursor.click()
      await el?.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9 }], { duration: 220, easing: 'ease-in' }).finished
      edit((d) => { const g = findBlock(args.id, d)!; g.page.blocks.splice(g.index, 1) })
      setUI({ selected: null })
      return { ok: true }
    }
    case 'move_block': {
      const f = findBlock(args.id)
      if (!f) return { error: 'no block with that id' }
      const to = Math.max(0, Math.min(Number(args.index) || 0, f.page.blocks.length - 1))
      const target = f.page.blocks[to]
      await cursor.moveTo(blockEl(args.id), 'drag', 'Grabbing')
      await cursor.click()
      await cursor.moveTo(blockEl(target.id), 'drag')
      edit((d) => { const g = findBlock(args.id, d)!; const [b] = g.page.blocks.splice(g.index, 1); g.page.blocks.splice(to, 0, b) })
      return { ok: true }
    }
    case 'update_profile': {
      for (const k of ['avatar', 'name', 'bio'] as const) {
        if (typeof args[k] !== 'string') continue
        await cursor.moveTo(q(`[data-cursor="${k}"]`), 'click')
        await cursor.click()
        setUI({ selected: '@profile' })
        if (k === 'avatar') edit((d) => { d.site.avatar = args.avatar })
        else {
          edit((d) => { d.site[k] = '' })
          await typeInto((v) => edit((d) => { d.site[k] = v }, { history: false }), args[k])
        }
      }
      return { ok: true }
    }
    case 'set_theme': {
      await cursor.moveTo(q('[data-cursor="theme"]'), 'click')
      await cursor.click()
      edit((d) => {
        for (const k of ['preset', 'accent', 'font'] as const) if (typeof args[k] === 'string') d.site.theme[k] = args[k]
      })
      cursor.configure(getState().site.cursor, getState().site.theme.accent)
      return { ok: true }
    }
    case 'add_page': {
      const slug = cleanSlug(args.slug || args.title || '')
      if (!slug || !validSlug(slug)) return { error: `"${args.slug}" can't be a page address` }
      if (s.pages.some((p) => p.slug === slug)) return { error: 'a page with that address exists' }
      await cursor.moveTo(q('[data-cursor="page-add"]'), 'click')
      await cursor.click()
      newPage(String(args.title || slug), slug)
      return { ok: true, slug }
    }
    case 'update_page': {
      const p = currentPage()
      const slug = args.slug != null ? cleanSlug(args.slug) : p.slug
      if (p.slug === '' && slug !== '') return { error: 'the home page keeps the empty address' }
      if (!validSlug(slug) || s.pages.some((x) => x.slug === slug && x.id !== p.id)) return { error: 'address taken or invalid' }
      await cursor.moveTo(q(`[data-cursor="page-${p.slug || 'home'}"]`), 'click')
      await cursor.click()
      edit((d) => { const x = d.pages.find((y) => y.id === p.id)!; x.slug = slug; if (args.title) x.title = args.title })
      return { ok: true }
    }
    case 'open_page': {
      const p = s.pages.find((x) => x.slug === (args.slug || ''))
      if (!p) return { error: 'no such page' }
      await cursor.moveTo(q(`[data-cursor="page-${p.slug || 'home'}"]`), 'navigate')
      await cursor.click()
      setUI({ current: p.id, selected: null })
      return { ok: true }
    }
    case 'lookup_url': {
      cursor.show()
      cursor.state('observe', 'Reading link')
      try { return await api.unfurl(args.url) } catch (e: any) { return { error: e.message } }
    }
  }
  return { error: `unknown tool ${name}` }
}

// What the model sees each turn.
export function context() {
  const s = getState()
  return {
    current_page: currentPage(s)?.slug ?? '',
    profile: { name: s.site.name, bio: s.site.bio, avatar: s.site.avatar },
    theme: s.site.theme,
    pages: s.pages.map((p) => ({ slug: p.slug, title: p.title, blocks: p.blocks })),
  }
}

export interface ChatMsg { role: 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: any[]; tool_call_id?: string }

// Loops model -> tools -> model until the model answers without tools.
export async function runAgent(history: ChatMsg[], onChange: (h: ChatMsg[]) => void, signal: { stop: boolean }) {
  const msgs = [...history]
  const start = document.querySelector('[data-cursor="chat-send"]')?.getBoundingClientRect()
  cursor.configure(getState().site.cursor, getState().site.theme.accent)
  cursor.show(start ? { x: start.left, y: start.top } : undefined)
  cursor.state('observe', 'Thinking')
  setUI({ busy: true })
  try {
    for (let turn = 0; turn < 12 && !signal.stop; turn++) {
      const { message } = await api.chat(msgs, context())
      msgs.push({ role: 'assistant', content: message?.content ?? null, tool_calls: message?.tool_calls })
      onChange([...msgs])
      if (!message?.tool_calls?.length) break
      for (const call of message.tool_calls) {
        let result: ToolResult
        try { result = signal.stop ? { error: 'stopped by owner' } : await runTool(call.function.name, JSON.parse(call.function.arguments || '{}')) }
        catch (e: any) { result = { error: e.message } }
        msgs.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
        onChange([...msgs])
      }
      cursor.state('observe', 'Thinking')
    }
  } finally {
    setUI({ busy: false })
    cursor.hideSoon()
  }
  return msgs
}

// Puts an AI-built site in place as empty pages; the editor then plays the blocks in (see playPending).
export function startBuild(site: any, pages: any[]) {
  edit((d) => {
    d.site = { ...d.site, ...site, name: '', bio: '' }
    d.pages = pages.map((p) => ({ ...p, blocks: [] }))
  })
  setUI({ current: pages[0].id, selected: null, pending: { site, pages } })
}

// Plays the pending site into the editor block by block, with the cursor placing each one.
export async function playPending() {
  const job = getState().pending
  if (!job) return
  setUI({ pending: null, busy: true })
  const { site, pages } = job
  cursor.configure(getState().site.cursor, site.theme?.accent || '#3d2bff')
  cursor.show({ x: innerWidth / 2, y: innerHeight - 60 })
  await settle()
  await runTool('update_profile', { name: site.name, bio: site.bio })
  for (const p of pages) {
    if (p.id !== getState().current) await runTool('open_page', { slug: p.slug })
    for (const b of p.blocks) {
      edit((d) => { d.pages.find((x) => x.id === p.id)!.blocks.push(b) }, { history: false })
      await settle()
      await cursor.moveTo(blockEl(b.id), 'observe', 'Placing')
    }
  }
  setUI({ current: pages[0].id, selected: null, busy: false })
  cursor.hideSoon()
}
