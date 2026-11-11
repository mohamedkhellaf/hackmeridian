import { useState } from 'react'
import { clawbackShortfallDisclosure } from '../../core/disclosures'
import { formatExact, formatUnits } from '../../core/format'
import { Address, Amount, AmountField, Button, Callout, Dialog, KeyValue, KeyValueItem, TextField } from '../../ui'
import { COPY } from './copy'
import { checkClawbackAmount, clawbackImpact, clawbackPhrase, phraseProgress } from './model'
import type { AccountRow, IssuerAsset } from './model'
import { TxProgress } from './TxProgress'
import type { TxView } from './useIssuerConsole'
import styles from './ClawbackDialog.module.css'

export interface ClawbackDialogProps {
  open: boolean
  asset: IssuerAsset
  row: AccountRow
  /** What the options contract owes and holds in this asset. Null when the reserves were not read. */
  health: { reserved: bigint; held: bigint } | null
  /** What the account has open on the asset, as one sentence. Null when it was not read. */
  exposure: string | null
  /** The transaction of this confirmation, once it was started. */
  tx: TxView | null
  onConfirm: (units: bigint) => void
  onClose: () => void
}

/** The confirmation sentence with the phrase to type set in mono, so it reads as the thing to copy. */
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
 * the tail of the account: the two things a wrong click gets wrong. For the options contract the dialog shows
 * what the clawback does to the reserves and says what a shortfall means for option holders.
 */
export function ClawbackDialog({ open, asset, row, health, exposure, tx, onConfirm, onClose }: ClawbackDialogProps) {
  const [amount, setAmount] = useState('')
  const [typed, setTyped] = useState('')
  const c = COPY.clawback
  const working = tx?.working ?? false
  const balance = row.read?.balance ?? null
  const check = checkClawbackAmount(amount, balance, asset)
  const phrase = check.ok ? clawbackPhrase(check.text, asset.code, row.address) : ''
  const progress = phraseProgress(typed, phrase)
  const ready = check.ok && progress === 'match'
  const impact = row.escrow && health && check.ok ? clawbackImpact(health, check.units) : null
  const figure = (units: bigint) => <Amount figure="serif" value={formatUnits(units, asset.decimals)} exact={formatExact(units, asset.decimals)} unit={asset.code} />

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !working) onClose()
      }}
      role="alertdialog"
      dismissible={false}
      title={c.title(asset.code)}
      description={row.escrow ? c.escrowDescription(asset.code) : c.description(asset.code)}
      initialFocus="first-control"
      footer={
        <>
          <Button onClick={onClose} disabled={working}>
            {c.cancel}
          </Button>
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
        <KeyValue figures="sans">
          <KeyValueItem label={row.escrow ? COPY.accounts.escrowName : c.from}>
            <Address value={row.address} length="full" copyLabel={null} />
          </KeyValueItem>
          <KeyValueItem label={c.balance}>
            {balance !== null ? <Amount value={formatUnits(balance, asset.decimals)} exact={formatExact(balance, asset.decimals)} unit={asset.code} /> : c.balanceUnknown}
          </KeyValueItem>
        </KeyValue>

        <AmountField
          label={c.amount}
          value={amount}
          onValueChange={setAmount}
          unit={asset.code}
          decimals={asset.decimals}
          disabled={working}
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
                <KeyValueItem label={c.shortAfter}>{impact && impact.short > 0n ? figure(impact.short) : c.notShort}</KeyValueItem>
              </KeyValue>
            ) : (
              <p className={styles.note}>{c.impactUnknown}</p>
            )}
          </section>
        ) : null}

        {row.escrow ? (
          <Callout variant="danger" label={c.warningWord} title={c.escrowWarningTitle}>
            <p>{c.escrowWarning(asset.code)}</p>
            <p>{clawbackShortfallDisclosure(asset.code)}</p>
          </Callout>
        ) : (
          <Callout variant="danger" label={c.warningWord}>
            <p>{c.accountWarning}</p>
            {exposure ? <p>{exposure}</p> : null}
          </Callout>
        )}

        <TextField
          label={check.ok ? <PhraseLabel text={c.confirmLabel(phrase)} phrase={phrase} /> : c.confirmLabelIdle}
          hint={check.ok ? c.confirmHint : c.confirmHintIdle}
          error={check.ok && progress === 'mismatch' ? c.confirmMismatch(phrase) : undefined}
          value={typed}
          onValueChange={setTyped}
          disabled={!check.ok || working}
          mono
          autoComplete="off"
          name="issuer-clawback-confirm"
        />

        {tx && tx.state.phase !== 'idle' ? <TxProgress state={tx.state} label={tx.label ?? c.confirm} /> : null}
      </div>
    </Dialog>
  )
}
