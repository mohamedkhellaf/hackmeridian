import { Address, Amount, Countdown, DateTime, Glyph, IconWarning, Marker, Tag, VisuallyHidden } from '../../ui'
import type { RequestRow } from './board'
import { BOARD_CAPTION, COL, LAPSE_LINE, MINE_CAPTION, RETURNED_LINE, STRANDED_LINE, STRIKE, YOURS, perAsset, IN_TOTAL, referenceLine, requestTitle, serialText } from './copy'
import { RowActions } from './RowActions'
import { lapsing, warnBelowOf } from './view'
import type { RequestsViewProps } from './view'
import styles from './RequestList.module.css'

/** The premium per unit, the figure a request is priced by, under the highlighter on the wallet's own request. */
function PerUnit({ row, marked }: { row: RequestRow; marked: boolean }) {
  const amount = <Amount value={row.premiumPerUnit.text} exact={row.premiumPerUnit.exact} unit={row.premiumPerUnit.code} figure="serif" />
  return marked ? <Marker>{amount}</Marker> : amount
}

/**
 * The board below 1200 px, one card per request, drawn as the asset page's Requests tab draws it on a phone (ruling
 * F15): what is wanted and the premium per unit, the strike and the total, the deadline and the time left, then the
 * buyer and the one action. One column on phones, two from 768 px.
 */
export function RequestList({ rows, variant, selectedId, nowSec, explorerOf, onSell, onCancel }: RequestsViewProps) {
  const board = variant === 'board'
  return (
    <ul className={styles.list} aria-label={board ? BOARD_CAPTION : MINE_CAPTION}>
      {rows.map((row) => {
        const reference = referenceLine(row)
        const closed = row.state === 'cancelled' || row.state === 'pruned'
        return (
          <li
            key={row.key}
            className={styles.item}
            data-selected={selectedId === row.bid.id || undefined}
            data-mine={row.mine || undefined}
            data-closed={closed || undefined}
            data-testid="request-row"
          >
            <div className={styles.line}>
              <p className={styles.title}>
                <Glyph name={row.glyph} size={12} className={styles.glyph} />
                <span>{requestTitle(row)}</span>
              </p>
              <p className={styles.premium}>
                <VisuallyHidden>{COL.premium}: </VisuallyHidden>
                <PerUnit row={row} marked={row.mine && board} />
                <span className={styles.per}>{perAsset(row)}</span>
              </p>
            </div>
            <div className={styles.line}>
              <p className={styles.terms}>
                <span className={styles.label}>{STRIKE}</span>
                <Amount value={row.strike.text} exact={row.strike.exact} unit={row.strike.code} />
                {reference ? <span className={styles.reference}>{reference}</span> : null}
              </p>
              <p className={styles.aside}>
                <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} /> {IN_TOTAL}
              </p>
            </div>
            <div className={styles.line}>
              <p className={styles.terms}>
                <VisuallyHidden>{COL.deadline}: </VisuallyHidden>
                <DateTime value={row.deadlineSec * 1000} />
              </p>
              {row.state === 'open' ? (
                <p className={styles.aside}>
                  <Countdown to={row.deadlineSec * 1000} warnBelowMs={warnBelowOf(row)} />
                </p>
              ) : null}
            </div>
            {lapsing(row, nowSec) ? (
              <p className={styles.warn}>
                <IconWarning size={14} />
                <span>{LAPSE_LINE}</span>
              </p>
            ) : null}
            <div className={styles.foot}>
              <div className={styles.facts}>
                {board ? (
                  <span className={styles.ids}>
                    <span className={styles.buyer}>
                      <span>{COL.buyer}</span>
                      <Address value={row.bid.buyer} name={row.mine ? YOURS : undefined} explorerUrl={explorerOf(row.bid.buyer)} explorerLabel="View the buyer on the explorer" copyLabel={null} />
                    </span>
                    <span>{serialText(row.serial)}</span>
                  </span>
                ) : (
                  <>
                    <span className={styles.state}>
                      <Tag state={row.stateName} />
                      <span>{serialText(row.serial)}</span>
                    </span>
                    {row.escrow === 'stranded' ? (
                      <span className={styles.stranded}>
                        <IconWarning size={14} />
                        <span>{STRANDED_LINE}</span>
                      </span>
                    ) : row.state === 'pruned' ? (
                      <span>{RETURNED_LINE}</span>
                    ) : null}
                  </>
                )}
              </div>
              <div className={styles.action}>
                <RowActions row={row} variant={variant} layout="list" onSell={onSell} onCancel={onCancel} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
