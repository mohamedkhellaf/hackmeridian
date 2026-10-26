import { useId } from 'react'
import type { ReactNode } from 'react'
import { Sediment } from './Sediment'
import { Amount } from './Atoms'

export interface PayoffSketchProps {
  kind: 'put' | 'call'
  /** Strike as already formatted text, e.g. "100.00". Shown under the marker. */
  strikeLabel: string
  /** Underlying asset code, for the accessible description. */
  asset?: string
  /** Small variant (64x30) for mobile rows. */
  compact?: boolean
  className?: string
}

/**
 * Tiny schematic of a LONG option payoff with the strike marked and the caption "Hypothetical payoff". Purely
 * illustrative shape from `kind`: no prices, no premium, no pricing math.
 */
export function PayoffSketch({ kind, strikeLabel, asset, compact, className }: PayoffSketchProps) {
  const color = kind === 'put' ? 'var(--put)' : 'var(--call)'
  const w = compact ? 64 : 150
  const h = compact ? 30 : 56
  // Geometry in a 150x56 box, scaled by viewBox.
  const d = kind === 'put' ? 'M8 8L84 40H142' : 'M8 40H66L142 8'
  const sx = kind === 'put' ? 84 : 66
  const desc =
    kind === 'put'
      ? `Long put payoff sketch: gains as ${asset ?? 'the asset'} falls below the strike ${strikeLabel}. Schematic, not a forecast.`
      : `Long call payoff sketch: gains as ${asset ?? 'the asset'} rises above the strike ${strikeLabel}. Schematic, not a forecast.`
  return (
    <figure className={['ui-payoff', className].filter(Boolean).join(' ')}>
      <svg width={w} height={h} viewBox="0 0 150 56" role="img" aria-label={desc}>
        <path d="M8 48H142" stroke="var(--border-strong)" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" />
        <circle cx={sx} cy="40" r="3" fill="var(--raised)" stroke={color} strokeWidth="2" />
        {!compact && (
          <text x={sx} y="55" fontSize="9" fill="var(--muted)" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
            {strikeLabel}
          </text>
        )}
      </svg>
      <figcaption>Hypothetical payoff</figcaption>
    </figure>
  )
}

export interface HeroStat {
  label: string
  /** Value node; use <Amount value unit /> for numbers with units. Rendered in Fraunces. */
  value?: ReactNode
  /** Multi-token stat: one {amount, unit} per line, smaller unit. Used instead of `value` when given. */
  values?: { amount: ReactNode; unit?: ReactNode }[]
}

export interface PageHeroProps {
  /** Small uppercase line above the title. */
  eyebrow?: ReactNode
  /** Renders the page h1. */
  title: ReactNode
  lede?: ReactNode
  stats?: HeroStat[]
  /** Buttons etc. under the lede. */
  actions?: ReactNode
  /** Sediment panel on the right (under / above the text on phones). */
  sediment?: {
    seed: string
    /** Text stamped over the panel, e.g. a StatusDot + "Owed equals held". */
    caption?: ReactNode
    /** Small label above the caption. */
    captionLabel?: string
  }
  /** Fully custom media panel instead of `sediment`. */
  media?: ReactNode
}

function HeroStatItem({ stat }: { stat: HeroStat }) {
  const id = useId()
  // DOM order label -> value (matches Stat, so role=group text ends with the value); shown value-first via CSS.
  return (
    <div className="ui-hero-stat" role="group" aria-labelledby={id}>
      <span className="ui-label" id={id}>
        {stat.label}
      </span>
      <span className="ui-hero-stat-value">
        {stat.values
          ? stat.values.map((v, i) => <Amount key={i} value={v.amount} unit={v.unit} />)
          : stat.value}
      </span>
    </div>
  )
}

/**
 * Editorial page header: eyebrow, Fraunces title (h1, 64px), lede, stat row and an optional procedural Sediment panel
 * on the right (stacks above the text on phones). Bleeds to the edges of the content column. Use as the first child of
 * a view instead of PageHeader.
 */
export function PageHero({ eyebrow, title, lede, stats, actions, sediment, media }: PageHeroProps) {
  const panel = media ?? (sediment && (
    <>
      <Sediment seed={sediment.seed} size="fill" />
      {sediment.caption && (
        <div className="ui-hero-caption">
          {sediment.captionLabel && <span className="ui-label">{sediment.captionLabel}</span>}
          {sediment.caption}
        </div>
      )}
    </>
  ))
  return (
    <section className="ui-hero">
      <div className="ui-hero-text">
        {eyebrow && <span className="ui-label">{eyebrow}</span>}
        <h1 className="ui-hero-title">{title}</h1>
        {lede && <p className="ui-hero-lede">{lede}</p>}
        {actions && <div className="ui-hero-actions">{actions}</div>}
        {stats && stats.length > 0 && (
          <div className="ui-hero-stats">
            {stats.map((s) => (
              <HeroStatItem key={s.label} stat={s} />
            ))}
          </div>
        )}
      </div>
      {panel && <div className="ui-hero-media">{panel}</div>}
    </section>
  )
}
