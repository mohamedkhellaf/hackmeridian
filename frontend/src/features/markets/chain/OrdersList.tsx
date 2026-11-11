// Orders on a phone: the same rows as the table, one under the other, with every column kept. A table this
// wide would have to scroll sideways; a list does not. The groups of a book are lists of their own, with the
// gap line between them.
import { Fragment } from 'react'
import { explorerAccount } from '../../../core/explorer'
import { formatUnits } from '../../../core/format'
import { seriesRefOf } from '../../../core/market/selection'
import { Address, DateTime, Glyph, IconWarning, Marker, shortenAddress } from '../../../ui'
import { COPY, KIND_WORD, REASON_LABEL, SOURCE_LABEL } from './copy'
import { premiumText, strikeText } from './model'
import { OrderAction } from './OrderAction'
import { isMine, notesOf, orderNumber } from './orders'
import type { OrderSection, OrdersProps } from './orders'
import styles from './OrdersList.module.css'

export function OrdersList({ label, sections, gap = null, showSeries = false, showReason = true, onSelect, sharedReason = null, ticketKey = null, health, explorer, busy, onTake, onCancel }: OrdersProps) {
  const list = (section: OrderSection) => (
    <ul role="list" className={styles.root} aria-label={section.label ?? label}>
      {section.lines.map((line) => {
        const { row } = line
        const mine = isMine(line.action)
        const ref = showSeries ? seriesRefOf(row) : null
        const perUnit = line.perUnit === null ? '–' : premiumText(line.perUnit, row.quote.decimals)
        const notes = notesOf(line, health, !showSeries, sharedReason)
        const reason = showSeries ? (showReason && line.reason ? REASON_LABEL[line.reason] : null) : notes.reason
        const best = section.best?.has(row.key) ?? false
        return (
          <li key={row.key} className={styles.item} data-selected={row.key === ticketKey || undefined} data-order={row.key} data-source={row.source}>
            <div className={styles.head}>
              <div className={styles.who}>
                {showSeries && onSelect && ref ? (
                  <button type="button" className={styles.seriesButton} onClick={() => onSelect(row)} aria-label={`Show ${KIND_WORD[row.kind].toLowerCase()} ${strikeText(ref.strikePerUnit, row.quote.decimals)} in the chain`}>
                    <Glyph name={row.kind === 'call' ? 'long-call' : 'long-put'} />
                    <span>
                      {KIND_WORD[row.kind]} {strikeText(ref.strikePerUnit, row.quote.decimals)}
                    </span>
                  </button>
                ) : showSeries ? (
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
                    <Address value={row.counterparty} copyLabel={null} explorerUrl={explorer ? explorerAccount(row.counterparty) : undefined} explorerLabel={`View ${shortenAddress(row.counterparty)} on the explorer`} />
                  )}
                  <span className={styles.no}>
                    {COPY.colNo} {orderNumber(row)}
                  </span>
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
                  {best ? <span className={styles.best}> {COPY.best.toLowerCase()}</span> : null}
                </dd>
              </div>
              <div>
                <dt>{row.source === 'bid' ? COPY.colEscrowed : COPY.colTotal}</dt>
                <dd>{formatUnits(row.totalPremium, row.quote.decimals)}</dd>
              </div>
            </dl>
            {reason ? <p className={styles.reason}>{reason}</p> : null}
            {notes.warnings.length ? (
              <p className={styles.note}>
                <IconWarning size={16} />
                <span>{notes.warnings.join(' ')}</span>
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className={styles.groups}>
      {sections.map((section, i) => (
        <Fragment key={section.key}>
          {i === 1 && gap ? <p className={styles.gap}>{gap}</p> : null}
          {section.lines.length ? (
            <div className={styles.group}>
              {section.title ? (
                <h3 className={styles.groupTitle}>
                  {section.title} <span className={styles.groupCount}>{section.lines.length}</span>
                </h3>
              ) : null}
              {list(section)}
            </div>
          ) : section.empty ? (
            <p className={styles.empty}>{section.empty}</p>
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}
