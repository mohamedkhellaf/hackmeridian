import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { AssetFlags } from '../../core/assetfacts/assetFacts'
import { explorerAddress } from '../../core/explorer'
import { NO_VALUE, formatExact, formatUnits, formatUtcTime } from '../../core/format'
import { shortAddress } from '../../core/options/format'
import { Address, Amount, Button, Callout, IconButton, IconClose, IconRefresh, RowHeader, Skeleton, Table, TableWrap, TBody, Td, TextField, Th, THead, Tr, useIsPhone } from '../../ui'
import { COPY, STATE_DETAIL, STATE_LABEL } from './copy'
import { rowActions } from './model'
import type { AccountRow, AddResult, IssuerActionKind, IssuerAsset } from './model'
import { RowActionButtons } from './RowActionButtons'
import type { HoldersView } from './useIssuerConsole'
import styles from './AccountsSection.module.css'

export interface AccountsSectionProps {
  asset: IssuerAsset
  rows: AccountRow[]
  holders: HoldersView
  flags: AssetFlags | null
  /** True for the issuer: the rows carry actions and addresses can be added. */
  canAct: boolean
  /** Why no action can start right now (a transaction is in flight or unresolved), or null. */
  busy: string | null
  /** The action in flight and the row it runs on. */
  running: { kind: IssuerActionKind; target: string } | null
  /** What the options contract owes in this asset, when the reserves were read. */
  reserved: bigint | null
  readAt: number | null
  refreshing: boolean
  onRefresh: () => void
  onAdd: (text: string) => AddResult
  onRemove: (address: string) => void
  onAuthorize: (row: AccountRow) => void
  onFreeze: (row: AccountRow) => void
  onClawback: (row: AccountRow) => void
  onRetryHolders: () => void
}

function Identity({ row, asset, reserved, onRemove }: { row: AccountRow; asset: IssuerAsset; reserved: bigint | null; onRemove?: (address: string) => void }) {
  const c = COPY.accounts
  return (
    <div className={styles.identity}>
      <div className={styles.identityLine}>
        <Address
          value={row.address}
          name={row.escrow ? c.escrowName : undefined}
          explorerUrl={explorerAddress(row.address)}
          explorerLabel={c.viewAddress}
          copyLabel={c.copyAddress}
        />
        {row.source === 'added' && onRemove ? (
          <IconButton size="sm" label={c.remove(shortAddress(row.address))} icon={<IconClose />} onClick={() => onRemove(row.address)} />
        ) : null}
      </div>
      {row.escrow ? (
        <p className={styles.detail}>{reserved !== null ? c.escrowOwes(formatUnits(reserved, asset.decimals), asset.code) : c.escrowDetail(asset.code)}</p>
      ) : row.source === 'added' ? (
        <p className={styles.detail}>{c.addedName}</p>
      ) : null}
    </div>
  )
}

function Balance({ row, asset }: { row: AccountRow; asset: IssuerAsset }) {
  if (!row.read) return <Skeleton width="4rem" />
  if (row.read.balance === null) {
    return (
      <span className={styles.none}>
        <span aria-hidden="true">{NO_VALUE}</span>
        <span className="ui-vh">{COPY.accounts.noBalance}</span>
      </span>
    )
  }
  return <Amount value={formatUnits(row.read.balance, asset.decimals)} exact={formatExact(row.read.balance, asset.decimals)} srLabel={`${formatUnits(row.read.balance, asset.decimals)} ${asset.code}`} />
}

function Authorization({ row, asset }: { row: AccountRow; asset: IssuerAsset }) {
  if (!row.read) {
    return (
      <div className={styles.state}>
        <span className={styles.stateWord} data-quiet>
          {COPY.accounts.reading}
        </span>
      </div>
    )
  }
  const { state, error, clawback } = row.read
  return (
    <div className={styles.state}>
      <span className={styles.stateWord} data-quiet={state === 'unknown' || undefined}>
        {STATE_LABEL[state]}
      </span>
      {/* "Authorized" says it all; every other state gets its consequence in plain words. */}
      {state === 'authorized' ? null : (
        <span className={styles.detail}>
          {state === 'unknown' && error
            ? COPY.accounts.readError(error)
            : row.escrow && state === 'unauthorized'
              ? COPY.accounts.escrowNotAuthorized(asset.code)
              : STATE_DETAIL[state](asset.code)}
        </span>
      )}
      {clawback === false ? <span className={styles.detail}>{COPY.accounts.clawbackNotOnLine}</span> : null}
    </div>
  )
}

