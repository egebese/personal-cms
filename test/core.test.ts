import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plan, progress, duration } from '../src/cursor/motion.ts'
import { parseUA, isBot, refHost } from '../worker/ua.ts'
import { validSlug, cleanSlug } from '../src/shared/types.ts'

const styles = ['signature_arc', 'spring_settle', 'magnetic', 'comet_swoop', 'adaptive', 'classic'] as const

test('every cursor motion starts at the origin and lands on the target', () => {
  const a = { x: 10, y: 400 }, b = { x: 900, y: 120 }
  for (const s of styles) {
    const p = plan(s, 'fitts', a, b, 60)
    const o = p.at(0)
    assert.ok(Math.abs(o.x - a.x) < 1e-6 && Math.abs(o.y - a.y) < 1e-6, s)
    assert.deepEqual(p.at(1), b, s)
    assert.ok(p.ms > 200 && p.ms < 1400, `${s} duration ${p.ms}`)
  }
})

test('spring_settle bounces past the target once; magnetic never does', () => {
  const ts = Array.from({ length: 101 }, (_, i) => i / 100)
  const spring = ts.map((t) => progress('spring_settle', t))
  assert.ok(Math.max(...spring) > 1.03 && Math.max(...spring) < 1.1)
  assert.ok(Math.max(...ts.map((t) => progress('magnetic', t))) <= 1)
  assert.equal(progress('classic', 0.5), 0.5)
})

test('fitts timing grows with distance and shrinks with target size', () => {
  assert.ok(duration('fitts', 800, 40) > duration('fitts', 200, 40))
  assert.ok(duration('fitts', 800, 40) > duration('fitts', 800, 300))
  assert.equal(duration('fixed', 10, 10), 650)
})

test('user agents', () => {
  const ig = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0'
  assert.deepEqual(parseUA(ig), { device: 'Mobile', os: 'iOS', browser: 'Instagram' })
  assert.equal(parseUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141 Safari/537.36').browser, 'Chrome')
  assert.ok(isBot('facebookexternalhit/1.1'))
  assert.ok(!isBot(ig))
  assert.equal(refHost('https://t.co/abc', 'me.dev'), 'x.com')
  assert.equal(refHost('https://me.dev/x', 'me.dev'), 'Direct')
})

test('page slugs', () => {
  assert.ok(validSlug('') && validSlug('research') && validSlug('my-apps'))
  assert.ok(!validSlug('admin') && !validSlug('Bad Slug') && !validSlug('a--b'))
  assert.equal(cleanSlug('  My Apps! '), 'my-apps')
})
