/**
 * Token contract: parses tokens.css and enforces the contrast pairs of the design brief (section 5.1) for both
 * themes and for the three gain/loss schemes. If a pair fails, adjust the token by the smallest step and record
 * the change in frontend/DESIGN.md.
 */
import { describe, expect, it } from 'vitest'
import { composite, contrastRatio, formatRatio, parseColor } from './contrast'
import type { Rgb } from './contrast'

/*
 * The stylesheets are read from disk: Vitest replaces every CSS import, `?raw` included, with an empty string.
 * Node's file API is loaded through a non-literal specifier and typed here by hand, so this file type-checks
 * inside the browser program without pulling Node's global types into it.
 */
interface DirEntry {
  name: string
  isDirectory(): boolean
}
interface NodeFs {
  readFileSync(path: URL, encoding: 'utf8'): string
  readdirSync(path: URL, options: { withFileTypes: true }): DirEntry[]
}
const nodeFs: string = 'node:fs'
const { readFileSync, readdirSync } = (await import(/* @vite-ignore */ nodeFs)) as NodeFs

const uiDir = new URL('../', import.meta.url)
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

type Tokens = Record<string, string>

/** The declarations of the first rule whose selector text matches, starting the search at `from`. */
function block(source: string, selector: string, from = 0): { tokens: Tokens; end: number } {
  const start = source.indexOf(`${selector} {`, from)
  if (start === -1) throw new Error(`tokens.css: no rule for ${selector}`)
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  const tokens: Tokens = {}
  for (const match of source.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim()
  }
  return { tokens, end: close }
}

const light = block(css, '  :root').tokens
const darkMedia = block(css, ":root:not([data-theme='light'])").tokens
const darkAttr = block(css, ":root[data-theme='dark']").tokens
const classicLight = block(css, ":root[data-pnl='classic']").tokens
const classicDarkMedia = block(css, ":root[data-pnl='classic']:not([data-theme='light'])").tokens
const classicDarkAttr = block(css, ":root[data-pnl='classic'][data-theme='dark']").tokens
const mono = block(css, ":root[data-pnl='mono']").tokens

const THEMES: Record<string, Tokens> = {
  'Paper, teal and orange': light,
  'Carbon, teal and orange': { ...light, ...darkAttr },
  'Paper, green and red': { ...light, ...classicLight },
  'Carbon, green and red': { ...light, ...darkAttr, ...classicDarkAttr },
  'Paper, ink only': { ...light, ...mono },
  'Carbon, ink only': { ...light, ...darkAttr, ...mono },
}

/** Follows `var(--x)` references until a colour is reached. */
function resolve(tokens: Tokens, name: string, depth = 0): string {
  const raw = tokens[name]
  if (raw === undefined) throw new Error(`tokens.css: ${name} is not defined`)
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(raw)
  if (ref && depth < 8) return resolve(tokens, ref[1], depth + 1)
  return raw
}

const GROUNDS = ['--bg', '--surface', '--sunken'] as const
const TEXT_TOKENS = ['--text', '--text-2', '--muted', '--accent', '--gain', '--loss', '--warn', '--danger'] as const

/** Other pairs the components rely on: [foreground, ground, minimum]. */
const EXTRA_PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['--primary-fg', '--primary', 4.5],
  ['--text', '--raised', 4.5],
  ['--text-2', '--raised', 4.5],
  ['--muted', '--raised', 4.5],
  ['--accent', '--raised', 4.5],
  ['--danger', '--raised', 4.5],
  ['--warn', '--raised', 4.5],
  ['--text', '--marker', 4.5],
  ['--text-2', '--marker', 4.5],
  ['--text', '--accent-tint', 4.5],
  ['--text-2', '--accent-tint', 4.5],
  ['--text', '--warn-tint', 4.5],
  ['--warn', '--warn-tint', 4.5],
  ['--text', '--danger-tint', 4.5],
  ['--danger', '--danger-tint', 4.5],
  ['--bg', '--text', 4.5],
  ['--control', '--raised', 3],
]

describe('tokens.css', () => {
  it('defines every colour token of the brief in both themes', () => {
    const required = [
      '--bg', '--surface', '--raised', '--sunken', '--hairline', '--rule', '--control', '--text', '--text-2', '--muted',
      '--accent', '--accent-tint', '--primary', '--primary-fg', '--marker', '--gain', '--loss', '--warn', '--gain-fill',
      '--loss-hatch', '--scrim',
    ]
    for (const name of required) {
      expect(light[name], `${name} in Paper`).toBeDefined()
      expect(darkAttr[name], `${name} in Carbon`).toBeDefined()
    }
  })

  it('keeps the two Carbon rules identical (system preference and data-theme="dark")', () => {
    expect(darkMedia).toEqual(darkAttr)
    expect(classicDarkMedia).toEqual(classicDarkAttr)
  })

  it('keeps the brief values for the grounds and inks', () => {
    expect(light['--bg']).toBe('#f4f2ec')
    expect(light['--text']).toBe('#1a1915')
    expect(light['--accent']).toBe('#2442b8')
    expect(light['--gain']).toBe('#00707a')
    expect(light['--loss']).toBe('#b5451b')
    expect(darkAttr['--bg']).toBe('#121210')
    expect(darkAttr['--text']).toBe('#efece4')
    expect(darkAttr['--accent']).toBe('#93a6ff')
    expect(darkAttr['--gain']).toBe('#4cc3d0')
    expect(darkAttr['--loss']).toBe('#f0884f')
  })
})

