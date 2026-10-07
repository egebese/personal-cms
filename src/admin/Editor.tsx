import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PublicLayout } from '../shared/layout'
import { BLOCKS, BlockView, cellClass } from '../shared/blocks'
import { FONTS, PRESETS, fontHref, themeVars } from '../shared/theme'
import { cleanSlug, type Block } from '../shared/types'
import { addBlock, currentPage, edit, getState, newPage, redo, setUI, undo, useStore } from './store'
import { api } from './api'
import { Icon, SizeGlyph, SIZE_NAMES } from './ui'
import { Inspector } from './Inspector'
import { Chat } from './Chat'
import { playPending } from './agent'

export function Editor({ falReady }: { falReady: boolean }) {
  const site = useStore((s) => s.site)
  const pages = useStore((s) => s.pages)
  const page = useStore((s) => currentPage(s))
  const selected = useStore((s) => s.selected)
  const [preview, setPreview] = useState<'desktop' | 'mobile'>(innerWidth < 900 ? 'mobile' : 'desktop')
  const [panel, setPanel] = useState<'chat' | 'inspect'>('chat')
  const [sheet, setSheet] = useState(false) // mobile: side panel open as a bottom sheet
  const [dragId, setDragId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => { playPending() }, [])

  // Selecting something opens its settings.
  // (Not while Wizz is working: its selections shouldn't hide the chat.)
  useEffect(() => { if (selected && !getState().busy) setPanel('inspect') }, [selected])

  // Editor shows the chosen display font too.
  useEffect(() => {
    let link = document.getElementById('lw-font') as HTMLLinkElement | null
    if (!link) { link = Object.assign(document.createElement('link'), { id: 'lw-font', rel: 'stylesheet' }); document.head.append(link) }
    link.href = fontHref(site.theme.font)
  }, [site.theme.font])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3500) }

  // Paste a URL or an image anywhere to add it, like a scrapbook.
  const addFromUrl = async (url: string) => {
    try {
      const u = await api.unfurl(url)
      const def = BLOCKS[u.type]
      const id = addBlock({ type: u.type, size: (u.size as any) || def.size, data: u.data })
      setUI({ selected: id })
    } catch (e: any) { flash(e.message) }
  }
  const addImage = async (file: File) => {
    try {
      const { url } = await api.upload(file)
      const id = addBlock({ type: 'image', size: 'l', data: { src: url } })
      setUI({ selected: id })
    } catch (e: any) { flash(e.message) }
  }
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'))
      if (file) { e.preventDefault(); addImage(file); return }
      const text = e.clipboardData?.getData('text')?.trim() || ''
      if (/^https?:\/\/\S+$/.test(text)) { e.preventDefault(); addFromUrl(text) }
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
      const sel = getState().selected
      if ((e.key === 'Backspace' || e.key === 'Delete') && sel && !sel.startsWith('@')) {
        edit((d) => { for (const p of d.pages) p.blocks = p.blocks.filter((b) => b.id !== sel) })
        setUI({ selected: null })
      }
      if (e.key === 'Escape') setUI({ selected: null })
    }
    addEventListener('paste', onPaste)
    addEventListener('keydown', onKey)
    return () => { removeEventListener('paste', onPaste); removeEventListener('keydown', onKey) }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    if (!e.over || e.active.id === e.over.id) return
    edit((d) => {
      const p = d.pages.find((x) => x.id === page.id)!
      const from = p.blocks.findIndex((b) => b.id === e.active.id)
      const to = p.blocks.findIndex((b) => b.id === e.over!.id)
      p.blocks = arrayMove(p.blocks, from, to)
    })
  }
  const dragged = dragId ? page?.blocks.find((b) => b.id === dragId) : null

  // Links inside the canvas select instead of navigating; page tabs switch pages.
  const onCanvasClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    if (a) e.preventDefault()
    const tab = a?.getAttribute('href')
    if (tab?.startsWith('#page:')) {
      const p = pages.find((x) => x.slug === tab.slice(6))
      if (p) setUI({ current: p.id, selected: null })
    }
  }

  const vars = useMemo(() => themeVars(site), [site])
  if (!page) return null

  const profile = (
    <>
      <button className="ed-hit" data-cursor="avatar" onClick={() => setUI({ selected: '@profile' })} aria-label="Edit photo">
        {site.avatar ? <img className="lw-avatar" src={site.avatar} alt="" /> : <span className="lw-avatar lw-avatar-blank">{(site.name || '?')[0]}</span>}
      </button>
      <button className="ed-hit" data-cursor="name" onClick={() => setUI({ selected: '@profile' })}>
        <h1 className="lw-name">{site.name || <span className="ed-ph">Your name</span>}</h1>
      </button>
      <button className="ed-hit" data-cursor="bio" onClick={() => setUI({ selected: '@profile' })}>
        <p className="lw-bio">{site.bio || <span className="ed-ph">Add a short bio</span>}</p>
      </button>
    </>
  )

  const side = (
    <aside className={'ad-side' + (sheet ? ' open' : '')} aria-label="Assistant and settings">
      <div className="ad-side-tabs" role="tablist">
        <button role="tab" aria-selected={panel === 'chat'} onClick={() => setPanel('chat')}><Icon name="sparkle" size={16} /> Wizz</button>
        <button role="tab" aria-selected={panel === 'inspect'} onClick={() => setPanel('inspect')} disabled={!selected}>
          <Icon name="edit" size={16} /> {selected === '@profile' ? 'Profile' : selected === '@page' ? 'Page' : 'Block'}
        </button>
        <button className="ad-sheet-close" onClick={() => setSheet(false)} aria-label="Close"><Icon name="close" /></button>
      </div>
      {panel === 'chat' ? <Chat falReady={falReady} /> : <Inspector />}
    </aside>
  )

  return (
    <div className="ad-editor">
      <section className="ad-workspace">
        <div className="ad-pagebar">
          <div className="ad-pages" role="tablist" aria-label="Pages">
            {pages.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={p.id === page.id}
                data-cursor={'page-' + (p.slug || 'home')}
                onClick={() => setUI({ current: p.id, selected: p.id === page.id ? '@page' : null })}
                title="Click again for page settings"
              >
                {p.title || 'Untitled'}<small>/{p.slug}</small>
              </button>
            ))}
            <button
              className="ad-icon-btn"
              data-cursor="page-add"
              aria-label="Add page"
              onClick={() => {
                let n = pages.length + 1
                while (pages.some((p) => p.slug === 'page-' + n)) n++
                newPage('New page', cleanSlug('page-' + n))
                setUI({ selected: '@page' })
              }}
            ><Icon name="plus" size={16} /></button>
          </div>
          <div className="ad-pagebar-tools">
            <button className="ad-icon-btn" onClick={undo} aria-label="Undo" title="Undo (⌘Z)"><Icon name="undo" size={16} /></button>
            <button className="ad-icon-btn" onClick={redo} aria-label="Redo" title="Redo (⇧⌘Z)"><Icon name="redo" size={16} /></button>
            <div className="ad-seg" role="group" aria-label="Preview size">
              <button aria-pressed={preview === 'desktop'} onClick={() => setPreview('desktop')} aria-label="Desktop preview"><Icon name="desktop" size={16} /></button>
              <button aria-pressed={preview === 'mobile'} onClick={() => setPreview('mobile')} aria-label="Phone preview"><Icon name="phone" size={16} /></button>
            </div>
          </div>
        </div>

        <div
          className={'ad-canvas ad-canvas-' + preview}
          onClick={(e) => { if (e.target === e.currentTarget) setUI({ selected: null }) }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
          onDrop={(e) => {
            const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'))
            if (f) { e.preventDefault(); addImage(f) }
          }}
        >
          <div className="ad-frame">
            <div className="lw-root" style={vars as any} onClickCapture={onCanvasClick}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => { setDragId(String(e.active.id)); setUI({ selected: null }) }}
                onDragEnd={onDragEnd}
                onDragCancel={() => setDragId(null)}
              >
                <SortableContext items={page.blocks.map((b) => b.id)} strategy={rectSortingStrategy}>
                  <PublicLayout
                    site={site}
                    page={page}
                    pages={pages}
                    link={(b, i) => BLOCKS[b.type]?.links(b.data)[i] || '#'}
                    pageHref={(s) => '#page:' + s}
                    profile={profile}
                    wrap={(b, card) => <Cell b={b} card={card} selected={selected === b.id} />}
                  />
                </SortableContext>
                <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
                  {dragged && (
                    <div className="lw-root ed-overlay" style={vars as any}>
                      <div className={`lw-card lw-t-${dragged.type}`}><BlockView block={dragged} link={() => '#'} /></div>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
              {!page.blocks.length && (
                <div className="ed-empty">
                  <p>This page is empty. Add a block, paste a link anywhere, or ask Wizz.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Dock onUrl={addFromUrl} onPickImage={addImage} />
        {notice && <div className="ad-toast" role="status">{notice}</div>}
        <button className="ad-fab" onClick={() => { setPanel('chat'); setSheet(true) }} aria-label="Open Wizz"><Icon name="sparkle" /> Wizz</button>
      </section>
      {side}
    </div>
  )

}

function Cell({ b, card, selected }: { b: Block; card: React.ReactNode; selected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: b.id })
  return (
    <div
      ref={setNodeRef}
      className={cellClass(b) + ' ed-cell' + (selected ? ' sel' : '') + (isDragging ? ' dragging' : '')}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={BLOCKS[b.type]?.label}
      onClick={() => setUI({ selected: b.id })}
    >
      {card}
      {selected && <BlockTools b={b} />}
    </div>
  )
}

function BlockTools({ b }: { b: Block }) {
  const def = BLOCKS[b.type]
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    // Space/Enter would start a keyboard drag on the cell; other keys (⌘Z) must reach the window.
    <div className="ed-tools" onPointerDown={stop} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }} onClick={stop}>
      {def.sizes.length > 1 && def.sizes.map((s) => (
        <button key={s} aria-pressed={b.size === s} title={SIZE_NAMES[s]} aria-label={SIZE_NAMES[s]}
          onClick={() => edit((d) => { for (const p of d.pages) for (const x of p.blocks) if (x.id === b.id) x.size = s })}>
          <SizeGlyph size={s} />
        </button>
      ))}
      <span className="ed-tools-sep" />
      <button title="Delete" aria-label="Delete block" onClick={() => {
        edit((d) => { for (const p of d.pages) p.blocks = p.blocks.filter((x) => x.id !== b.id) })
        setUI({ selected: null })
      }}><Icon name="trash" size={16} /></button>
    </div>
  )
}

