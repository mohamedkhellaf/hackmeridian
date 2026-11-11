import { useRef, useState } from 'react'
import { shortAddress } from '../../core/options/format'
import { Button, Callout, EmptyNote, PageHeader, Select } from '../../ui'
import { AccessLine } from './AccessLine'
import { AccountsSection } from './AccountsSection'
import { ActionLog } from './ActionLog'
import { AssetCard } from './AssetCard'
import { ClawbackDialog } from './ClawbackDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { ConsoleSkeleton } from './ConsoleSkeleton'
import { ContractStatement } from './ContractStatement'
import { COPY } from './copy'
import { IssuerPowers } from './IssuerPowers'
import { authorizeIsFinal, exposureRows, sentNothing } from './model'
import type { AccountRow, IssuerActionKind } from './model'
import type { IssuerConsole } from './useIssuerConsole'
import styles from './IssuerConsoleView.module.css'

type ConfirmKind = 'freeze' | 'authorize' | 'clawback'

/**
 * The Issuer page in every state of who is looking. Everyone reads the Covered contract as a statement, what
 * the issuer can do to the asset and the asset's facts; the issuer also gets the accounts, the actions and the
 * log. On mock data the same read-only page is drawn from the mock data, under the one sentence that says
 * nothing can be read from a network or signed. Presentational: everything comes from `useIssuerConsole`.
 */
