import { clawbackShortfallDisclosure } from '../../core/disclosures'
import { Callout } from '../../ui'
import { amountText, differenceMagnitude } from './model'
import type { ReserveRow } from './model'
import css from './ShortfallCallout.module.css'

/**
 * The clawback-shortfall disclosure, at its home. One notice for every short token, with the exact figures of
 * each under the required sentence. It is a true alert: it appears because a balance fell below what is owed.
 */
export function ShortfallCallout({ rows }: { rows: readonly ReserveRow[] }) {
  if (rows.length === 0) return null
  return (
    <Callout variant="danger" alert>
      <p data-testid="shortfall-disclosure">{clawbackShortfallDisclosure(rows.map((r) => r.token.code))}</p>
      <ul className={css.list}>
        {rows.map((row) => (
          <li key={row.token.contractId}>
            {row.token.code}: held {row.held === null ? '' : amountText(row.held, row.token)}, locked {amountText(row.locked, row.token)}, short by {differenceMagnitude(row)}.
          </li>
        ))}
      </ul>
    </Callout>
  )
}
