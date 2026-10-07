import { useRef, useState } from 'react'
import { BLOCKS, type Field } from '../shared/blocks'
import { cleanSlug, validSlug } from '../shared/types'
import { checkpoint, currentPage, edit, findBlock, setUI, useStore } from './store'
import { api } from './api'
import { Icon, SizeGlyph, SIZE_NAMES } from './ui'

// Typing goes through edit(..., {history: false}); focusing a field records one undo point.
const typed = (fn: Parameters<typeof edit>[0]) => edit(fn, { history: false })

export function Inspector() {
  const selected = useStore((s) => s.selected)
  if (selected === '@profile') return <ProfileForm />
  if (selected === '@page') return <PageForm />
  if (selected) return <BlockForm id={selected} />
  return <p className="ad-pad ad-muted">Select a block, your name or a page tab to edit it.</p>
}

function ProfileForm() {
  const site = useStore((s) => s.site)
  return (
    <div className="ad-form">
      <h3>Profile</h3>
      <ImageInput label="Photo" value={site.avatar} round onChange={(v) => typed((d) => { d.site.avatar = v })} />
      <TextInput label="Name" value={site.name} onChange={(v) => typed((d) => { d.site.name = v })} />
      <TextInput label="Bio" multiline value={site.bio} onChange={(v) => typed((d) => { d.site.bio = v })} hint={`${site.bio.length}/160`} />
    </div>
  )
}

function PageForm() {
  const page = useStore((s) => currentPage(s))
  const pages = useStore((s) => s.pages)
  const [slug, setSlug] = useState(page.slug)
  const home = page.slug === ''
  const clash = pages.some((p) => p.slug === slug && p.id !== page.id)
  const bad = !home && (!slug || !validSlug(slug) || clash)
  return (
    <div className="ad-form" key={page.id}>
      <h3>Page</h3>
      <TextInput label="Title" value={page.title} onChange={(v) => typed((d) => { d.pages.find((p) => p.id === page.id)!.title = v })} />
      <label className="ad-field">
        <span>Address</span>
        <div className="ad-prefix">
          <em>{location.host}/</em>
          <input
            value={home ? '' : slug}
            disabled={home}
            placeholder={home ? 'home page' : ''}
            onChange={(e) => setSlug(cleanSlug(e.target.value))}
            onBlur={() => { if (!bad && slug !== page.slug) edit((d) => { d.pages.find((p) => p.id === page.id)!.slug = slug }) }}
          />
        </div>
        {bad && <small className="ad-error">{clash ? 'Another page uses this address.' : 'Use lowercase letters, numbers and dashes. Some words are reserved.'}</small>}
      </label>
      {!home && (
        <button className="ad-btn ad-danger" onClick={() => {
          if (!confirm(`Delete "${page.title}" and its ${page.blocks.length} blocks?`)) return
          edit((d) => { d.pages = d.pages.filter((p) => p.id !== page.id) })
          setUI({ current: pages[0].id, selected: null })
        }}><Icon name="trash" size={16} /> Delete page</button>
      )}
    </div>
  )
}

