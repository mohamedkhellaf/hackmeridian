import { useState } from 'react'
import type { RefObject } from 'react'
import { clawbackShortfallDisclosure } from '../../core/disclosures'
import { formatExact, formatUnits, groupDigits } from '../../core/format'
import { Address, Amount, AmountField, Button, Callout, Dialog, IconWarning, KeyValue, KeyValueItem, TextField } from '../../ui'
import { COPY } from './copy'
import { IdText } from './IdText'
import { checkClawbackAmount, clawbackImpact, clawbackPhrase, phraseProgress } from './model'
import type { AccountRow, ExposureRow, IssuerAsset } from './model'
import { TxProgress } from './TxProgress'
import type { TxView } from './useIssuerConsole'
import styles from './ClawbackDialog.module.css'

export interface ClawbackDialogProps {
  open: boolean
  asset: IssuerAsset
  row: AccountRow
  /** What the Covered contract owes and holds in this asset. Null when the reserves were not read. */
  health: { reserved: bigint; held: bigint } | null
  /** What the account (or the contract) has open on the asset. Null when it was not read. */
  exposure: ExposureRow[] | null
  /** The transaction of this confirmation, once it was started. */
  tx: TxView | null
  /** Where focus goes when the dialog closes, when not back to the row it was opened from. */
  finalFocus?: RefObject<HTMLElement | null>
  onConfirm: (units: bigint) => void
  onClose: () => void
}

/** The confirmation sentence with the phrase to type set in mono at the field's size, so it reads as the thing to copy. */
function PhraseLabel({ text, phrase }: { text: string; phrase: string }) {
  const at = text.indexOf(phrase)
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <span className={styles.phrase}>{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  )
}

/**
 * The confirmation before a clawback. The issuer types the amount, then types it again with the asset code and
 * the tail of the address: the two things a wrong click gets wrong. For the Covered contract the dialog shows
 * what the clawback does to the reserves, and the shortfall it would leave, from the same figures. Once the
 * transaction starts, the form gives way to its progress; the dialog can be hidden at any time.
 */
export function ClawbackDialog({ open, asset, row, health, exposure, tx, finalFocus, onConfirm, onClose }: ClawbackDialogProps) {
  const [amount, setAmount] = useState('')
  const [typed, setTyped] = useState('')
  const c = COPY.clawback
  const working = tx?.working ?? false
  const started = tx !== null && tx.state.phase !== 'idle'
  const balance = row.read?.balance ?? null
  const check = checkClawbackAmount(amount, balance, asset)
  const phrase = check.ok ? clawbackPhrase(check.text, asset.code, row.address) : ''
  const progress = phraseProgress(typed, phrase)
  const ready = check.ok && progress === 'match'
  const impact = row.escrow && health && check.ok ? clawbackImpact(health, check.units) : null
  const units = (n: bigint) => formatUnits(n, asset.decimals)
  const figure = (n: bigint) => <Amount figure="serif" value={units(n)} exact={formatExact(n, asset.decimals)} />

  // What the clawback does to the Covered contract, said once from the figures above it.
  let effect = null
  if (row.escrow) {
    if (!health) {
      effect = (
        <Callout variant="danger" title={c.unknownTitle}>
          <p>{clawbackShortfallDisclosure(asset.code)}</p>
        </Callout>
      )
    } else if (impact && impact.short > 0n) {
      effect = (
        <Callout variant="danger" title={c.shortTitle(units(impact.short), asset.code)}>
          <p>{clawbackShortfallDisclosure(asset.code)}</p>
        </Callout>
      )
    } else if (impact) {
      effect = <p className={styles.note}>{c.covered(units(impact.heldAfter), units(impact.reserved))}</p>
    } else {
      effect = <p className={styles.note}>{health.held > health.reserved ? c.free(units(health.held - health.reserved), asset.code) : c.freeNone}</p>
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      role="alertdialog"
      dismissible={false}
      title={c.title(asset.code)}
      description={row.escrow ? c.escrowDescription(asset.code) : c.description(asset.code)}
      initialFocus="first-control"
      finalFocus={finalFocus}
      footer={
        <>
          <Button onClick={onClose}>{working ? COPY.dialog.hide : COPY.dialog.cancel}</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (check.ok && ready) onConfirm(check.units)
            }}
            disabled={!ready}
            disabledReason={c.blocked}
            loading={working}
          >
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
              <KeyValueItem label={row.escrow ? COPY.accounts.escrowName : c.from}>
                <Address value={row.address} length="full" copyLabel={null} />
              </KeyValueItem>
            </KeyValue>
            <KeyValue figures="sans">
              <KeyValueItem label={c.balance}>{balance !== null ? <Amount value={units(balance)} exact={formatExact(balance, asset.decimals)} /> : c.balanceUnknown}</KeyValueItem>
              {(exposure ?? []).map((line) => (
                <KeyValueItem key={line.label} label={line.label} hint={line.hint}>
                  {groupDigits(String(line.value))}
                </KeyValueItem>
              ))}
            </KeyValue>

            <AmountField
              label={c.amount}
              value={amount}
              onValueChange={setAmount}
              unit={asset.code}
              decimals={asset.decimals}
              error={check.ok ? undefined : (check.error ?? undefined)}
              onMax={balance !== null && balance > 0n ? () => setAmount(formatExact(balance, asset.decimals, { minDp: 0, group: false })) : undefined}
              maxLabel={balance !== null ? c.max(formatExact(balance, asset.decimals), asset.code) : undefined}
            />

            {row.escrow ? (
              <section className={styles.impact} aria-labelledby="issuer-clawback-impact">
                <h3 id="issuer-clawback-impact" className={styles.impactTitle}>
                  {c.impactTitle}
                </h3>
                {health ? (
                  <KeyValue>
                    <KeyValueItem label={c.reserved}>{figure(health.reserved)}</KeyValueItem>
                    <KeyValueItem label={c.heldNow}>{figure(health.held)}</KeyValueItem>
                    <KeyValueItem label={c.heldAfter}>{impact ? figure(impact.heldAfter) : figure(health.held)}</KeyValueItem>
                    <KeyValueItem
                      label={
                        impact && impact.short > 0n ? (
                          <span className={styles.warn}>
                            <IconWarning size={16} />
                            {c.shortAfter}
                          </span>
                        ) : (
                          c.shortAfter
                        )
                      }
                    >
                      {impact && impact.short > 0n ? figure(impact.short) : c.notShort}
                    </KeyValueItem>
                  </KeyValue>
                ) : (
                  <p className={styles.note}>{c.impactUnknown}</p>
                )}
              </section>
            ) : null}

            {row.escrow ? effect : <Callout variant="danger" title={c.accountWarning} />}

            <TextField
              label={check.ok ? <PhraseLabel text={c.confirmLabel(phrase)} phrase={phrase} /> : c.confirmLabelIdle}
              hint={check.ok ? c.confirmHint : c.confirmHintIdle}
              error={check.ok && progress === 'mismatch' ? c.confirmMismatch(phrase) : undefined}
              value={typed}
              onValueChange={setTyped}
              disabled={!check.ok}
              mono
              autoComplete="off"
              name="issuer-clawback-confirm"
            />
          </>
        )}
      </div>
    </Dialog>
  )
}
