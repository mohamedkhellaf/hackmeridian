import { Address, Amount, Countdown, DateTime, Glyph, IconWarning, Marker, Tag, VisuallyHidden } from '../../ui'
import { BOARD_CAPTION, COL, LAPSE_LINE, MINE_CAPTION, PREMIUM_TOTAL, RETURNED_LINE, STRANDED_LINE, YOURS, listTitle, perUnitOf, referenceLine, serialText, shortBy, strikeLine, youHold, youLock } from './copy'
import { RowActions } from './RowActions'
import { lapsing, shortfallOf, warnBelowOf } from './view'
import type { RequestsViewProps } from './view'
import styles from './RequestList.module.css'

/**
 * The board below 1200 px: per request, what is wanted and its premium, the strike with the reference price, the
 * deadline, then what it costs and the one action. One column on phones, two from 768 px.
 */
export function RequestList({ rows, variant, selectedId, balances, emptyTokens, nowSec, explorerOf, onSell, onCancel }: RequestsViewProps) {
  const board = variant === 'board'
  return (
    <ul className={styles.list} aria-label={board ? BOARD_CAPTION : MINE_CAPTION}>
      {rows.map((row) => {
        const shortfall = board ? shortfallOf(row, balances, emptyTokens) : null
        const reference = referenceLine(row)
        const closed = row.state === 'cancelled' || row.state === 'pruned'
        const premium = <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} figure="serif" />
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
                <span>{listTitle(row)}</span>
              </p>
              <p className={styles.premium}>
                <VisuallyHidden>{PREMIUM_TOTAL}: </VisuallyHidden>
                {row.mine && board ? <Marker>{premium}</Marker> : premium}
              </p>
            </div>
            <div className={styles.line}>
              <p className={styles.terms}>
                {strikeLine(row)}
                {reference ? <span className={styles.reference}>{reference}</span> : null}
              </p>
              <p className={styles.aside}>
                <VisuallyHidden>{COL.premium}: </VisuallyHidden>
                {perUnitOf(row)}
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
                  <>
                    {row.mine ? <span className={styles.yours}>{YOURS}</span> : <span className={styles.lock}>{youLock(row.lock)}</span>}
                    {shortfall ? (
                      <span className={styles.short}>
                        <IconWarning size={14} />
                        <span>{youHold(shortfall.have)}</span>
                        <VisuallyHidden>{shortBy(shortfall.missing)}</VisuallyHidden>
                      </span>
                    ) : null}
                    <span className={styles.ids}>
                      <span className={styles.buyer}>
                        <span>{COL.buyer}</span>
                        <Address value={row.bid.buyer} explorerUrl={explorerOf(row.bid.buyer)} explorerLabel="View the buyer on the explorer" copyLabel={null} />
                      </span>
                      <span className={styles.serial}>{serialText(row.serial)}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className={styles.state}>
                      <Tag state={row.stateName} />
                      <span className={styles.serial}>{serialText(row.serial)}</span>
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
