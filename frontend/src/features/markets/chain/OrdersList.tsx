// Orders on a phone: the same rows as the table, one under the other, with every column kept. A table this
// wide would have to scroll sideways; a list does not.
import { explorerAccount } from '../../../core/explorer'
import { formatUnits } from '../../../core/format'
import { seriesRefOf } from '../../../core/market/selection'
import { Address, DateTime, Glyph, IconWarning, Marker, shortenAddress } from '../../../ui'
import { COPY, KIND_WORD, SOURCE_LABEL } from './copy'
import { premiumText, strikeText } from './model'
import { OrderAction } from './OrderAction'
import { isMine, notesOf } from './orders'
import type { OrdersProps } from './orders'
import styles from './OrdersList.module.css'

export function OrdersList({ label, lines, side, showSeries = false, bestKey = null, ticketKey = null, health, explorer, busy, onTake, onCancel }: OrdersProps) {
  const totalHead = side === 'bids' ? COPY.colEscrowed : COPY.colTotal
  return (
    <ul role="list" className={styles.root} aria-label={label}>
      {lines.map((line) => {
        const { row } = line
        const mine = isMine(line.action)
        const ref = showSeries ? seriesRefOf(row) : null
        const perUnit = line.perUnit === null ? '–' : premiumText(line.perUnit, row.quote.decimals)
        const notes = notesOf(line, health, true)
        return (
          <li key={row.key} className={styles.item} data-selected={row.key === ticketKey || undefined} data-order={row.key} data-source={row.source}>
            <div className={styles.head}>
              <div className={styles.who}>
                {showSeries ? (
                  <span className={styles.series}>
                    <Glyph name={row.kind === 'call' ? 'long-call' : 'long-put'} />
                    <span>
                      {KIND_WORD[row.kind]} {ref ? strikeText(ref.strikePerUnit, row.quote.decimals) : `${formatUnits(row.totalStrike, row.quote.decimals)} in total`}
                    </span>
                  </span>
                ) : null}
                {showSeries ? (
                  <span className={styles.sub}>
                    <DateTime value={row.expiry * 1000} />
                  </span>
                ) : null}
                <span className={styles.from}>
                  <span className={styles.source}>{SOURCE_LABEL[row.source]}</span>
                  {mine ? (
                    <span className={styles.own}>{COPY.yoursRow}</span>
                  ) : (
                    <Address
                      value={row.counterparty}
                      copyLabel={null}
                      explorerUrl={explorer ? explorerAccount(row.counterparty) : undefined}
                      explorerLabel={`View ${shortenAddress(row.counterparty)} on the explorer`}
                    />
                  )}
                </span>
              </div>
              <OrderAction line={line} busy={busy} size="md" onTake={onTake} onCancel={onCancel} />
            </div>
            <dl className={styles.figures}>
              <div>
                <dt>{COPY.colQty}</dt>
                <dd>{formatUnits(row.underlyingQty, row.underlying.decimals)}</dd>
              </div>
              <div>
                <dt>{COPY.colPerUnitShort}</dt>
                <dd>
                  {mine ? <Marker>{perUnit}</Marker> : perUnit}
                  {row.key === bestKey ? <span className={styles.best}> {COPY.best.toLowerCase()}</span> : null}
                </dd>
              </div>
              <div>
                <dt>{totalHead}</dt>
                <dd>{formatUnits(row.totalPremium, row.quote.decimals)}</dd>
              </div>
            </dl>
            {notes.length ? (
              <p className={styles.note}>
                <IconWarning size={16} />
                <span>{notes.join(' ')}</span>
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