function Dock({ onUrl, onPickImage }: { onUrl: (u: string) => Promise<void>; onPickImage: (f: File) => void }) {
  const [menu, setMenu] = useState<'' | 'add' | 'theme'>('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const site = useStore((s) => s.site)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.ad-dock')) setMenu('') }
    addEventListener('pointerdown', close)
    return () => removeEventListener('pointerdown', close)
  }, [menu])

  return (
    <div className="ad-dock">
      {menu === 'add' && (
        <div className="ad-pop ad-addmenu" role="menu">
          {Object.entries(BLOCKS).map(([type, def]) => (
            <button key={type} role="menuitem" onClick={() => {
              if (type === 'image') { file.current?.click(); setMenu(''); return }
              const id = addBlock({ type, size: def.size, data: {} })
              setUI({ selected: id })
              setMenu('')
            }}>
              <strong>{def.label}</strong>
              <span>{def.hint}</span>
            </button>
          ))}
        </div>
      )}
      {menu === 'theme' && (
        <div className="ad-pop ad-themes">
          <div className="ad-swatches">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} aria-pressed={site.theme.preset === k} onClick={() => edit((d) => { d.site.theme.preset = k })}>
                <span style={{ background: p.bg }}><i style={{ background: p.card, boxShadow: `0 0 0 1px ${p.line}` }} /></span>
                {p.label}
              </button>
            ))}
          </div>
          <div className="ad-row">
            <label className="ad-color">
              <input type="color" value={site.theme.accent} onChange={(e) => edit((d) => { d.site.theme.accent = e.target.value }, { history: false })} />
              Accent
            </label>
            <div className="ad-fonts">
              {Object.entries(FONTS).map(([k, f]) => (
                <button key={k} aria-pressed={site.theme.font === k} style={{ fontFamily: f.family }} onClick={() => edit((d) => { d.site.theme.font = k })}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="ad-dock-bar">
        <button className="ad-btn ad-primary" data-cursor="add" onClick={() => setMenu(menu === 'add' ? '' : 'add')} aria-expanded={menu === 'add'}>
          <Icon name="plus" /> <span className="ad-hide-xs">Add</span>
        </button>
        <form className="ad-urlbox" onSubmit={async (e) => {
          e.preventDefault()
          if (!url.trim()) return
          setBusy(true)
          await onUrl(url.trim())
          setBusy(false)
          setUrl('')
        }}>
          <Icon name="link" size={16} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={busy ? 'Reading link…' : 'Paste a link'} disabled={busy} aria-label="Add a link" />
        </form>
        <button className="ad-icon-btn" onClick={() => file.current?.click()} aria-label="Add image"><Icon name="image" /></button>
        <button className="ad-icon-btn" data-cursor="theme" onClick={() => setMenu(menu === 'theme' ? '' : 'theme')} aria-label="Theme" aria-expanded={menu === 'theme'}><Icon name="palette" /></button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); e.target.value = '' }} />
      </div>
    </div>
  )
}
