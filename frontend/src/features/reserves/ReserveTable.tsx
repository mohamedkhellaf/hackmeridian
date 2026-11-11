import { useId, useState } from 'react'
import { NO_VALUE } from '../../core/format'
import { Amount, Callout, IconChevronDown, IconChevronRight, KeyValue, KeyValueItem, RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr, useIsPhone } from '../../ui'
import { ChainId } from './ChainId'
import { BREAKDOWN_SUM_LABEL, BREAKDOWN_UNAVAILABLE, DIFFERENCE_WORD, HELD_UNAVAILABLE, ROLE_LABEL, TABLE_CAPTION, TABLE_COLUMNS, itemsMismatch } from './copy'
import { amountText, differenceExact, differenceSpoken, differenceText, exactText } from './model'
import type { ReserveRow } from './model'
import css from './ReserveTable.module.css'

const SPAN = TABLE_COLUMNS.length

/**
 * What the locked amount is made of, as rows of the same table: each item sits under the token's row with its
 * amount in the Locked column, like the lines of a statement. The last line gives the ids to check it against.
 */
function Breakdown({ row, groupId }: { row: ReserveRow; groupId: string }) {
  const { token } = row
  return (
    <>
      {row.items === null || row.itemsTotal === null ? (
        <Tr className={css.sub} data-group={groupId}>
          <Td colSpan={SPAN} className={css.wide}>
            {BREAKDOWN_UNAVAILABLE}
          </Td>
        </Tr>
      ) : (
        <>
          {row.items.map((item) => (
            <Tr key={item.key} className={css.sub} data-group={groupId} data-testid={`item-${item.key}`} data-units={item.amount.toString()}>
              <RowHeader className={css.itemHead}>
                <span className={css.itemGrid}>
                  <span className={css.itemLabel}>{item.label}</span>
                  <span className={css.itemMeaning}>{item.meaning}</span>
                </span>
              </RowHeader>
              <Td numeric>
                <Amount value={amountText(item.amount, token)} exact={exactText(item.amount, token)} />
              </Td>
              <Td />
              <Td />
            </Tr>
          ))}
          <Tr className={css.sub} data-group={groupId} data-sum data-testid="item-sum">
            <RowHeader className={css.itemHead}>
              <span className={css.itemLabel}>{BREAKDOWN_SUM_LABEL}</span>
            </RowHeader>
            <Td numeric>
              <Amount value={amountText(row.itemsTotal, token)} exact={exactText(row.itemsTotal, token)} />
            </Td>
            <Td />
            <Td />
          </Tr>
          {row.itemsMatch ? null : (
            <Tr className={css.sub} data-group={groupId}>
              <Td colSpan={SPAN} className={css.wide}>
                <Callout variant="warning">
                  <p>{itemsMismatch(amountText(row.itemsTotal, token), amountText(row.locked, token))}</p>
                </Callout>
              </Td>
            </Tr>
          )}
        </>
      )}
      <Tr className={css.sub} data-group={groupId} data-last>
        <Td colSpan={SPAN} className={css.wide}>
          <Proof row={row} />
        </Td>
      </Tr>
    </>
  )
}

/** The ids to check a token against. */
function Proof({ row }: { row: ReserveRow }) {
  const { token } = row
  return (
    <span className={css.proof}>
      <span className={css.proofItem}>
        <span className={css.proofLabel}>Token contract</span>
        <ChainId value={token.contractId} what={`the ${token.code} token contract`} />
      </span>
      {token.issuer ? (
        <span className={css.proofItem}>
          <span className={css.proofLabel}>Issuer</span>
          <ChainId value={token.issuer} what={`the ${token.code} issuer`} />
        </span>
      ) : null}
    </span>
  )
}

/**
 * The same split on a phone, where a line of a statement does not fit beside three figures: one cell across
 * the table holding the items as a list, label and meaning on the left, amount on the right.
 */
