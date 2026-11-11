import { useState } from 'react'
import { shortAddress } from '../../core/options/format'
import { Button, Callout, EmptyNote, PageHeader, Select } from '../../ui'
import { AccessNotice } from './AccessNotice'
import { AccountsSection } from './AccountsSection'
import { ActionLog } from './ActionLog'
import { AssetCard } from './AssetCard'
import { ClawbackDialog } from './ClawbackDialog'
import { ConsoleSkeleton } from './ConsoleSkeleton'
import { COPY } from './copy'
import { FreezeDialog } from './FreezeDialog'
import { exposureText, sentNothing } from './model'
import type { AccountRow } from './model'
import { TxPanel } from './TxPanel'
import type { IssuerConsole } from './useIssuerConsole'
import styles from './IssuerConsoleView.module.css'

type ConfirmKind = 'freeze' | 'clawback'

/**
 * The console on a Testnet build, in every state of who is looking: a guest and a wallet that is not the issuer
 * read the asset's flags and the options contract; the issuer also gets the accounts, the three actions, the
 * staged transaction and the log. Presentational: everything comes from `useIssuerConsole`.
 */
export function IssuerConsoleView({ model: c }: { model: IssuerConsole }) {
  // The confirmation being shown. `nonce` makes each opening a fresh dialog (an empty amount, nothing typed).
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; target: string; nonce: number } | null>(null)
  const [open, setOpen] = useState(false)
  const asset = c.asset
  const isIssuer = c.access.kind === 'issuer'
  const code = asset?.code ?? ''
  const confirmRow = confirm ? c.rows.find((row) => row.address === confirm.target) : undefined
  // The transaction shown inside a confirmation is the one that confirmation started.
  const confirmTx = confirm && c.tx.kind === confirm.kind && c.tx.target === confirm.target ? c.tx : null

  const openConfirm = (kind: ConfirmKind, row: AccountRow) => {
    // A settled outcome leaves the panel when the next action is prepared; it stays in "Recent actions".
    if (!c.tx.working) c.tx.dismiss()
    setConfirm((prev) => ({ kind, target: row.address, nonce: (prev?.nonce ?? 0) + 1 }))
    setOpen(true)
  }
  const closeConfirm = () => {
    setOpen(false)
    // Nothing was sent (declined, or refused before sending): there is no outcome to keep on the page.
    if (c.tx.state.phase !== 'idle' && sentNothing(c.tx.state)) c.tx.dismiss()
  }
  const confirmFreeze = async () => {
    if (!confirm) return
    const state = await c.freeze(confirm.target)
    if (!sentNothing(state)) setOpen(false)
  }
  const confirmClawback = async (units: bigint) => {
    if (!confirm) return
    const state = await c.clawback(confirm.target, units)
    if (!sentNothing(state)) setOpen(false)
  }

  const exposureOfRow = (row: AccountRow) => exposureText(row, code, c.escrowExposure, row.escrow ? null : c.exposureOf(row.address))

  return (
    <div className={styles.page}>
      <PageHeader
        title={COPY.page.title}
        description={COPY.page.description}
        meta={
          asset && c.access.kind === 'issuer' ? (
            <span>{COPY.access.issuer(asset.code)}</span>
          ) : asset && c.access.kind === 'checking' ? (
            <span>{COPY.access.checking(asset.code)}</span>
          ) : undefined
        }
        actions={
          asset && c.assets.length > 1 ? (
            <Select
              label={COPY.page.assetLabel}
              value={asset.contractId}
              onValueChange={c.selectAsset}
              options={c.assets.map((a) => ({ value: a.contractId, label: a.code, detail: a.issuer ? shortAddress(a.issuer) : undefined }))}
            />
          ) : undefined
        }
      />

      {c.assetsStatus === 'loading' ? (
        <ConsoleSkeleton />
      ) : c.assetsStatus === 'error' ? (
        <Callout variant="danger" title={COPY.page.assetsError} actions={<Button onClick={c.retryAssets}>{COPY.page.retry}</Button>}>
          {c.assetsError}
        </Callout>
      ) : !asset ? (
        <EmptyNote title={COPY.page.noAssets} hint={COPY.page.noAssetsHint} headingLevel={2} />
      ) : (
        <div className={styles.layout} data-issuer={isIssuer || undefined}>
          {c.access.kind === 'guest' || c.access.kind === 'not-issuer' ? (
            <div className={styles.notice}>
              <AccessNotice access={c.access} code={asset.code} onConnect={c.connect} />
            </div>
          ) : null}

          <div className={styles.main}>
            {!open ? <TxPanel tx={c.tx} /> : null}
            <AccountsSection
              asset={asset}
              rows={c.rows}
              holders={c.holders}
              flags={c.flags.status === 'ready' ? c.flags.facts.flags : null}
              canAct={isIssuer}
              busy={c.busy}
              running={c.tx.working && c.tx.kind && c.tx.target ? { kind: c.tx.kind, target: c.tx.target } : null}
              reserved={c.health?.reserved ?? null}
              readAt={c.readAt}
              refreshing={c.refreshing}
              onRefresh={c.refresh}
              onAdd={c.addAccount}
              onRemove={c.removeAccount}
              onAuthorize={(row) => void c.authorize(row.address)}
              onFreeze={(row) => openConfirm('freeze', row)}
              onClawback={(row) => openConfirm('clawback', row)}
              onRetryHolders={c.refresh}
            />
            {isIssuer || c.log.length > 0 ? <ActionLog rows={c.log} /> : null}
          </div>

          <aside className={styles.side} aria-label={COPY.asset.title}>
            <AssetCard asset={asset} issuer={c.issuer} flags={c.flags} record={c.record} onRetryFlags={c.retryFlags} />
          </aside>
        </div>
      )}

      {asset && confirm && confirmRow && confirm.kind === 'freeze' ? (
        <FreezeDialog
          key={`freeze:${confirm.target}:${confirm.nonce}`}
          open={open}
          asset={asset}
          row={confirmRow}
          exposure={exposureOfRow(confirmRow)}
          tx={confirmTx}
          onConfirm={() => void confirmFreeze()}
          onClose={closeConfirm}
        />
      ) : null}
      {asset && confirm && confirmRow && confirm.kind === 'clawback' ? (
        <ClawbackDialog
          key={`clawback:${confirm.target}:${confirm.nonce}`}
          open={open}
          asset={asset}
          row={confirmRow}
          health={confirmRow.escrow ? c.health : null}
          exposure={exposureOfRow(confirmRow)}
          tx={confirmTx}
          onConfirm={(units) => void confirmClawback(units)}
          onClose={closeConfirm}
        />
      ) : null}
    </div>
  )
}
