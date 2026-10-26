import type { ReactNode } from 'react'

export type StrataKind = 'put' | 'call'
export type Num = number | bigint

export interface StrataLayers {
  /** Backing open offers. */
  offered?: Num
  /** Backing sold (active) options. */
  active?: Num
  /** Exercised options' proceeds the writer has not claimed yet. */
  awaiting?: Num
  /** Backing expired options the writer has not reclaimed. */
  reclaim?: Num
}

const LAYER_DEFS: { key: keyof StrataLayers; label: string }[] = [
  { key: 'offered', label: 'Offered' },
  { key: 'active', label: 'Active' },
  { key: 'awaiting', label: 'Awaiting claim' },
  { key: 'reclaim', label: 'Pending reclaim' },
]

function layerVar(kind: StrataKind, key: keyof StrataLayers) {
  return kind === 'call' ? `var(--layer-call-${key})` : `var(--layer-${key})`
}

const defaultFormat = (n: Num) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 7 })

/** Legend for the layer colours, with amounts. Included by StrataBar; export for custom layouts. */
export function StrataLegend({
  layers,
  kind = 'put',
  unit,
  format = defaultFormat,
  className,
}: {
  layers: StrataLayers
  kind?: StrataKind
  unit?: string
  format?: (n: Num) => string
  className?: string
}) {
  return (
    <ul className={['ui-strata-legend', className].filter(Boolean).join(' ')}>
      {LAYER_DEFS.map((d) => (
        <li key={d.key}>
          <span className="ui-strata-swatch" style={{ background: layerVar(kind, d.key) }} aria-hidden="true" />
          {d.label}
          <span className="ui-mono">
            {format(layers[d.key] ?? 0)}
            {unit ? ` ${unit}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * What a token is owed, broken into layers by state (offered / active / awaiting claim / pending reclaim), drawn
 * against the "held line": the ink outline is what the contract actually holds. Owed == held -> the layers fill the
 * outline. Held < owed -> the part outside the outline is hatched, with a text note (never colour alone). Put layers
 * are amber, call layers blue. Pass raw amounts (number or bigint, one unit); `format` renders text.
 */
export function StrataBar({
  owed,
  held,
  layers,
  kind = 'put',
  code,
  unit,
  format = defaultFormat,
  legend = true,
  className,
}: {
  owed: Num
  held: Num
  layers: StrataLayers
  kind?: StrataKind
  /** Heading on the left, usually the token code. */
  code?: ReactNode
  /** Unit appended in text, usually the token code. */
  unit?: string
  format?: (n: Num) => string
  /** Show the legend (default true). */
  legend?: boolean
  className?: string
}) {
  const owedN = Number(owed)
  const heldN = Number(held)
  const scale = Math.max(owedN, heldN, 1)
  const short = heldN < owedN
  const gap: Num = typeof owed === 'bigint' && typeof held === 'bigint' ? owed - held : owedN - heldN
  const pct = (n: Num) => `${(Math.max(0, Number(n)) / scale) * 100}%`
  const u = unit ? ` ${unit}` : ''
  const summary =
    `${typeof code === 'string' ? code + ': ' : ''}owed ${format(owed)}${u}, held ${format(held)}${u}. ` +
    LAYER_DEFS.map((d) => `${d.label} ${format(layers[d.key] ?? 0)}${u}`).join(', ') +
    (short ? `. Shortfall ${format(gap)}${u}: held is below owed.` : '.')

  return (
    <div className={['ui-strata', className].filter(Boolean).join(' ')}>
      <div className="ui-strata-head">
        <span>{code}</span>
        <span className="ui-strata-figures">
          owed {format(owed)} · held {format(held)}
        </span>
      </div>
      <div className="ui-strata-wrap" role="img" aria-label={summary}>
        <div className="ui-strata-track">
          {LAYER_DEFS.map((d) => {
            const v = layers[d.key]
            return v && Number(v) > 0 ? <span key={d.key} style={{ width: pct(v), background: layerVar(kind, d.key) }} /> : null
          })}
        </div>
        {short && <div className="ui-strata-hatch" style={{ left: pct(held), width: pct(gap) }} />}
        <div className="ui-strata-held" style={{ width: pct(held) }} />
      </div>
      {short && (
        <div className="ui-strata-gap-note">
          <span className="ui-strata-swatch ui-strata-gap" aria-hidden="true" />
          Shortfall {format(gap)}
          {u}: held is below owed
        </div>
      )}
      {legend && <StrataLegend layers={layers} kind={kind} unit={unit} format={format} />}
    </div>
  )
}
