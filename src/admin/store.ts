import { useSyncExternalStore } from 'react'
import { api } from './api'
import { defaultSite, uid, type Block, type Page, type Site } from '../shared/types'

// One store shared by React and the AI agent, so the agent can edit without going through components.
export interface State {
  site: Site
  pages: Page[]
  current: string // page id
  selected: string | null // block id, '@profile' or '@page'
  save: 'saved' | 'dirty' | 'saving' | 'error'
  saveError?: string
  loaded: boolean
  busy: boolean // the agent is driving the editor
  pending: { site: Site; pages: Page[] } | null // AI-built site waiting to be played into the editor
}

type Doc = { site: Site; pages: Page[] }
let state: State = { site: defaultSite(), pages: [], current: '', selected: null, save: 'saved', loaded: false, busy: false, pending: null }
const listeners = new Set<() => void>()
const past: Doc[] = []
let future: Doc[] = []
let timer: any

const emit = () => listeners.forEach((l) => l())
export const getState = () => state
export const useStore = <T,>(pick: (s: State) => T) => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => pick(state))

export function setUI(patch: Partial<State>) {
  state = { ...state, ...patch }
  emit()
}

// Every content change goes through here: it records undo history and schedules a save.
export function edit(fn: (d: Doc) => void, { history = true } = {}) {
  const doc: Doc = structuredClone({ site: state.site, pages: state.pages })
  if (history) { past.push({ site: state.site, pages: state.pages }); if (past.length > 100) past.shift(); future = [] }
  fn(doc)
  state = { ...state, ...doc, save: 'dirty' }
  emit()
  clearTimeout(timer)
  timer = setTimeout(save, 900)
}

// Records an undo point before a run of small edits (e.g. typing in a field) that skip history.
export function checkpoint() {
  past.push({ site: state.site, pages: state.pages })
  future = []
}

export function undo() {
  const d = past.pop()
  if (!d) return
  future.push({ site: state.site, pages: state.pages })
  restore(d)
}
export function redo() {
  const d = future.pop()
  if (!d) return
  past.push({ site: state.site, pages: state.pages })
  restore(d)
}
function restore(d: Doc) {
  const current = d.pages.some((p) => p.id === state.current) ? state.current : d.pages[0]?.id
  state = { ...state, ...d, current, save: 'dirty' }
  emit()
  clearTimeout(timer)
  timer = setTimeout(save, 900)
}

export async function save() {
  clearTimeout(timer)
  if (state.save === 'saved') return
  setUI({ save: 'saving' })
  const snapshot = state.pages
  try {
    await api.save(state.site, state.pages)
    setUI({ save: state.pages === snapshot ? 'saved' : 'dirty', saveError: undefined })
    if (state.pages !== snapshot) timer = setTimeout(save, 900)
  } catch (e: any) {
    setUI({ save: 'error', saveError: e.message })
  }
}

export async function load() {
  const { site, pages } = await api.state()
  state = { ...state, site, pages, current: pages[0]?.id || '', loaded: true, save: 'saved' }
  past.length = 0
  future = []
  emit()
}

// ---------- helpers used by components and the agent ----------
export const currentPage = (s = state) => s.pages.find((p) => p.id === s.current) || s.pages[0]
export const findBlock = (id: string, d: Doc = state) => {
  for (const p of d.pages) {
    const i = p.blocks.findIndex((b) => b.id === id)
    if (i >= 0) return { page: p, block: p.blocks[i], index: i }
  }
  return null
}

export function addBlock(b: Omit<Block, 'id'>, index?: number, pageId = state.current) {
  const id = uid()
  edit((d) => {
    const p = d.pages.find((x) => x.id === pageId)!
    const at = index == null ? p.blocks.length : Math.max(0, Math.min(index, p.blocks.length))
    p.blocks.splice(at, 0, { ...b, id })
  })
  return id
}

export function newPage(title: string, slug: string) {
  const id = uid()
  edit((d) => { d.pages.push({ id, slug, title, blocks: [] }) })
  setUI({ current: id, selected: null })
  return id
}
