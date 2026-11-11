import { Link as RouterLink } from '@tanstack/react-router'
import { explorerAddress, explorerTx } from '../../core/explorer'
import { Address, Button, DateTime, Link, RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr, TX_STATES, TxLink, TxStateWord, useIsPhone } from '../../ui'
import type { TxState } from '../../ui'
import { COPY } from './copy'
import type { LogRow } from './model'
import styles from './ActionLog.module.css'

const isTxState = (phase: string): phase is TxState => (TX_STATES as readonly string[]).includes(phase)

function Transaction({ row }: { row: LogRow }) {
  return row.hash ? <TxLink hash={row.hash} explorerUrl={explorerTx(row.hash)} /> : <span className={styles.none}>{COPY.log.noHash}</span>
}

/** The state of a recorded action, drawn as in the Activity list; an unknown outcome can be looked up again from here. */
function State({ row, onCheck }: { row: LogRow; onCheck: (id: string) => void }) {
  return (
    <span className={styles.state}>
      {isTxState(row.phase) ? <TxStateWord state={row.phase} /> : <span>{row.phase}</span>}
      {row.phase === 'unknown' ? (
        <Button size="sm" onClick={() => onCheck(row.id)}>
          {COPY.tx.checkAgain}
        </Button>
      ) : null}
    </span>
  )
}

export interface ActionLogProps {
  rows: LogRow[]
  code: string
  onCheck: (id: string) => void
}

/**
 * The issuer's own actions on this asset, newest first, each with its account, its state and its transaction.
 * It is read from the Activity list of this browser, so it is still there after a reload; it is not the asset's
 * history on chain. Shown only once something was signed here.
 */
export function ActionLog({ rows, code, onCheck }: ActionLogProps) {
  const c = COPY.log
  const phone = useIsPhone()
  return (
    <section className={styles.root} aria-labelledby="issuer-log-title">
      <header className={styles.header}>
        <h2 id="issuer-log-title" className="ui-h2">
          {c.title}
        </h2>
        <Link render={<RouterLink to="/activity" />}>{c.all}</Link>
      </header>
      {phone ? (
        <ul className={styles.list} aria-label={c.caption(code)}>
          {rows.map((row) => (
            <li key={row.id} className={styles.item}>
              <div className={styles.line}>
                <span className={styles.action}>
                  {row.action}
                </span>
                <DateTime value={row.at} format="table" />
              </div>
              <div className={styles.line}>
                {row.target ? <Address value={row.target} explorerUrl={explorerAddress(row.target)} copyLabel={null} /> : <span />}
                <State row={row} onCheck={onCheck} />
              </div>
              <div className={styles.line}>
                <Transaction row={row} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <TableWrap label={c.caption(code)}>
          <Table caption={c.caption(code)}>
            <THead>
              <Tr>
                <Th>{c.time}</Th>
                <Th>{c.action}</Th>
                <Th>{c.account}</Th>
                <Th>{c.state}</Th>
                <Th>{c.transaction}</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td muted>
                    <DateTime value={row.at} format="table" />
                  </Td>
                  <RowHeader className={styles.action}>{row.action}</RowHeader>
                  <Td>{row.target ? <Address value={row.target} explorerUrl={explorerAddress(row.target)} copyLabel={null} /> : null}</Td>
                  <Td>
                    <State row={row} onCheck={onCheck} />
                  </Td>
                  <Td>
                    <Transaction row={row} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </section>
  )
}
