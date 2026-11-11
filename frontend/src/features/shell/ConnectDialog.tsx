import { WALLET_DISCLOSURE } from '../../core/disclosures'
import { Callout, Dialog, EmptyNote, IconExternal, Skeleton, Spinner } from '../../ui'
import { initials, useWalletDialog } from '../../wallet'
import type { DialogState, WalletInfo } from '../../wallet'
import { CONNECT_EMPTY, CONNECT_EMPTY_HINT, CONNECT_LOADING, CONNECT_TITLE } from './copy'
import { walletRows, walletStatus } from './wallet'
import styles from './ConnectDialog.module.css'

function WalletRow({ wallet, busyId, pick }: { wallet: WalletInfo; busyId: string | null; pick: (id: string) => void }) {
  const status = walletStatus(wallet, busyId)
  const body = (
    <>
      <span className={styles.monogram} aria-hidden="true">
        {initials(wallet.name)}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{wallet.name}</span>
        <span className={styles.kind}>{wallet.kind}</span>
      </span>
    </>
  )

  // An extension that is not installed is a link to where it is published, never a dead button.
  if (wallet.availability === 'missing') {
    return (
      <a className={styles.row} href={wallet.url} target="_blank" rel="noopener noreferrer">
        {body}
        <span className={styles.status}>
          <span className="ui-vh">, </span>
          {status}
          <IconExternal size={14} />
          <span className="ui-vh"> (opens in a new tab)</span>
        </span>
      </a>
    )
  }

  const busy = busyId === wallet.id
  // While one wallet is asked, the others stay focusable and say they are unavailable; a press does nothing.
  const blocked = busyId !== null
  return (
    <button
      type="button"
      className={styles.row}
      aria-busy={busy || undefined}
      aria-disabled={blocked || undefined}
      data-busy={busy || undefined}
      data-blocked={(blocked && !busy) || undefined}
      onClick={() => {
        if (!blocked) pick(wallet.id)
      }}
    >
      {body}
      <span className={styles.status}>
        <span className="ui-vh">, </span>
        {busy ? <Spinner /> : null}
        {status}
      </span>
    </button>
  )
}

/** The connect dialog from plain state (the specimens stage every state with it). */
export function ConnectDialogView({ dialog }: { dialog: DialogState }) {
  const { open, loading, wallets, busyId, error, pick, close } = dialog
  const rows = walletRows(wallets)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      title={CONNECT_TITLE}
      size="sm"
    >
      {error ? (
        <Callout variant="danger" alert>
          {error}
        </Callout>
      ) : null}
      {loading ? (
        <div className={styles.loading} aria-busy="true">
          <p className={styles.loadingText}>{CONNECT_LOADING}</p>
          <Skeleton variant="rows" lines={4} />
        </div>
      ) : rows.length > 0 ? (
        <ul role="list" className={styles.list}>
          {rows.map((wallet) => (
            <li key={wallet.id}>
              <WalletRow wallet={wallet} busyId={busyId} pick={pick} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote title={CONNECT_EMPTY} hint={CONNECT_EMPTY_HINT} />
      )}
      <p className={styles.disclosure}>{WALLET_DISCLOSURE}</p>
    </Dialog>
  )
}

/**
 * The wallet picker, rendered from the wallet layer's dialog state: the wallets it found (installed first),
 * what choosing each one does, loading and error states, and the Testnet sentence. Under the test wallet
 * (VITE_E2E=1) the state never opens and nothing is rendered.
 */
export function ConnectDialog() {
  return <ConnectDialogView dialog={useWalletDialog()} />
}