function BlockForm({ id }: { id: string }) {
  const b = useStore((s) => findBlock(id, s)?.block)
  const [filling, setFilling] = useState(false)
  const [err, setErr] = useState('')
  if (!b) return <p className="ad-pad ad-muted">That block was removed.</p>
  const def = BLOCKS[b.type]
  const set = (k: string, v: unknown) => typed((d) => { findBlock(id, d)!.block.data[k] = v })
  const url = b.data.url || b.data.ios || b.data.android

  return (
    <div className="ad-form" key={id}>
      <h3>{def.label}</h3>
      {def.sizes.length > 1 && (
        <div className="ad-field">
          <span>Size</span>
          <div className="ad-seg ad-seg-wide" role="group">
            {def.sizes.map((s) => (
              <button key={s} aria-pressed={b.size === s} onClick={() => edit((d) => { findBlock(id, d)!.block.size = s })}>
                <SizeGlyph size={s} /> {SIZE_NAMES[s]}
              </button>
            ))}
          </div>
        </div>
      )}
      {def.fields.map((f) => <FieldInput key={f.key} f={f} value={b.data[f.key]} onChange={(v) => set(f.key, v)} />)}
      {url && (
        <button className="ad-btn" disabled={filling} onClick={async () => {
          setFilling(true); setErr('')
          try {
            const u = await api.unfurl(url)
            edit((d) => { const x = findBlock(id, d)!.block; if (BLOCKS[u.type] && u.type !== x.type && !Object.keys(x.data).some((k) => k !== 'url' && x.data[k])) { x.type = u.type; x.size = BLOCKS[u.type].size } x.data = { ...x.data, ...u.data } })
          } catch (e: any) { setErr(e.message) } finally { setFilling(false) }
        }}><Icon name="sparkle" size={16} /> {filling ? 'Reading link…' : 'Refresh from link'}</button>
      )}
      {err && <p className="ad-error">{err}</p>}
      <button className="ad-btn ad-danger" onClick={() => {
        edit((d) => { const g = findBlock(id, d)!; g.page.blocks.splice(g.index, 1) })
        setUI({ selected: null })
      }}><Icon name="trash" size={16} /> Delete block</button>
    </div>
  )
}

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  if (f.kind === 'image') return <ImageInput label={f.label} value={value || ''} onChange={onChange} />
  if (f.kind === 'list') return <ListInput f={f} value={value || []} onChange={onChange} />
  return (
    <TextInput
      label={f.label}
      value={value ?? ''}
      multiline={f.kind === 'textarea'}
      type={f.kind === 'number' ? 'number' : f.kind === 'url' ? 'url' : 'text'}
      onChange={(v) => onChange(f.kind === 'number' ? (v === '' ? null : Number(v)) : v)}
    />
  )
}

function TextInput({ label, value, onChange, multiline, type = 'text', hint }: {
  label: string; value: string | number; onChange: (v: string) => void; multiline?: boolean; type?: string; hint?: string
}) {
  const props = { value: value ?? '', onFocus: checkpoint, onChange: (e: any) => onChange(e.target.value) }
  return (
    <label className="ad-field">
      <span>{label}{hint && <em>{hint}</em>}</span>
      {multiline ? <textarea rows={4} {...props} /> : <input type={type} inputMode={type === 'url' ? 'url' : undefined} {...props} />}
    </label>
  )
}

function ImageInput({ label, value, onChange, round }: { label: string; value: string; onChange: (v: string) => void; round?: boolean }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div className="ad-field">
      <span>{label}</span>
      <div className="ad-image">
        <button type="button" className={'ad-thumb' + (round ? ' round' : '')} onClick={() => file.current?.click()} aria-label={`Upload ${label.toLowerCase()}`}>
          {value ? <img src={value} alt="" /> : <Icon name="image" />}
        </button>
        <div className="ad-image-side">
          <button type="button" className="ad-btn ad-small" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Uploading…' : 'Upload'}</button>
          <input value={value} placeholder="or paste an image URL" onFocus={checkpoint} onChange={(e) => onChange(e.target.value)} aria-label={`${label} URL`} />
        </div>
      </div>
      {err && <small className="ad-error">{err}</small>}
      <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(true); setErr('')
        try { checkpoint(); onChange((await api.upload(f)).url) } catch (x: any) { setErr(x.message) } finally { setBusy(false) }
      }} />
    </div>
  )
}

function ListInput({ f, value, onChange }: { f: Field; value: any[]; onChange: (v: any[]) => void }) {
  const set = (i: number, k: string, v: any) => onChange(value.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const move = (i: number, by: number) => {
    const n = [...value]
    const [x] = n.splice(i, 1)
    n.splice(Math.max(0, Math.min(n.length, i + by)), 0, x)
    checkpoint()
    onChange(n)
  }
  return (
    <div className="ad-field">
      <span>{f.label}</span>
      <ol className="ad-list">
        {value.map((item, i) => (
          <li key={i}>
            {f.of!.map((sub) => <FieldInput key={sub.key} f={sub} value={item[sub.key]} onChange={(v) => set(i, sub.key, v)} />)}
            <div className="ad-list-tools">
              <button type="button" className="ad-btn ad-small" disabled={!i} onClick={() => move(i, -1)}>Up</button>
              <button type="button" className="ad-btn ad-small" disabled={i === value.length - 1} onClick={() => move(i, 1)}>Down</button>
              <button type="button" className="ad-btn ad-small ad-danger" onClick={() => { checkpoint(); onChange(value.filter((_, j) => j !== i)) }}>Remove</button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="ad-btn ad-small" onClick={() => { checkpoint(); onChange([...value, {}]) }}><Icon name="plus" size={14} /> Add item</button>
    </div>
  )
}