function BreakdownPhone({ row, groupId }: { row: ReserveRow; groupId: string }) {
  const { token } = row
  return (
    <Tr className={css.sub} data-group={groupId} data-last>
      <Td colSpan={SPAN} className={css.wide}>
        {row.items === null || row.itemsTotal === null ? (
          <p>{BREAKDOWN_UNAVAILABLE}</p>
        ) : (
          <>
            <KeyValue variant="ruled" figures="sans" className={css.phoneItems}>
              {row.items.map((item) => (
                <KeyValueItem
                  key={item.key}
                  label={
                    <>
                      <span className={css.itemLabel}>{item.label}</span>
                      <span className={css.itemMeaning}>{item.meaning}</span>
                    </>
                  }
                >
                  <span data-testid={`item-${item.key}`} data-units={item.amount.toString()}>
                    <Amount value={amountText(item.amount, token)} exact={exactText(item.amount, token)} />
                  </span>
                </KeyValueItem>
              ))}
              <KeyValueItem className={css.phoneSum} label={<span className={css.itemLabel}>{BREAKDOWN_SUM_LABEL}</span>}>
                <span data-testid="item-sum">
                  <Amount value={amountText(row.itemsTotal, token)} exact={exactText(row.itemsTotal, token)} />
                </span>
              </KeyValueItem>
            </KeyValue>
            {row.itemsMatch ? null : (
              <Callout variant="warning">
                <p>{itemsMismatch(amountText(row.itemsTotal, token), amountText(row.locked, token))}</p>
              </Callout>
            )}
          </>
        )}
        <Proof row={row} />
      </Td>
    </Tr>
  )
}

function Difference({ row }: { row: ReserveRow }) {
  if (row.difference === null) {
    return (
      <>
        <span aria-hidden="true">{NO_VALUE}</span>
        <span className="ui-vh">unknown</span>
      </>
    )
  }
  const word = row.state === 'short' || row.state === 'over' ? DIFFERENCE_WORD[row.state] : null
  return (
    <span className={css.difference} data-state={row.state}>
      <Amount value={differenceText(row)} exact={differenceExact(row)} srLabel={differenceSpoken(row)} />
      {word ? (
        <span className={css.word} aria-hidden="true">
          {word}
        </span>
      ) : null}
    </span>
  )
}

function ReserveRows({ row, open, phone, onToggle }: { row: ReserveRow; open: boolean; phone: boolean; onToggle: () => void }) {
  const groupId = useId()
  const { token } = row
  return (
    <>
      <Tr data-state={row.state} data-open={open || undefined} className={css.row} id={groupId}>
        <RowHeader className={css.tokenCell}>
          <button type="button" className={css.toggle} aria-expanded={open} onClick={onToggle}>
            <span className={css.chevron}>{open ? <IconChevronDown /> : <IconChevronRight />}</span>
            <span className={css.code}>{token.code}</span>
            <span className={css.role}>{ROLE_LABEL[row.role]}</span>
            <span className="ui-vh">, what is locked, by state</span>
          </button>
        </RowHeader>
        <Td numeric data-testid="locked" data-units={row.locked.toString()}>
          <Amount value={amountText(row.locked, token)} exact={exactText(row.locked, token)} />
        </Td>
        <Td numeric data-testid="held" data-units={row.held === null ? undefined : row.held.toString()}>
          {row.held === null ? <span className={css.unavailable}>{HELD_UNAVAILABLE}</span> : <Amount value={amountText(row.held, token)} exact={exactText(row.held, token)} />}
        </Td>
        <Td numeric data-testid="difference" data-units={row.difference === null ? undefined : row.difference.toString()}>
          <Difference row={row} />
        </Td>
      </Tr>
      {open ? phone ? <BreakdownPhone row={row} groupId={groupId} /> : <Breakdown row={row} groupId={groupId} /> : null}
    </>
  )
}

/**
 * The statement: one row per token with the headers Token, Locked, Held, Difference. A row opens to show what
 * the locked amount is made of and the ids to check it against.
 */
export function ReserveTable({ rows }: { rows: readonly ReserveRow[] }) {
  const phone = useIsPhone()
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  return (
    <TableWrap label={TABLE_CAPTION}>
      <Table caption={TABLE_CAPTION} className={css.table}>
        <THead>
          <Tr>
            <Th className={css.tokenHead}>{TABLE_COLUMNS[0]}</Th>
            <Th numeric>{TABLE_COLUMNS[1]}</Th>
            <Th numeric>{TABLE_COLUMNS[2]}</Th>
            <Th numeric>{TABLE_COLUMNS[3]}</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <ReserveRows key={row.token.contractId} row={row} open={open.has(row.token.contractId)} phone={phone} onToggle={() => toggle(row.token.contractId)} />
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
