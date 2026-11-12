import { explorerAddress, isMockId } from '../../core/explorer'
import { Address } from '../../ui'

export interface ChainIdProps {
  /** An account (`G...`) or contract (`C...`) id. */
  value: string
  /** `full` where the id is checked character by character, `medium` in a list of facts, `short` in a table. */
  length?: 'short' | 'medium' | 'full'
  /** What the id is, for the copy button and the explorer link: "the Covered contract", "the BOND issuer". */
  what: string
  /** A known label shown before the id. */
  name?: string
}

/**
 * An id as proof: mono, with an explorer link. Only an id printed in full also has a copy button: a shortened id
 * is checked on the explorer page it links to, which shows it whole. A mock id has no explorer page and nothing
 * worth copying, so it is shown as plain text.
 */
export function ChainId({ value, length = 'medium', what, name }: ChainIdProps) {
  if (isMockId(value)) return <Address value={value} length={length === 'full' ? 'medium' : length} copyLabel={null} name={name} />
  return (
    <Address
      value={value}
      length={length}
      name={name}
      copyLabel={length === 'full' ? `Copy the id of ${what}` : null}
      explorerUrl={explorerAddress(value)}
      explorerLabel={`View ${what} on the explorer`}
    />
  )
}
