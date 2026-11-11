import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode, Ref, RefObject } from 'react'
import type { AssetFlags } from '../../core/assetfacts/assetFacts'
import { explorerAddress } from '../../core/explorer'
import { NO_VALUE, formatExact, formatUnits, formatUtcTime } from '../../core/format'
import { shortAddress } from '../../core/options/format'
import { Address, Amount, Button, Callout, IconButton, IconClose, IconRefresh, RowHeader, Segmented, Skeleton, Table, TableWrap, TBody, Td, TextField, Th, THead, Tr } from '../../ui'
import { COPY, STATE_DETAIL, STATE_LABEL } from './copy'
import { FILTER_ABOVE, flagLimits, needsDecision, rowActions } from './model'
import type { AccountRow, AddResult, IssuerActionKind, IssuerAsset } from './model'
import { RowActionButtons } from './RowActionButtons'
import { TxPanel } from './TxPanel'
import type { HoldersView, TxView } from './useIssuerConsole'
import styles from './AccountsSection.module.css'

export interface AccountsSectionProps {
  asset: IssuerAsset
  /** Typed addresses, then the holders, in the order to show. The Covered contract is not among them. */
  rows: AccountRow[]
  holders: HoldersView
  flags: AssetFlags | null
  /** Why no action can start right now (a transaction is in flight or unresolved), or null. */
  busy: string | null
  tx: TxView
  /** True while a confirmation is open over the page. */
  dialogOpen: boolean
  txHeadingRef?: Ref<HTMLHeadingElement>
  readAt: number | null
  refreshing: boolean
  onRefresh: () => void
  onAdd: (text: string) => AddResult
  onRemove: (address: string) => void
  onAction: (kind: IssuerActionKind, row: AccountRow) => void
  onRetryHolders: () => void
}

/** Below this width the four columns do not fit: the rows become a list of two-line entries. */
const LIST_BELOW_REM = 46

/** True while the element is narrower than `rem`. Measured on the section, not the viewport: the rail takes room too. */
function useNarrow(ref: RefObject<HTMLElement | null>, rem: number): boolean {
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setNarrow(el.clientWidth < rem * parseFloat(getComputedStyle(document.documentElement).fontSize))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rem])
  return narrow
}

