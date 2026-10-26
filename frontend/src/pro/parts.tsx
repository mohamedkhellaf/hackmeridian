import type { ReactNode } from 'react'
import { Mono, Tag } from '../ui'
import { DASH } from './format'
import { VAULT } from './types'

export const Who = ({ id }: { id: string }) => (id === VAULT ? <Tag tone="call">Vault</Tag> : <Mono>{id}</Mono>)

/** Shown where the source has no value: never guessed, never computed in the UI. */
export const Unknown = ({ why }: { why?: string }) => (
  <span className="pro-unknown" title={why ?? 'No value available from the data source for this state'}>
    {DASH}
  </span>
)

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="pro-field">
      <span className="ui-label">{label}</span>
      {children}
      {hint && <span className="pro-hint">{hint}</span>}
    </label>
  )
}
