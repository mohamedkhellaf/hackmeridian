import { Address, Amount, Countdown, DateTime, Glyph, IconWarning, Marker, Tag, VisuallyHidden } from '../../ui'
import { holdsEscrow, money } from './board'
import { BOARD_CAPTION, COL, ESCROW_LINE, MINE_CAPTION, YOURS, listTitle, perUnitOf, serialText, strikeLine, youHold, youLock } from './copy'
import { RowActions } from './RowActions'
import { WARN_BELOW_MS, shortfallOf } from './view'
import type { RequestsViewProps } from './view'
import styles from './RequestList.module.css'

/** The board on phones: two lines of terms per request, then what it costs and the one action. */
export function RequestList({ rows, variant, selectedId, balances, explorerOf, onSell, onCancel }: RequestsViewProps) {
  const board = variant === 'board'
  return (
    <ul className={styles.list} aria-label={board ? BOARD_CAPTION : MINE_CAPTION}>
      {rows.map((row) => {
        const shortfall = board ? shortfallOf(row, balances) : null
        const premium = <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} figure="serif" />
        return (
          <li key={row.key} className={styles.item} data-selected={selectedId === row.bid.id || undefined} data-mine={row.mine || undefined} data-testid="request-row">
            <div className={styles.line}>
              <p className={styles.title}>
                <Glyph name={row.glyph} size={12} className={styles.glyph} />
                <span>{listTitle(row)}</span>
              </p>
              <p className={styles.premium}>
                <VisuallyHidden>{board ? COL.premium : COL.premiumMine}: </VisuallyHidden>
                {row.mine && board ? <Marker>{premium}</Marker> : premium}
              </p>
            </div>
            <div className={styles.line}>
              <p className={styles.terms}>{strikeLine(row)}</p>
              <p className={styles.aside}>{perUnitOf(row)}</p>
            </div>
            <div className={styles.line}>
              <p className={styles.terms}>
                <VisuallyHidden>{COL.deadline}: </VisuallyHidden>
                <DateTime value={row.deadlineSec * 1000} />
              </p>
              {board || holdsEscrow(row.bid) ? (
                <p className={styles.aside}>
                  <Countdown to={row.deadlineSec * 1000} warnBelowMs={WARN_BELOW_MS} />
                </p>
              ) : null}
            </div>
            <div className={styles.foot}>
              <div className={styles.facts}>
                {board ? (
                  <>
                    {row.mine ? <span className={styles.yours}>{YOURS}</span> : <span className={styles.lock}>{youLock(row.lock)}</span>}
                    {shortfall ? (
                      <span className={styles.short}>
                        <IconWarning size={14} />
                        <span>{youHold(shortfall.have)}</span>
                        <VisuallyHidden>, {money(shortfall.missing)} short</VisuallyHidden>
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
                    <span>{ESCROW_LINE[row.escrow]}</span>
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
