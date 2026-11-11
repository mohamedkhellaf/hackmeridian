import type { ReactNode } from 'react'
import { Mono } from '../ui'
import { DASH, exact, usdx } from './format'
import { VAULT } from './types'

export const Who = ({ id }: { id: string }) => (id === VAULT ? <span>Vault</span> : <Mono>{id}</Mono>)

/** Shown where the source has no value: never guessed, never computed in the UI. */
export const Unknown = ({ why }: { why?: string }) => (
  <span className="pro-muted" title={why ?? 'No value from the data source in this state'}>
    {DASH}
  </span>
)

/** USDx amount at 2 decimals, exact value on hover. */
export const Usdx = ({ v }: { v: bigint | null | undefined }) => (v == null ? <Unknown /> : <span title={exact(v)}>{usdx(v)}</span>)

export function Field({ label, children, unit, hint }: { label: string; children: ReactNode; unit?: string; hint?: ReactNode }) {
  return (
    <label className="pro-field">
      <span className="pro-label">{label}</span>
      <span className="pro-input">
        {children}
        {unit && <span className="pro-unit">{unit}</span>}
      </span>
      {hint && <span className="pro-hint">{hint}</span>}
    </label>
  )
}
