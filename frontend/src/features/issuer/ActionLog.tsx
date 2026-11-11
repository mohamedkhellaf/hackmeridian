import { explorerAddress, explorerTx } from '../../core/explorer'
import { TX_PHASE_LABEL } from '../../data'
import { Address, DateTime, EmptyNote, RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr, TxLink, useIsPhone } from '../../ui'
import { COPY } from './copy'
import { IdText } from './IdText'
import type { LogRow } from './model'
import styles from './ActionLog.module.css'

const phaseLabel = (phase: string): string => (TX_PHASE_LABEL as Record<string, string | undefined>)[phase] ?? phase

function Transaction({ row }: { row: LogRow }) {
  return row.hash ? <TxLink hash={row.hash} explorerUrl={explorerTx(row.hash)} /> : <span className={styles.none}>{COPY.log.noHash}</span>
}

/**
 * The issuer's own actions, newest first, each with its state and its transaction. It is read from the Activity
 * list of this browser, so it is still there after a reload; it is not the asset's history on chain.
 * A table from 768 px, a list on phones, from the same rows: no column is dropped or pushed off screen.
 */
export function ActionLog({ rows }: { rows: LogRow[] }) {
  const c = COPY.log
  const phone = useIsPhone()
  return (
    <section className={styles.root} aria-labelledby="issuer-log-title">
      <h2 id="issuer-log-title" className="ui-h2">
        {c.title}
      </h2>
      {rows.length === 0 ? (
        <EmptyNote title={c.none} hint={c.noneHint} headingLevel={3} />
      ) : phone ? (
        <ul className={styles.list} aria-label={c.caption}>
          {rows.map((row) => (
            <li key={row.id} className={styles.item}>
              <p className={styles.label}>
                <IdText text={row.label} />
              </p>
              <dl className={styles.facts}>
                <div>
                  <dt>{c.time}</dt>
                  <dd>
                    <DateTime value={row.at} format="table" />
                  </dd>
                </div>
                <div>
                  <dt>{c.state}</dt>
                  <dd>{phaseLabel(row.phase)}</dd>
                </div>
                <div>
                  <dt>{c.transaction}</dt>
                  <dd>
                    <Transaction row={row} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <TableWrap label={c.caption}>
          <Table caption={c.caption}>
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
                  <RowHeader className={styles.action}>
                    <IdText text={row.label} />
                  </RowHeader>
                  <Td>{row.target ? <Address value={row.target} explorerUrl={explorerAddress(row.target)} copyLabel={null} /> : null}</Td>
                  <Td>{phaseLabel(row.phase)}</Td>
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