export function IssuerConsoleView({ model: c }: { model: IssuerConsole }) {
  // The confirmation being shown. `nonce` makes each opening a fresh dialog (an empty amount, nothing typed).
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; target: string; nonce: number } | null>(null)
  const [open, setOpen] = useState(false)
  // The heading of the transaction shown under its row: where focus goes when a confirmation closes on a
  // transaction it sent (the row's own controls may have changed by then).
  const txHeading = useRef<HTMLHeadingElement | null>(null)
  const asset = c.asset
  const isIssuer = c.access.kind === 'issuer'
  const flags = c.flags.status === 'ready' ? c.flags.facts.flags : null
  const contractRow = c.contract.row
  const rowOf = (address: string): AccountRow | undefined => (contractRow?.address === address ? contractRow : c.rows.find((row) => row.address === address))
  const confirmRow = confirm ? rowOf(confirm.target) : undefined
  // The transaction shown inside a confirmation is the one that confirmation started.
  const confirmTx = confirm && c.tx.kind === confirm.kind && c.tx.target === confirm.target ? c.tx : null
  const sent = c.tx.state.phase !== 'idle' && !sentNothing(c.tx.state)

  const openConfirm = (kind: ConfirmKind, row: AccountRow) => {
    // A settled outcome leaves the page when the next action is prepared; it stays in "Recent actions".
    if (!c.tx.working) c.tx.dismiss()
    setConfirm((prev) => ({ kind, target: row.address, nonce: (prev?.nonce ?? 0) + 1 }))
    setOpen(true)
  }
  const onAction = (kind: IssuerActionKind, row: AccountRow) => {
    // Authorize takes nothing away and runs at once, unless the issuer cannot revoke: then it cannot be undone.
    if (kind === 'authorize' && !authorizeIsFinal(flags)) {
      if (!c.tx.working) c.tx.dismiss()
      void c.authorize(row.address)
      return
    }
    openConfirm(kind, row)
  }
  // The dialog can be closed at any time: a transaction it started goes on, and shows under its row.
  const closeConfirm = () => {
    setOpen(false)
    // Nothing was sent (declined, or refused before sending): there is no outcome to keep on the page.
    if (c.tx.state.phase !== 'idle' && sentNothing(c.tx.state)) c.tx.dismiss()
  }
  const settle = (state: { phase: string; effect: string }) => {
    if (!sentNothing(state)) setOpen(false)
  }
  const confirmAction = async () => {
    if (!confirm) return
    settle(confirm.kind === 'authorize' ? await c.authorize(confirm.target) : await c.freeze(confirm.target))
  }
  const confirmClawback = async (units: bigint) => {
    if (!confirm) return
    settle(await c.clawback(confirm.target, units))
  }

  const exposureOf = (row: AccountRow) => exposureRows(row, c.contract.exposure, row.escrow ? null : c.exposureOf(row.address))
  const health = c.contract.held !== null && c.contract.reserved !== null ? { held: c.contract.held, reserved: c.contract.reserved } : null

  const meta = asset ? (
    <>
      {c.assets.length > 1 ? (
        <Select
          label={COPY.page.assetLabel}
          hideLabel
          value={asset.contractId}
          onValueChange={c.selectAsset}
          options={c.assets.map((a) => ({ value: a.contractId, label: a.code, detail: a.issuer && !c.mock ? shortAddress(a.issuer) : undefined }))}
        />
      ) : null}
      <AccessLine access={c.access} code={asset.code} issuer={c.issuer} otherIssued={c.otherIssued} onConnect={c.connect} onRetry={c.retryAccess} onOpen={c.selectAsset} />
    </>
  ) : undefined

  return (
    <div className={styles.page}>
      <PageHeader title={COPY.page.title} description={c.mock ? COPY.mock.sentence : COPY.page.description} meta={meta} />

      {c.assetsStatus === 'loading' ? (
        <ConsoleSkeleton />
      ) : c.assetsStatus === 'error' ? (
        <Callout variant="danger" title={COPY.page.assetsError} actions={<Button onClick={c.retryAssets}>{COPY.page.retry}</Button>}>
          {c.assetsError}
        </Callout>
      ) : !asset ? (
        <EmptyNote title={COPY.page.noAssets} hint={COPY.page.noAssetsHint} headingLevel={2} />
      ) : (
        <div className={styles.layout}>
          <div className={styles.main}>
            {isIssuer && c.unresolved ? (
              <Callout variant="warning" title={COPY.reasons.unknownPending} actions={<Button onClick={c.unresolved.check}>{COPY.tx.checkAgain}</Button>} />
            ) : null}
            <ContractStatement
              asset={asset}
              contract={c.contract}
              canAct={isIssuer}
              flags={flags}
              busy={c.busy}
              tx={c.tx}
              dialogOpen={open}
              txHeadingRef={txHeading}
              onAction={onAction}
            />
            {isIssuer ? (
              <AccountsSection
                asset={asset}
                rows={c.rows}
                holders={c.holders}
                flags={flags}
                busy={c.busy}
                tx={c.tx}
                dialogOpen={open}
                txHeadingRef={txHeading}
                readAt={c.readAt}
                refreshing={c.refreshing}
                onRefresh={c.refresh}
                onAdd={c.addAccount}
                onRemove={c.removeAccount}
                onAction={onAction}
                onRetryHolders={c.refresh}
              />
            ) : null}
            {c.log.length > 0 ? <ActionLog rows={c.log} code={asset.code} onCheck={c.checkLogged} /> : null}
            <IssuerPowers flags={c.flags} onRetry={c.retryFlags} />
          </div>

          <aside className={styles.side} aria-label={COPY.asset.title}>
            <AssetCard asset={asset} issuer={c.issuer} flags={c.flags} record={c.record} mock={c.mock} />
          </aside>
        </div>
      )}

      {asset && confirm && confirmRow && confirm.kind !== 'clawback' ? (
        <ConfirmDialog
          key={`${confirm.kind}:${confirm.target}:${confirm.nonce}`}
          open={open}
          kind={confirm.kind}
          asset={asset}
          row={confirmRow}
          exposure={exposureOf(confirmRow)}
          tx={confirmTx}
          finalFocus={sent ? txHeading : undefined}
          onConfirm={() => void confirmAction()}
          onClose={closeConfirm}
        />
      ) : null}
      {asset && confirm && confirmRow && confirm.kind === 'clawback' ? (
        <ClawbackDialog
          key={`clawback:${confirm.target}:${confirm.nonce}`}
          open={open}
          asset={asset}
          row={confirmRow}
          health={confirmRow.escrow ? health : null}
          exposure={exposureOf(confirmRow)}
          tx={confirmTx}
          finalFocus={sent ? txHeading : undefined}
          onConfirm={(units) => void confirmClawback(units)}
          onClose={closeConfirm}
        />
      ) : null}
    </div>
  )
}
