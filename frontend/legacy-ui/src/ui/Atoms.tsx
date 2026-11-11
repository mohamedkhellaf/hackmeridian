import type { HTMLAttributes, ReactNode } from 'react'

export type TagTone = 'neutral' | 'warn' | 'danger'

/** Lifecycle state (Offered, Active, Exercised, Expired, Cancelled) and `Check terms` only. */
export function Tag({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: TagTone }) {
  return <span className={['ui-tag', `ui-tag--${tone}`, className].filter(Boolean).join(' ')} {...rest} />
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
