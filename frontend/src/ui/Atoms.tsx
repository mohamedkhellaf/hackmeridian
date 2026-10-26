import { shortContractId } from './format'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export type TagTone = 'put' | 'call' | 'ok' | 'warn' | 'neutral'

/** Small uppercase label: option kind (put/call), "Best price", "Verified"... */
export function Tag({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: TagTone }) {
  return <span className={['ui-tag', `ui-tag--${tone}`, className].filter(Boolean).join(' ')} {...rest} />
}

export type DotTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info'

/** 7px status dot. Decorative: always pair with text. */
export function StatusDot({ tone = 'ok', className }: { tone?: DotTone; className?: string }) {
  return <span className={['ui-dot', `ui-dot--${tone}`, className].filter(Boolean).join(' ')} aria-hidden="true" />
}

/** Filter chip (pill). Use `selected` for the active one; exposes aria-pressed. */
export function Chip({ selected, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type={type} aria-pressed={!!selected} className={['ui-chip', selected && 'is-on', className].filter(Boolean).join(' ')} {...rest} />
}

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

/** Segmented control (radio-group semantics). Options are buttons with aria-checked. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Accessible name of the group. */
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={['ui-seg', className].filter(Boolean).join(' ')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          className={o.value === value ? 'ui-seg-item is-on' : 'ui-seg-item'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const BADGE_PALETTE: [string, string][] = [
  ['#2a2018', '#d9a05b'], // amber (FUND)
  ['#1a2633', '#8fb4e3'], // blue (BOND)
  ['#1a2a22', '#8fcda8'], // green (USDX)
  ['#26282d', '#ece9e2'], // ink
  ['#2b2220', '#e0b86a'], // gold
]
const KNOWN: Record<string, number> = { FUND: 0, BOND: 1, USDX: 2 }

function paletteFor(code: string): [string, string] {
  const key = code.toUpperCase()
  if (key in KNOWN) return BADGE_PALETTE[KNOWN[key]]
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return BADGE_PALETTE[h % BADGE_PALETTE.length]
}

/** Round badge with the asset's initials (FUND -> FD). Colour is stable per asset code. */
export function AssetBadge({ code, size = 34, contractId }: { code: string; size?: number; contractId?: string }) {
  const [bg, fg] = paletteFor(code)
  const letters = code.length <= 2 ? code : code[0] + code[code.length - 1]
  return (
    <span
      className="ui-asset-badge"
      aria-hidden="true"
      title={contractId ? `${code} \u00b7 ${shortContractId(contractId)}` : undefined}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.4), border: `1px solid ${fg}33` }}
    >
      {letters.toUpperCase()}
    </span>
  )
}

/** Monospace text for addresses, hashes and contract ids. */
export function Mono({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={['ui-mono', className].filter(Boolean).join(' ')} {...rest} />
}

/** A formatted number with a dimmed unit: <Amount value="1,250.00" unit="USDx" />. Pass pre-formatted strings. */
export function Amount({ value, unit, className }: { value: ReactNode; unit?: ReactNode; className?: string }) {
  return (
    <span className={['ui-amount', className].filter(Boolean).join(' ')}>
      {value}
      {unit != null && <span className="ui-amount-unit"> {unit}</span>}
    </span>
  )
}
