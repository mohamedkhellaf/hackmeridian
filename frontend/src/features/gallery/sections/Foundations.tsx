import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, contrastRatio, formatRatio, parseColor } from '../../../ui'
import { Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'

interface TokenSpec {
  name: string
  use: string
  /** Minimum ratio this token must reach on the three grounds, when it is used for text or control borders. */
  min?: number
  hatch?: boolean
}

const SURFACES: TokenSpec[] = [
  { name: '--bg', use: 'Page' },
  { name: '--surface', use: 'Sheets, cards, dialogs' },
  { name: '--raised', use: 'Popovers, menus' },
  { name: '--sunken', use: 'Strike column, input wells' },
  { name: '--hairline', use: 'Row rules' },
  { name: '--rule', use: 'Header underline, section rules' },
  { name: '--control', use: 'Input and button borders', min: 3 },
]

const INKS: TokenSpec[] = [
  { name: '--text', use: 'Ink', min: 4.5 },
  { name: '--text-2', use: 'Secondary text', min: 4.5 },
  { name: '--muted', use: 'Labels, captions', min: 4.5 },
  { name: '--accent', use: 'Links, focus ring, selection', min: 4.5 },
  { name: '--gain', use: 'Gains, always with a sign', min: 4.5 },
  { name: '--loss', use: 'Losses, always with a sign', min: 4.5 },
  { name: '--warn', use: 'Action needed, with a glyph and a word', min: 4.5 },
  { name: '--danger', use: 'Errors and destructive actions', min: 4.5 },
]

const FILLS: TokenSpec[] = [
  { name: '--primary', use: 'The one primary button' },
  { name: '--accent-tint', use: 'Selected row or cell' },
  { name: '--marker', use: 'Highlighter, your own figures only' },
  { name: '--warn-tint', use: 'Warning callout' },
  { name: '--danger-tint', use: 'Problem callout' },
  { name: '--gain-fill', use: 'Chart profit area' },
  { name: '--loss-hatch', use: 'Chart loss area, hatched at 45 degrees', hatch: true },
]

const GROUNDS = ['--bg', '--surface', '--sunken'] as const

function toHex(color: string): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  const base = `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`
  return rgb.a < 1 ? `${base} at ${Math.round(rgb.a * 100)}%` : base
}

/** Reads the painted value of each token from the page, so the figures follow the theme and the scheme. */
function useComputedTokens(names: readonly string[], paintKey: string): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    const read = () => {
      const probe = document.createElement('span')
      probe.style.display = 'none'
      document.body.appendChild(probe)
      const next: Record<string, string> = {}
      for (const name of names) {
        probe.style.color = `var(${name})`
        next[name] = getComputedStyle(probe).color
      }
      probe.remove()
      setValues(next)
    }
    read()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', read)
    return () => media.removeEventListener('change', read)
  }, [names, paintKey])
  return values
}

const ALL_TOKENS = [...SURFACES, ...INKS, ...FILLS].map((t) => t.name)