/** A wash token, `color-mix(in srgb, var(--x) N%, transparent)`, painted over a ground token. */
function washOver(tokens: Tokens, wash: string, ground: string): Rgb {
  const mix = /^color-mix\(in srgb, var\((--[a-z0-9-]+)\) ([\d.]+)%, transparent\)$/.exec(tokens[wash] ?? '')
  if (!mix) throw new Error(`tokens.css: ${wash} is not a wash of one token over transparent`)
  const ink = parseColor(resolve(tokens, mix[1]))
  const base = parseColor(resolve(tokens, ground))
  if (!ink || !base) throw new Error(`tokens.css: cannot read ${mix[1]} or ${ground}`)
  return composite({ ...ink, a: Number(mix[2]) / 100 }, base)
}

/** The table grounds the cell tone is painted over (`--table-bg`: the page, or a sheet). */
const TABLE_GROUNDS = ['--bg', '--surface'] as const
/**
 * What sits in a toned cell: strikes and prices in ink, quiet text, the empty half's action in accent. Gain and
 * loss do not hold on the tone over the Paper page (4.26:1), so no signed figure is set in a toned cell.
 */
const ON_CELL_TONE = ['--text', '--text-2', '--muted', '--accent'] as const

describe.each(Object.entries(THEMES))('contrast: %s', (_name, tokens) => {
  it.each(TEXT_TOKENS.flatMap((fg) => GROUNDS.map((bg) => [fg, bg] as const)))('%s on %s holds 4.5:1', (fg, bg) => {
    const ratio = contrastRatio(resolve(tokens, fg), resolve(tokens, bg))
    expect(ratio, `${fg} on ${bg} is ${formatRatio(ratio)}`).toBeGreaterThanOrEqual(4.5)
  })

  it.each(GROUNDS.map((bg) => [bg] as const))('--control on %s holds 3:1', (bg) => {
    const ratio = contrastRatio(resolve(tokens, '--control'), resolve(tokens, bg))
    expect(ratio, `--control on ${bg} is ${formatRatio(ratio)}`).toBeGreaterThanOrEqual(3)
  })

  it.each(EXTRA_PAIRS)('%s on %s holds %d:1', (fg, bg, min) => {
    const ratio = contrastRatio(resolve(tokens, fg), resolve(tokens, bg))
    expect(ratio, `${fg} on ${bg} is ${formatRatio(ratio)}`).toBeGreaterThanOrEqual(min)
  })

  // The strike column and in-the-money cells of a table: the cell tone over the table's ground.
  it.each(ON_CELL_TONE.flatMap((fg) => TABLE_GROUNDS.map((bg) => [fg, bg] as const)))('%s on --cell-tone over %s holds 4.5:1', (fg, bg) => {
    const ratio = contrastRatio(resolve(tokens, fg), washOver(tokens, '--cell-tone', bg))
    expect(ratio, `${fg} on --cell-tone over ${bg} is ${formatRatio(ratio)}`).toBeGreaterThanOrEqual(4.5)
  })
})

describe('contrast maths', () => {
  it('parses hex and rgb colours', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#1a1915')).toEqual({ r: 26, g: 25, b: 21, a: 1 })
    expect(parseColor('rgb(26 25 21 / 0.36)')).toEqual({ r: 26, g: 25, b: 21, a: 0.36 })
    expect(parseColor('rgb(26, 25, 21)')).toEqual({ r: 26, g: 25, b: 21, a: 1 })
    expect(parseColor('color-mix(in srgb, red, blue)')).toBeNull()
  })

  it('computes the reference ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.478, 2)
  })

  it('truncates when formatting, so a pair is never reported as better than it is', () => {
    expect(formatRatio(4.499)).toBe('4.49:1')
    expect(formatRatio(Number.NaN)).toBe('n/a')
  })
})

/** Every component stylesheet of the design system. `tokens/` is skipped: it is the one place raw values may live. */
function stylesheets(dir: URL, prefix = ''): Array<readonly [string, string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === 'tokens' ? [] : stylesheets(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
    if (!entry.name.endsWith('.module.css') && `${prefix}${entry.name}` !== 'base.css') return []
    return [[`${prefix}${entry.name}`, readFileSync(new URL(entry.name, dir), 'utf8')] as const]
  })
}

const ALLOWED_PX = ['0px', '0.5px', '-0.5px', '1px', '-1px', '2px', '-2px', '767.98px']

describe('token discipline in src/ui', () => {
  const files = stylesheets(uiDir)

  it('finds the component styles', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it.each(files)('%s uses tokens only', (path, raw) => {
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    const rawColours = source.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g) ?? []
    expect(rawColours, 'raw colour values belong in tokens.css').toEqual([])
    expect(source.includes('light-dark('), 'light-dark() belongs in tokens.css').toBe(false)
    expect(/\[data-theme/.test(source), 'theme selectors belong in tokens.css').toBe(false)
    const px = (source.match(/-?\d*\.?\d+px/g) ?? []).filter((value) => !ALLOWED_PX.includes(value))
    expect(px, 'sizes come from the spacing scale; only hairlines and the phone breakpoint are raw px').toEqual([])
    const layer = path === 'base.css' ? '@layer base {' : '@layer ui {'
    expect(source.trimStart().startsWith(layer), `styles live in ${layer.slice(0, -2)}`).toBe(true)
  })
})
