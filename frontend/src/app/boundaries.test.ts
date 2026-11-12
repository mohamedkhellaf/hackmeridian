// The layer rules of the app (brief section 7), checked on the source text. They are what the build relies on:
// vite.config.ts treats every module outside src/app as free of import-time side effects, the landing page must
// stay clear of the shell, and tsconfig cannot keep Node globals out of browser code (a wallet dependency pulls
// the Node types in), so this file does.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const posix = (path: string): string => path.split(sep).join('/')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

// Tests, and the development-only pages some folders keep beside their code (never reachable from the entry).
const isTest = (file: string): boolean => /\.(test|testhelper)\.tsx?$/.test(file) || /\/(__harness__|dev|specimens)\//.test(file)

interface Source {
  /** Path from src/, with forward slashes: `features/markets/index.tsx`. */
  file: string
  text: string
  /** Top-level folder: `app`, `core`, `data`, `ui`, `viz`, `wallet`, `features`. */
  layer: string
  /** For a file under features/: the feature folder. */
  feature: string | null
  imports: { specifier: string; sideEffectOnly: boolean; typeOnly: boolean; dynamic: boolean; target: string | null }[]
}

const IMPORT = /^\s*(import|export)\s+(type\s+)?([^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]/gm
const DYNAMIC = /import\(\s*['"]([^'"]+)['"]\s*\)/g

function read(path: string): Source {
  const file = posix(relative(SRC, path))
  const text = readFileSync(path, 'utf8')
  const [layer, second] = file.split('/')
  const imports: Source['imports'] = []
  const add = (specifier: string, sideEffectOnly: boolean, typeOnly: boolean, dynamic: boolean) => {
    const target = specifier.startsWith('.') ? posix(relative(SRC, resolve(dirname(path), specifier))) : null
    imports.push({ specifier, sideEffectOnly, typeOnly, dynamic, target })
  }
  for (const m of text.matchAll(IMPORT)) add(m[4], m[1] === 'import' && m[3] === undefined, m[2] !== undefined, false)
  for (const m of text.matchAll(DYNAMIC)) add(m[1], false, false, true)
  return { file, text, layer, feature: layer === 'features' ? second : null, imports }
}

const sources = walk(SRC)
  .filter((path) => /\.tsx?$/.test(path) && !path.endsWith('.d.ts'))
  .map(read)
const app = sources.filter((s) => !isTest(s.file))
const layerOf = (target: string): string => target.split('/')[0]

const byFile = new Map(app.map((s) => [s.file.replace(/\.tsx?$/, ''), s]))
const find = (target: string): Source | undefined => byFile.get(target) ?? byFile.get(`${target}/index`)

/** Every module reached from `roots` by following static, non-type imports. */
function staticClosure(roots: readonly string[]): Map<string, Source> {
  const seen = new Map<string, Source>()
  const stack = [...roots]
  while (stack.length > 0) {
    const next = find(stack.pop() as string)
    if (!next || seen.has(next.file)) continue
    seen.set(next.file, next)
    for (const i of next.imports) if (!i.typeOnly && !i.dynamic && i.target !== null) stack.push(i.target)
  }
  return seen
}

describe('layer rules', () => {
  it('finds the source tree', () => {
    expect(app.length).toBeGreaterThan(100)
    expect(app.some((s) => s.file === 'app/router.tsx')).toBe(true)
  })

  it('no module outside src/app is imported for its side effect alone', () => {
    // `import './x.css'` is fine: stylesheets are not covered by the side-effect rule of the build.
    const found = app.flatMap((s) =>
      s.imports.filter((i) => i.sideEffectOnly && !/\.css$/.test(i.specifier) && !(s.layer === 'app' && i.target?.startsWith('app/'))).map((i) => `${s.file}: import '${i.specifier}'`),
    )
    expect(found).toEqual([])
  })

  it('browser code uses no Node module and no Node global', () => {
    const found = app.flatMap((s) => {
      const hits: string[] = []
      if (s.imports.some((i) => i.specifier.startsWith('node:'))) hits.push(`${s.file}: imports a node: module`)
      const code = s.text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      if (/(^|[^.\w])(process\.(env|cwd|argv|platform)|Buffer\.(from|alloc|concat|isBuffer)|__dirname|__filename|require\()/.test(code)) hits.push(`${s.file}: uses a Node global`)
      return hits
    })
    expect(found).toEqual([])
  })

  it('core imports nothing above it, and no React', () => {
    const found = app
      .filter((s) => s.layer === 'core')
      .flatMap((s) => s.imports.filter((i) => (i.target !== null && !i.target.startsWith('core/') && !i.target.startsWith('../')) || /^react(-dom)?(\/|$)/.test(i.specifier)).map((i) => `${s.file}: ${i.specifier}`))
    expect(found).toEqual([])
  })

  it('ui and viz take plain props: no core, data, wallet or feature import', () => {
    const found = app
      .filter((s) => s.layer === 'ui' || s.layer === 'viz')
      .flatMap((s) => s.imports.filter((i) => i.target !== null && ['core', 'data', 'wallet', 'features', 'app'].includes(layerOf(i.target))).map((i) => `${s.file}: ${i.specifier}`))
    expect(found).toEqual([])
  })

  it('only src/ui imports Base UI and Phosphor', () => {
    const found = app.filter((s) => s.layer !== 'ui').flatMap((s) => s.imports.filter((i) => /^@(base-ui|phosphor-icons)\//.test(i.specifier)).map((i) => `${s.file}: ${i.specifier}`))
    expect(found).toEqual([])
  })

  it('only src/wallet imports the wallet kit', () => {
    const found = app.filter((s) => s.layer !== 'wallet').flatMap((s) => s.imports.filter((i) => /stellar-wallets-kit/.test(i.specifier) && !i.typeOnly).map((i) => `${s.file}: ${i.specifier}`))
    expect(found).toEqual([])
  })

  it('no page reaches the Stellar SDK or the wallet kit through static imports', () => {
    // The shell and every page must paint without them: a module that imports one of them is reached through
    // a dynamic `import()` (the client factories of src/core, the kit loader of src/wallet, a lazy part of a page).
    const pages = app.filter((s) => /^features\/[^/]+\/index\.tsx$/.test(s.file) || s.file === 'app/main.tsx').map((s) => s.file.replace(/\.tsx?$/, ''))
    expect(pages.length).toBeGreaterThan(8)
    const found: string[] = []
    for (const page of pages) {
      for (const source of staticClosure([page]).values()) {
        for (const i of source.imports) {
          if (!i.typeOnly && !i.dynamic && /^@stellar\/stellar-sdk|stellar-wallets-kit/.test(i.specifier)) found.push(`${page} reaches ${source.file}, which imports ${i.specifier}`)
        }
      }
    }
    expect(found).toEqual([])
  })

  it('a feature imports from src/app only the search-param types', () => {
    const found = app
      .filter((s) => s.layer !== 'app')
      .flatMap((s) => s.imports.filter((i) => i.target !== null && layerOf(i.target) === 'app' && !(i.target === 'app/search' && s.layer === 'features')).map((i) => `${s.file}: ${i.specifier}`))
    expect(found).toEqual([])
  })

  it('features do not import each other, except the public index of the ticket', () => {
    const found = app
      .filter((s) => s.layer === 'features')
      .flatMap((s) =>
        s.imports
          .filter((i) => {
            if (i.target === null || layerOf(i.target) !== 'features') return false
            const other = i.target.split('/')[1]
            if (other === s.feature) return false
            return !(i.target === 'features/ticket' || i.target === 'features/ticket/index')
          })
          .map((i) => `${s.file}: ${i.specifier}`),
      )
    expect(found).toEqual([])
  })

  it('the layers below the features never import one', () => {
    const found = app
      .filter((s) => ['core', 'data', 'wallet', 'ui', 'viz'].includes(s.layer))
      .flatMap((s) => s.imports.filter((i) => i.target !== null && layerOf(i.target) === 'features').map((i) => `${s.file}: ${i.specifier}`))
    expect(found).toEqual([])
  })

  it('the landing page reaches no shell code and no chain client through a static import', () => {
    const seen = staticClosure(['features/landing/index', 'app/main'])
    expect(seen.size).toBeGreaterThan(20)
    const files = [...seen.keys()]
    // Of the features, only its own folder and the ticket's URL mappers.
    expect(files.filter((file) => /^features\/(?!landing\/|ticket\/(index|intent)\.)/.test(file))).toEqual([])
    expect(files.filter((file) => /^core\/options\/(sorobanClient|mockClient)\.|^core\/pro\/(SorobanProClient|FixtureProClient)\./.test(file))).toEqual([])
  })
})