function Swatches({ tokens, values }: { tokens: TokenSpec[]; values: Record<string, string> }) {
  return (
    <div className={styles.swatches}>
      {tokens.map((token) => {
        const value = values[token.name]
        return (
          <div key={token.name} className={styles.swatch}>
            <div
              className={styles.chip}
              data-hatch={token.hatch || undefined}
              style={token.hatch ? undefined : { background: `var(${token.name})` }}
            />
            <code className={styles.swatchName}>{token.name}</code>
            <span className={styles.swatchValue}>{value ? toHex(value) : ' '}</span>
            <span className={styles.swatchUse}>{token.use}</span>
            {token.min !== undefined && value ? (
              <dl className={styles.ratios}>
                {GROUNDS.map((ground) => {
                  const ratio = values[ground] ? contrastRatio(value, values[ground]) : Number.NaN
                  return (
                    <div key={ground}>
                      <dt>on {ground.slice(2)}</dt>
                      <dd data-pass={Number.isNaN(ratio) ? undefined : ratio >= (token.min ?? 0)}>
                        {formatRatio(ratio)}
                        {!Number.isNaN(ratio) && ratio < (token.min ?? 0) ? ' fails' : ''}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

interface TypeStyle {
  name: string
  spec: string
  sample: ReactNode
  className: string
}

const TYPE: TypeStyle[] = [
  {
    name: 'Display',
    spec: 'Source Serif 4, 44/48 (32/36 on phones), weight 560, tracking −0.02 em',
    sample: 'Set the lowest price you would sell at.',
    className: 'ui-display',
  },
  { name: 'H1', spec: 'Source Serif 4, 30/36 (24/30 on phones), weight 600, −0.015 em', sample: 'BOND options', className: 'ui-h1' },
  { name: 'H2', spec: 'Source Serif 4, 20/26, weight 600, −0.01 em', sample: 'Long put, BOND', className: 'ui-h2' },
  { name: 'Figure, large', spec: 'Source Serif 4, 22/28, weight 500, tabular lining', sample: '48.20 USDx', className: 'ui-figure-lg' },
  { name: 'Figure', spec: 'Source Serif 4, 16/22, weight 500, tabular lining', sample: '13 Nov 2026, 08:00 UTC', className: 'ui-figure' },
  {
    name: 'Body',
    spec: 'Instrument Sans, 15/23, weight 420',
    sample: 'A put is the right to sell a tokenized asset at a set price until a set date. The maker locks the full collateral in the contract before you pay.',
    className: 'ui-body',
  },
  { name: 'UI, navigation, buttons', spec: 'Instrument Sans, 13.5/20, weight 500', sample: 'Markets  Portfolio  Requests  Reserves', className: 'ui-text' },
  { name: 'Table header, label', spec: 'Instrument Sans, 12/16, weight 500, width 87.5%, muted', sample: 'Put premium per unit', className: 'ui-label' },
  { name: 'Caption', spec: 'Instrument Sans, 12/16, muted', sample: 'Read at ledger 58,331,204, 12 seconds ago.', className: 'ui-caption' },
  { name: 'Mono', spec: 'IBM Plex Mono, 12/16, slashed zero. Ids, hashes and serial lines only', sample: 'No. 184 · L 58,331,204', className: 'ui-mono' },
]

const SPACE = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72]

const MOTION = [
  { name: 'Hover', token: '--dur-hover', value: '120 ms' },
  { name: 'Changed figure', token: '--dur-fade', value: '160 ms' },
  { name: 'Popover', token: '--dur-popover', value: '180 ms' },
  { name: 'Dialog, drawer', token: '--dur-dialog', value: '240 ms' },
  { name: 'Note prints', token: '--dur-print', value: '360 ms' },
]

export function FoundationsSection({ paintKey }: { paintKey: string }) {
  const values = useComputedTokens(ALL_TOKENS, paintKey)
  const [plays, setPlays] = useState(0)
  return (
    <Section
      id="foundations"
      title="Foundations"
      lead="Components read these semantic tokens and nothing else. Raw colour values and theme selectors live in one file, tokens.css. The contrast figures below are computed from what this page is painting now."
    >
      <Specimen title="Surfaces and rules" note="Separation in the page is a tone step plus a hairline. There is no shadow in the page.">
        <Swatches tokens={SURFACES} values={values} />
      </Specimen>
      <Specimen
        title="Ink"
        note="Every text colour holds 4.5:1 on the page, on a sheet and in a well. A test enforces it for both themes and all three gain and loss schemes."
      >
        <Swatches tokens={INKS} values={values} />
      </Specimen>
      <Specimen title="Fills" note="Tints sit behind ink, never behind muted text.">
        <Swatches tokens={FILLS} values={values} />
      </Specimen>

      <Specimen title="Type" note="Serif for titles and key figures, sans for the interface, mono for ids. Figures are tabular and lining everywhere." layout="stack">
        <div>
          {TYPE.map((style) => (
            <div key={style.name} className={styles.typeRow}>
              <div className={`${styles.typeSample} ${style.className}`}>{style.sample}</div>
              <p className={styles.typeSpec}>
                <strong>{style.name}</strong>
                {style.spec}
              </p>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="Space" note="Twelve steps. Layout rhythm runs on 8.">
        <ul className={styles.scale}>
          {SPACE.map((px) => (
            <li key={px}>
              <code>--s-{px}</code>
              <span>{px} px</span>
              <span className={styles.bar} style={{ width: `var(--s-${px})` }} />
            </li>
          ))}
        </ul>
      </Specimen>

      <Specimen title="Shape" note="Paper is not rounded. Nothing is pill-shaped except the switch.">
        {[
          { name: 'Table, 0', radius: '0' },
          { name: 'Tag, 2 px', radius: 'var(--r-tag)' },
          { name: 'Control, 3 px', radius: 'var(--r-control)' },
          { name: 'Card, dialog, 4 px', radius: 'var(--r-card)' },
        ].map((shape) => (
          <div key={shape.name} className={styles.example}>
            <div className={styles.shape} style={{ borderRadius: shape.radius }} />
            <p className={styles.exampleLabel}>{shape.name}</p>
          </div>
        ))}
      </Specimen>

      <Specimen title="Elevation" note="Only what floats above the page casts a shadow: popovers and dialogs.">
        <div className={styles.example}>
          <div className={styles.lift} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
            Sheet, no shadow
          </div>
          <p className={styles.exampleLabel}>In the page</p>
        </div>
        <div className={styles.example}>
          <div className={styles.lift} style={{ boxShadow: 'var(--shadow-popover)' }}>
            Popover
          </div>
          <p className={styles.exampleLabel}>--shadow-popover</p>
        </div>
        <div className={styles.example}>
          <div className={styles.lift} style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-dialog)' }}>
            Dialog
          </div>
          <p className={styles.exampleLabel}>--shadow-dialog</p>
        </div>
      </Specimen>

      <Specimen
        title="Motion"
        note="Ink settles. Motion answers an action and shows what changed. Numbers never roll. With reduced motion, nothing travels."
        layout="stack"
      >
        <div>
          {MOTION.map((row) => (
            <div key={row.token} className={styles.motionRow}>
              <span>{row.name}</span>
              <code>{row.value}</code>
              <span className={styles.track} aria-hidden="true">
                <span
                  key={plays}
                  className={styles.runner}
                  data-playing={plays > 0 || undefined}
                  style={{ animationDuration: `calc(var(${row.token}) * 8)` }}
                />
              </span>
            </div>
          ))}
        </div>
        <div className={styles.cluster}>
          <Button size="sm" onClick={() => setPlays((n) => n + 1)}>
            Play
          </Button>
          <p className={styles.specimenNote}>
            Played at one eighth speed so the easing can be read. Enter uses cubic-bezier(0.2, 0, 0, 1); exit uses
            cubic-bezier(0.3, 0, 1, 1).
          </p>
        </div>
      </Specimen>
    </Section>
  )
}
