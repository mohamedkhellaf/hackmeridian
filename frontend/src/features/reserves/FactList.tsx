import type { ReactNode } from 'react'
import css from './FactList.module.css'

export interface Fact {
  term: string
  text: ReactNode
  /** Where the fact can be read from: the contract function (in mono) and the contract it is called on. */
  source?: { call: string; on: string }
}

export interface FactListProps {
  facts: readonly Fact[]
  /** `record`: a contract's identity and facts in one list, with room for the longer terms and full ids. */
  variant?: 'notes' | 'record'
  className?: string
}

/** Short facts as a ruled definition list (`dl > div > dt + dd`): the term on the left, the value or sentence beside it. */
export function FactList({ facts, variant = 'notes', className }: FactListProps) {
  return (
    <dl className={className ? `${css.root} ${className}` : css.root} data-variant={variant}>
      {facts.map((fact) => (
        <div key={fact.term} className={css.fact}>
          <dt>{fact.term}</dt>
          <dd>
            {fact.text}
            {fact.source ? (
              <span className={css.source}>
                Read from <code>{fact.source.call}</code> on {fact.source.on}.
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
