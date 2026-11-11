// The files around the app that nothing compiles: index.html, vercel.json and the public folder. They repeat a
// few facts by hand (the settings key, the page colours, the icon names, the route list); these tests hold the
// copies in step with the source.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../core/disclosures'
import { SETTINGS_STORAGE_KEY } from '../data/settings'
import { LANDING_TITLE } from './navigation'

const root = fileURLToPath(new URL('../../', import.meta.url))
const read = (path: string): string => readFileSync(root + path, 'utf8')
const html = read('index.html')

describe('index.html', () => {
  it('applies the stored settings before the first paint, from the key the app writes', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(script).toContain(`localStorage.getItem('${SETTINGS_STORAGE_KEY}')`)
    for (const attribute of ['data-theme', 'data-density', 'data-pnl']) expect(script).toContain(attribute)
    // The inline script comes before any stylesheet or module script.
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<script type="module"'))
  })

  it('declares the page colour of each scheme as the theme colour', () => {
    const tokens = read('src/ui/tokens/tokens.css')
    const bg = [...tokens.matchAll(/--bg:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase())
    const light = /name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: light\)"/i.exec(html)?.[1]
    const dark = /name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: dark\)"/i.exec(html)?.[1]
    expect(light).toBeDefined()
    expect(dark).toBeDefined()
    expect(bg).toContain(light?.toLowerCase())
    expect(bg).toContain(dark?.toLowerCase())
    expect(light).not.toBe(dark)
  })

  it('has the site title and a description', () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe(LANDING_TITLE)
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{60,}"/)
  })

  it('links only to icons and images that exist in public/', () => {
    const local = [...html.matchAll(/(?:href|content)="(?:%SITE_URL%)?(\/[a-z0-9-]+\.(?:svg|png|ico|webmanifest))"/g)].map((m) => m[1])
    expect(local).toEqual(expect.arrayContaining(['/favicon.svg', '/favicon.png', '/apple-touch-icon.png', '/og-card.png']))
    for (const path of local) expect(existsSync(`${root}public${path}`), path).toBe(true)
  })

  it('preloads font files that are installed', () => {
    const fonts = [...html.matchAll(/rel="preload" as="font"[^>]*href="\/(node_modules\/[^"]+\.woff2)"/g)].map((m) => m[1])
    expect(fonts).toHaveLength(2)
    for (const path of fonts) expect(existsSync(root + path), path).toBe(true)
    // The same files the stylesheet asks for, or the preload would fetch a font nobody uses.
    const serif = readFileSync(`${root}node_modules/@fontsource-variable/source-serif-4/wght.css`, 'utf8')
    const sans = readFileSync(`${root}node_modules/@fontsource-variable/instrument-sans/wdth.css`, 'utf8')
    for (const path of fonts) expect(serif + sans).toContain(path.split('/').pop())
  })

  it('carries no banned promise and no disclaimer tagline', () => {
    const text = [...html.matchAll(/content="([^"]*)"/g)].map((m) => m[1]).join('\n') + (/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '') + (/<noscript>([^<]*)<\/noscript>/.exec(html)?.[1] ?? '')
    expect(findBannedWords(text, BANNED_WORDS)).toEqual([])
    expect(findBannedWords(text, BANNED_TAGLINES)).toEqual([])
  })
})

describe('vercel.json', () => {
  const config = JSON.parse(read('vercel.json')) as { rewrites: { source: string; destination: string }[] }
  // Vercel sources are path-to-regexp patterns; this one is a single regular-expression group.
  const source = config.rewrites[0].source
  const pattern = new RegExp(`^${source}$`)

  it('sends every app route to index.html', () => {
    expect(config.rewrites).toHaveLength(1)
    expect(config.rewrites[0].destination).toBe('/index.html')
    for (const path of ['/', '/markets', '/markets/bond', '/markets/BOND-GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM', '/portfolio/12', '/margin/vault', '/design', '/anything/else']) {
      expect(pattern.test(path), path).toBe(true)
    }
  })

  it('leaves files alone', () => {
    for (const path of ['/assets/index-abc123.js', '/assets/font-abc.woff2', '/favicon.svg', '/og-card.png', '/llms.txt', '/robots.txt', '/sitemap.xml']) {
      expect(pattern.test(path), path).toBe(false)
    }
  })
})

describe('public/llms.txt', () => {
  const llms = read('public/llms.txt')

  it('describes the path routes, not the old hash routes', () => {
    expect(llms).not.toMatch(/#\/(markets|portfolio|reserves|issuer|protect|write|pro)\b/)
    for (const path of ['/markets', '/portfolio', '/requests', '/reserves', '/issuer', '/learn', '/activity', '/margin']) expect(llms, path).toContain(`\`${path}`)
  })

  it('says what the product is in sentences, without disclaimer taglines', () => {
    expect(findBannedWords(llms, BANNED_TAGLINES)).toEqual([])
    expect(llms).toContain('test network')
  })
})
