import { Link as RouterLink } from '@tanstack/react-router'
import type { Ref } from 'react'
import type { AssetFlags } from '../../core/assetfacts/assetFacts'
import { explorerAddress } from '../../core/explorer'
import { formatExact, formatUnits, groupDigits } from '../../core/format'
import { shortfall } from '../../core/reserves/reserves'
import { Address, Amount, Callout, Card, IconWarning, KeyValue, KeyValueItem, Link, Skeleton } from '../../ui'
import { COPY, STATE_LABEL } from './copy'
import { rowActions } from './model'
import type { AccountRow, IssuerActionKind, IssuerAsset } from './model'
import { RowActionButtons } from './RowActionButtons'
import { TxPanel } from './TxPanel'
import type { ContractView, TxView } from './useIssuerConsole'
import styles from './ContractStatement.module.css'

export interface ContractStatementProps {
  asset: IssuerAsset
  contract: ContractView
  /** True for the issuer: the statement carries its two actions. */
  canAct: boolean
  flags: AssetFlags | null
  busy: string | null
  tx: TxView
  /** True while a confirmation is open over the page. */
  dialogOpen: boolean
  txHeadingRef?: Ref<HTMLHeadingElement>
  onAction: (kind: IssuerActionKind, row: AccountRow) => void
}

/**
 * The Covered contract, the escrow of every option on the asset, as a statement for every viewer: what it holds,
 * what it owes to open options, how many options depend on it and (on Testnet) whether the issuer lets it hold
 * the asset. Not authorized is the state that stops every option on the asset, so it is said first, in full.
 */
export function ContractStatement({ asset, contract, canAct, flags, busy, tx, dialogOpen, txHeadingRef, onAction }: ContractStatementProps) {
  const c = COPY.contract
  const row = contract.row
  const read = row?.read
  const frozen = read?.state === 'unauthorized'
  const figure = (units: bigint) => <Amount figure="serif" value={formatUnits(units, asset.decimals)} exact={formatExact(units, asset.decimals)} unit={asset.code} />
  const pending = <Skeleton width="6rem" />
  const notRead = <span className={styles.quiet}>{c.notRead}</span>
  const short = contract.held !== null && contract.reserved !== null ? shortfall(contract.held, contract.reserved) : 0n
  const exposure = contract.exposure

  const actions =
    canAct && row ? (
      <RowActionButtons
        row={row}
        actions={rowActions(row, flags, asset.code, busy)}
        running={tx.working && tx.target === row.address ? tx.kind : null}
        size="md"
        onAction={onAction}
      />
    ) : null
  const onThisContract = row !== null && tx.target === row.address

  return (
    <Card
      title={c.title}
      headingLevel={2}
      aria-label={c.title}
      actions={contract.address ? <Address value={contract.address} length="medium" explorerUrl={explorerAddress(contract.address)} explorerLabel={COPY.accounts.viewAddress} copyLabel={COPY.accounts.copyAddress} /> : undefined}
      className={styles.root}
    >
      {frozen ? (
        <Callout variant="danger" title={c.notAuthorized(asset.code)} actions={actions ?? undefined} />
      ) : null}

      <KeyValue>
        <KeyValueItem label={c.held}>{contract.held !== null ? figure(contract.held) : contract.loading ? pending : notRead}</KeyValueItem>
        <KeyValueItem label={c.reserved}>{contract.reserved !== null ? figure(contract.reserved) : contract.loading ? pending : notRead}</KeyValueItem>
        {short > 0n ? (
          <KeyValueItem
            label={
              <span className={styles.warn}>
                <IconWarning size={16} />
                {c.short}
              </span>
            }
          >
            {figure(short)}
          </KeyValueItem>
        ) : null}
        <KeyValueItem label={c.open} hint={exposure && exposure.total > 0 ? c.openSplit(exposure.active, exposure.offered, exposure.awaiting) : undefined}>
          {exposure ? (exposure.total > 0 ? groupDigits(String(exposure.total)) : c.openNone) : contract.loading ? pending : notRead}
        </KeyValueItem>
        {row ? (
          <KeyValueItem label={c.authorization} hint={read?.state === 'unknown' && read.error ? COPY.accounts.readError(read.error) : undefined}>
            {read ? <span data-state={read.state} className={styles.state}>{STATE_LABEL[read.state]}</span> : pending}
          </KeyValueItem>
        ) : null}
      </KeyValue>

      <div className={styles.foot}>
        {frozen ? null : actions}
        <Link render={<RouterLink to="/reserves" />}>{c.reservesLink}</Link>
      </div>

      {onThisContract && !dialogOpen ? <TxPanel tx={tx} headingRef={txHeadingRef} /> : null}
    </Card>
  )
}
