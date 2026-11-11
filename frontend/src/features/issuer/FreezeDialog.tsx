import { useRef } from 'react'
import { formatExact, formatUnits } from '../../core/format'
import { shortAddress } from '../../core/options/format'
import { Address, Amount, Button, Callout, Dialog, KeyValue, KeyValueItem } from '../../ui'
import { COPY } from './copy'
import { IdText } from './IdText'
import type { AccountRow, IssuerAsset } from './model'
import { TxProgress } from './TxProgress'
import type { TxView } from './useIssuerConsole'
import styles from './FreezeDialog.module.css'

export interface FreezeDialogProps {
  open: boolean
  asset: IssuerAsset
  row: AccountRow
  /** What the account (or the contract) has open on the asset, as one sentence. Null when it was not read. */
  exposure: string | null
  /** The transaction of this confirmation, once it was started. */
  tx: TxView | null
  onConfirm: () => void
  onClose: () => void
}

/** The confirmation before a freeze: what is frozen, and what that blocks, settlement of options included. */
export function FreezeDialog({ open, asset, row, exposure, tx, onConfirm, onClose }: FreezeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const c = COPY.freeze
  const working = tx?.working ?? false
  const blocks = row.escrow ? c.escrowBlocks(asset.code) : c.accountBlocks(asset.code)
  const balance = row.read?.balance ?? null
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !working) onClose()
      }}
      role="alertdialog"
      title={row.escrow ? c.escrowTitle(asset.code) : <IdText text={c.title(shortAddress(row.address), asset.code)} />}
      description={c.description(asset.code)}
      initialFocus={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose} disabled={working}>
            {c.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={working}>
            {c.confirm}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <KeyValue figures="sans">
          <KeyValueItem label={c.asset}>{asset.code}</KeyValueItem>
          <KeyValueItem label={row.escrow ? COPY.accounts.escrowName : row.kind === 'account' ? c.account : c.contract}>
            <Address value={row.address} length="full" copyLabel={null} />
          </KeyValueItem>
          {balance !== null ? (
            <KeyValueItem label={c.balance}>
              <Amount value={formatUnits(balance, asset.decimals)} exact={formatExact(balance, asset.decimals)} unit={asset.code} />
            </KeyValueItem>
          ) : null}
        </KeyValue>
        <Callout variant="warning" title={c.blocksTitle}>
          <ul>
            {blocks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {exposure ? <p>{exposure}</p> : null}
        </Callout>
        {tx && tx.state.phase !== 'idle' ? <TxProgress state={tx.state} label={tx.label ?? c.confirm} /> : null}
      </div>
    </Dialog>
  )
}