function AddForm({ code, onAdd }: { code: string; onAdd: (text: string) => AddResult }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (draft.trim() === '') return
    const result = onAdd(draft)
    if (result.ok) {
      setDraft('')
      setError(null)
    } else setError(result.error)
  }
  return (
    <form className={styles.add} onSubmit={submit} noValidate>
      <TextField
        className={styles.addField}
        label={COPY.add.label}
        hint={COPY.add.hint(code)}
        error={error ?? undefined}
        value={draft}
        onValueChange={(next) => {
          setDraft(next.trim())
          setError(null)
        }}
        placeholder={COPY.add.placeholder}
        mono
        autoComplete="off"
        name="issuer-target"
      />
      <Button type="submit" className={styles.addButton}>
        {COPY.add.submit}
      </Button>
    </form>
  )
}

/**
 * The accounts and contracts the issuer can act on, with the options contract always first and named as the
 * escrow. A table from 768 px, a list of blocks on phones, from the same rows.
 */
export function AccountsSection(props: AccountsSectionProps) {
  const { asset, rows, holders, flags, canAct, busy, running, reserved, readAt, refreshing } = props
  const phone = useIsPhone()
  const c = COPY.accounts
  const actionsOf = (row: AccountRow): ReactNode => (
    <RowActionButtons
      row={row}
      actions={rowActions(row, flags, asset.code, busy)}
      running={running && running.target === row.address ? running.kind : null}
      onAuthorize={props.onAuthorize}
      onFreeze={props.onFreeze}
      onClawback={props.onClawback}
    />
  )

  return (
    <section className={styles.root} aria-labelledby="issuer-accounts-title">
      <header className={styles.header}>
        <h2 id="issuer-accounts-title" className="ui-h2">
          {c.title}
        </h2>
        <div className={styles.tools}>
          {readAt !== null ? <span className={styles.readAt}>{c.readAt(formatUtcTime(Math.floor(readAt / 1000)))}</span> : null}
          <Button size="sm" variant="quiet" iconStart={<IconRefresh />} loading={refreshing} onClick={props.onRefresh}>
            {c.refresh}
          </Button>
        </div>
      </header>

      {canAct ? <AddForm code={asset.code} onAdd={props.onAdd} /> : null}

      {phone ? (
        <ul className={styles.list} aria-label={c.caption(asset.code)}>
          {rows.map((row) => (
            <li key={row.address} className={styles.item}>
              <Identity row={row} asset={asset} reserved={row.escrow ? reserved : null} onRemove={canAct ? props.onRemove : undefined} />
              <dl className={styles.itemFacts}>
                <div>
                  <dt>{c.balance(asset.code)}</dt>
                  <dd>
                    <Balance row={row} asset={asset} />
                  </dd>
                </div>
                <div>
                  <dt>{c.authorization}</dt>
                  <dd>
                    <Authorization row={row} asset={asset} />
                  </dd>
                </div>
              </dl>
              {canAct ? actionsOf(row) : null}
            </li>
          ))}
        </ul>
      ) : (
        <TableWrap label={c.caption(asset.code)}>
          <Table caption={c.caption(asset.code)}>
            <THead>
              <Tr>
                <Th>{c.account}</Th>
                <Th numeric>{c.balance(asset.code)}</Th>
                <Th>{c.authorization}</Th>
                {canAct ? (
                  <Th pinned>
                    <span className="ui-vh">{c.actions}</span>
                  </Th>
                ) : null}
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.address}>
                  <RowHeader className={styles.cell}>
                    <Identity row={row} asset={asset} reserved={row.escrow ? reserved : null} onRemove={canAct ? props.onRemove : undefined} />
                  </RowHeader>
                  <Td numeric className={styles.cell}>
                    <Balance row={row} asset={asset} />
                  </Td>
                  <Td className={styles.cell}>
                    <Authorization row={row} asset={asset} />
                  </Td>
                  {canAct ? (
                    <Td pinned className={styles.cell}>
                      {actionsOf(row)}
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      {holders.status === 'loading' ? (
        <div className={styles.holdersLoading} aria-busy="true">
          <span className="ui-vh">{c.holdersLoading(asset.code)}</span>
          <Skeleton variant="rows" lines={3} />
        </div>
      ) : holders.status === 'error' ? (
        <Callout
          variant="danger"
          actions={
            <Button size="sm" onClick={props.onRetryHolders}>
              {COPY.page.retry}
            </Button>
          }
        >
          {c.holdersError(asset.code, holders.message)}
        </Callout>
      ) : holders.status === 'ready' ? (
        holders.count === 0 ? (
          <p className={styles.footnote}>{c.holdersNone(asset.code)}</p>
        ) : holders.more ? (
          <p className={styles.footnote}>{c.holdersMore(holders.count)}</p>
        ) : null
      ) : (
        <p className={styles.footnote}>{c.holdersForIssuer(asset.code)}</p>
      )}
    </section>
  )
}
