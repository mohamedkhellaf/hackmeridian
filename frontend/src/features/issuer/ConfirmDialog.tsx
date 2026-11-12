import { useRef } from 'react'
import type { RefObject } from 'react'
import { formatExact, formatUnits, groupDigits } from '../../core/format'
import { shortAddress } from '../../core/options/format'
import { Address, Amount, Button, Callout, Dialog, KeyValue, KeyValueItem } from '../../ui'
import { COPY } from './copy'
import { IdText } from './IdText'
import type { AccountRow, ExposureRow, IssuerAsset } from './model'
import { TxProgress } from './TxProgress'
import type { TxView } from './useIssuerConsole'
import styles from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
  open: boolean
  /** `freeze`, or `authorize` when the issuer cannot revoke and an authorization cannot be undone. */
  kind: 'freeze' | 'authorize'
  asset: IssuerAsset
  row: AccountRow
  /** What the account (or the contract) has open on the asset. Null when it was not read. */
  exposure: ExposureRow[] | null
  /** The transaction of this confirmation, once it was started. */
  tx: TxView | null
  /** Where focus goes when the dialog closes, when not back to the row it was opened from. */
  finalFocus?: RefObject<HTMLElement | null>
  onConfirm: () => void
  onClose: () => void
}

/**
 * The confirmation before a freeze (what is frozen, what that blocks, settlement of options included), and before
 * an authorization that cannot be undone. Once the transaction starts, the form gives way to its progress; the
 * dialog can be hidden at any time and the page shows the same progress under the row.
 */
export function ConfirmDialog({ open, kind, asset, row, exposure, tx, finalFocus, onConfirm, onClose }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const working = tx?.working ?? false
  const started = tx !== null && tx.state.phase !== 'idle'
  const balance = row.read?.balance ?? null
  const freeze = kind === 'freeze'
  const c = freeze ? COPY.freeze : COPY.authorizeFinal
  const who = shortAddress(row.address)
  const title = row.escrow ? c.escrowTitle(asset.code) : <IdText text={c.title(who, asset.code)} />
  const description = freeze ? COPY.freeze.description(asset.code) : row.escrow ? COPY.authorizeFinal.escrowDescription(asset.code) : COPY.authorizeFinal.description(asset.code)
  const blocks = row.escrow ? COPY.freeze.escrowBlocks(asset.code) : COPY.freeze.accountBlocks(asset.code)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      role="alertdialog"
      title={title}
      description={description}
      initialFocus={cancelRef}
      finalFocus={finalFocus}
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose}>
            {working ? COPY.dialog.hide : COPY.dialog.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={working}>
            {c.confirm}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {started ? (
          <div className={styles.progress}>
            <p className={styles.summary}>
              <IdText text={tx.label ?? c.confirm} />
            </p>
            <TxProgress state={tx.state} label={tx.label ?? c.confirm} />
          </div>
        ) : null}
        {working ? null : (
          <>
            <KeyValue figures="sans" layout="stacked">
              <KeyValueItem label={row.escrow ? COPY.accounts.escrowName : row.kind === 'account' ? COPY.freeze.account : COPY.freeze.contract}>
                <Address value={row.address} length="full" copyLabel={null} />
              </KeyValueItem>
            </KeyValue>
            <KeyValue figures="sans">
              <KeyValueItem label={COPY.freeze.asset}>{asset.code}</KeyValueItem>
              {balance !== null ? (
                <KeyValueItem label={COPY.freeze.balance}>
                  <Amount value={formatUnits(balance, asset.decimals)} exact={formatExact(balance, asset.decimals)} />
                </KeyValueItem>
              ) : null}
              {(exposure ?? []).map((line) => (
                <KeyValueItem key={line.label} label={line.label} hint={line.hint}>
                  {groupDigits(String(line.value))}
                </KeyValueItem>
              ))}
            </KeyValue>
            {freeze ? (
              <Callout variant="warning" title={COPY.freeze.blocksTitle}>
                <ul>
                  {blocks.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  )
}
