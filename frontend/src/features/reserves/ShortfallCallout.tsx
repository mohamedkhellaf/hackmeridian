import { clawbackShortfallDisclosure } from '../../core/disclosures'
import { formatList } from '../../core/format'
import { Callout } from '../../ui'
import type { ReserveRow } from './model'

/**
 * The clawback-shortfall disclosure, at its home: one notice for every short token, the required sentence and
 * nothing else. The rows of the statement right below carry the figures. It is a true alert: it appears because
 * a balance fell below what is owed.
 */
export function ShortfallCallout({ rows }: { rows: readonly ReserveRow[] }) {
  if (rows.length === 0) return null
  return (
    <Callout variant="danger" alert>
      <p data-testid="shortfall-disclosure">{clawbackShortfallDisclosure(formatList(rows.map((r) => r.token.code)))}</p>
    </Callout>
  )
}