function Identity({ row, onRemove }: { row: AccountRow; onRemove?: (address: string) => void }) {
  const c = COPY.accounts
  return (
    <span className={styles.identity}>
      <Address value={row.address} explorerUrl={explorerAddress(row.address)} explorerLabel={c.viewAddress} copyLabel={c.copyAddress} />
      {row.source === 'added' && onRemove ? <IconButton size="sm" label={c.remove(shortAddress(row.address))} icon={<IconClose />} onClick={() => onRemove(row.address)} /> : null}
    </span>
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

/** The state word, quiet when nothing needs a decision, and what any other state means in plain words. */
function Authorization({ row, asset }: { row: AccountRow; asset: IssuerAsset }) {
  if (!row.read) {
    return (
      <span className={styles.state}>
        <span className={styles.stateWord} data-tone="quiet">
          {COPY.accounts.reading}
        </span>
      </span>
    )
  }
  const { state, error, clawback } = row.read
  const tone = state === 'unauthorized' || state === 'maintain-only' ? 'ink' : 'quiet'
  return (
    <span className={styles.state}>
      <span className={styles.stateWord} data-tone={tone}>
        {STATE_LABEL[state]}
      </span>
      {state === 'authorized' || state === 'issuer' ? null : (
        <span className={styles.detail}>{state === 'unknown' && error ? COPY.accounts.readError(error) : STATE_DETAIL[state](asset.code)}</span>
      )}
      {clawback === false ? <span className={styles.detail}>{COPY.accounts.clawbackNotOnLine}</span> : null}
    </span>
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
 * The accounts the issuer acts on: the addresses typed in this session, then every account Horizon lists with a
 * trustline, those that need a decision first. A table where the section is wide enough, a list of two-line
 * entries where it is not, from the same rows. A transaction shows under the row it acts on.
 */
export function AccountsSection(props: AccountsSectionProps) {
  const { asset, holders, flags, busy, tx, dialogOpen, txHeadingRef, readAt, refreshing } = props
  const c = COPY.accounts
  // A long list can be cut to the accounts that need a decision. The row of a running action always stays.
  const [filter, setFilter] = useState<'all' | 'decide'>('all')
  const decide = props.rows.filter(needsDecision).length
  const filterable = props.rows.length > FILTER_ABOVE
  const rows = filterable && filter === 'decide' ? props.rows.filter((row) => needsDecision(row) || row.address === tx.target) : props.rows
  const root = useRef<HTMLElement | null>(null)
  const narrow = useNarrow(root, LIST_BELOW_REM)
  const limits = flags ? flagLimits(flags) : []
  const actionsOf = (row: AccountRow, size: 'sm' | 'md'): ReactNode => (
    <RowActionButtons
      row={row}
      actions={rowActions(row, flags, asset.code, busy)}
      running={tx.working && tx.target === row.address ? tx.kind : null}
      size={size}
      onAction={props.onAction}
    />
  )
  const panelOf = (row: AccountRow): ReactNode => (!dialogOpen && tx.target === row.address ? <TxPanel tx={tx} headingRef={txHeadingRef} /> : null)
  const loading = holders.status === 'loading'

  return (
    <section ref={root} className={styles.root} aria-labelledby="issuer-accounts-title">
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

      <AddForm code={asset.code} onAdd={props.onAdd} />

      {limits.length > 0 ? <p className={styles.limits}>{limits.join(' ')}</p> : null}

      {filterable ? (
        <Segmented
          label={c.filterLabel}
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'all', label: c.filterAll, count: props.rows.length, countLabel: c.filterCount },
            { value: 'decide', label: c.filterDecide, count: decide, countLabel: c.filterCount },
          ]}
          className={styles.filter}
        />
      ) : null}

      {narrow ? (
        rows.length > 0 || loading ? (
          <div className={styles.listWrap}>
            <p className={styles.listHead} aria-hidden="true">
              <span>{c.account}</span>
              <span>{c.balance(asset.code)}</span>
            </p>
            <ul className={styles.list} aria-label={c.caption(asset.code)} aria-busy={loading || undefined}>
              {rows.map((row) => (
                <li key={row.address} className={styles.item}>
                  <div className={styles.line}>
                    <Identity row={row} onRemove={props.onRemove} />
                    <span className={styles.itemBalance}>
                      <Balance row={row} asset={asset} />
                    </span>
                  </div>
                  <div className={styles.line}>
                    <Authorization row={row} asset={asset} />
                    {actionsOf(row, 'md')}
                  </div>
                  {panelOf(row)}
                </li>
              ))}
              {loading ? (
                <li className={styles.item}>
                  <span className="ui-vh">{c.holdersLoading(asset.code)}</span>
                  <Skeleton variant="rows" lines={3} />
                </li>
              ) : null}
            </ul>
          </div>
        ) : null
      ) : rows.length > 0 || loading ? (
        <TableWrap label={c.caption(asset.code)}>
          <Table caption={c.caption(asset.code)} fixed aria-busy={loading || undefined}>
            <colgroup>
              <col className={styles.colAccount} />
              <col className={styles.colBalance} />
              <col />
              <col className={styles.colActions} />
            </colgroup>
            <THead>
              <Tr>
                <Th>{c.account}</Th>
                <Th numeric>{c.balance(asset.code)}</Th>
                <Th>{c.authorization}</Th>
                <Th pinned>
                  <span className="ui-vh">{c.actions}</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Fragment key={row.address}>
                  <Tr>
                    <RowHeader className={styles.cell}>
                      <Identity row={row} onRemove={props.onRemove} />
                    </RowHeader>
                    <Td numeric className={styles.cell}>
                      <Balance row={row} asset={asset} />
                    </Td>
                    <Td className={styles.cell}>
                      <Authorization row={row} asset={asset} />
                    </Td>
                    <Td pinned className={styles.cell}>
                      {actionsOf(row, 'sm')}
                    </Td>
                  </Tr>
                  {panelOf(row) ? (
                    <Tr>
                      <Td colSpan={4} className={styles.panelCell}>
                        {panelOf(row)}
                      </Td>
                    </Tr>
                  ) : null}
                </Fragment>
              ))}
              {loading
                ? [0, 1, 2].map((i) => (
                    <Tr key={`skeleton-${i}`} aria-hidden="true">
                      <Td className={styles.cell}>
                        <Skeleton width="7rem" />
                      </Td>
                      <Td numeric className={styles.cell}>
                        <Skeleton width="4rem" />
                      </Td>
                      <Td className={styles.cell}>
                        <Skeleton width="6rem" />
                      </Td>
                      <Td className={styles.cell} />
                    </Tr>
                  ))
                : null}
            </TBody>
          </Table>
          {loading ? <span className="ui-vh">{c.holdersLoading(asset.code)}</span> : null}
        </TableWrap>
      ) : null}

      {holders.status === 'error' ? (
        <Callout
          variant="danger"
          title={c.holdersError(asset.code, holders.message)}
          actions={
            <Button size="sm" onClick={props.onRetryHolders}>
              {COPY.page.retry}
            </Button>
          }
        />
      ) : holders.status === 'ready' && holders.count === 0 ? (
        <p className={styles.footnote}>{c.holdersNone(asset.code)}</p>
      ) : holders.status === 'ready' && holders.more ? (
        <p className={styles.footnote}>{c.holdersMore(holders.count)}</p>
      ) : null}
    </section>
  )
}
