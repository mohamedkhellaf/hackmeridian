import { useSyncExternalStore } from 'react'
import { WALLET_DISCLOSURE } from '../../core/disclosures'
import { Button, Callout, Dialog, IconExternal, Skeleton, Spinner } from '../../ui'
import { useWallet, useWalletDialog } from '../../wallet'
import type { DialogState, WalletInfo } from '../../wallet'
import { CONNECT_EMPTY, CONNECT_EMPTY_HINT, CONNECT_RETRY, CONNECT_TITLE, CONNECT_TOUCH_NOTE, connectWaiting } from './copy'
import { walletRows, walletStatus } from './wallet'
import styles from './ConnectDialog.module.css'

/** As many placeholder rows as the list usually has, so the dialog keeps its size when the list arrives. */
const LOADING_ROWS = 5

function WalletRow({ wallet, busyId, pick }: { wallet: WalletInfo; busyId: string | null; pick: (id: string) => void }) {
  const status = walletStatus(wallet, busyId)

  // An extension that is not installed is a link to where it is published, never a dead button.
  if (wallet.availability === 'missing') {
    return (
      <a className={styles.row} href={wallet.url} target="_blank" rel="noopener noreferrer">
        <span className={styles.name}>{wallet.name}</span>
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
      <span className={styles.name}>{wallet.name}</span>
      <span className={styles.status}>
        <span className="ui-vh">, </span>
        {busy ? <Spinner /> : null}
        {status}
      </span>
    </button>
  )
}

export interface ConnectDialogViewProps {
  dialog: DialogState
  /** A touch device: extensions cannot be installed from here, so only the wallets that open in the browser are listed. */
  touch?: boolean
  /** Asks the wallet layer for the list again, after it could not be loaded. */
  onRetry?: () => void
}

/** The connect dialog from plain state (the specimens stage every state with it). */
export function ConnectDialogView({ dialog, touch = false, onRetry }: ConnectDialogViewProps) {
  const { open, loading, wallets, busyId, error, pick, close } = dialog
  const rows = walletRows(wallets).filter((wallet) => !touch || wallet.availability !== 'missing')
  const busyWallet = busyId === null ? undefined : rows.find((wallet) => wallet.id === busyId)
  // No list and an error: the list itself could not be loaded. The error and a retry are all there is to show.
  const listFailed = !loading && rows.length === 0 && error !== null
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
        <Callout
          variant="danger"
          alert
          actions={
            listFailed && onRetry ? (
              <Button size="sm" onClick={onRetry}>
                {CONNECT_RETRY}
              </Button>
            ) : undefined
          }
        >
          {error}
        </Callout>
      ) : null}
      {loading ? (
        <ul role="list" className={styles.list} aria-busy="true" aria-label="Looking for wallets">
          {Array.from({ length: LOADING_ROWS }, (_, index) => (
            <li key={index} className={styles.placeholder}>
              <Skeleton variant="text" width={index % 2 === 0 ? '6rem' : '4.5rem'} />
            </li>
          ))}
        </ul>
      ) : rows.length > 0 ? (
        <ul role="list" className={styles.list}>
          {rows.map((wallet) => (
            <li key={wallet.id}>
              <WalletRow wallet={wallet} busyId={busyId} pick={pick} />
            </li>
          ))}
        </ul>
      ) : listFailed ? null : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{CONNECT_EMPTY}</p>
          <p className={styles.note}>{touch ? CONNECT_TOUCH_NOTE : CONNECT_EMPTY_HINT}</p>
        </div>
      )}
      {busyWallet ? <p className={styles.waiting}>{connectWaiting(busyWallet.name)}</p> : null}
      {touch && rows.length > 0 && !loading ? <p className={styles.note}>{CONNECT_TOUCH_NOTE}</p> : null}
      <p className={styles.note}>{WALLET_DISCLOSURE}</p>
    </Dialog>
  )
}

// A touch screen with no hover: a phone or a tablet, where browser extensions are not installed from a store link.
const TOUCH_QUERY = '(pointer: coarse) and (hover: none)'
const canMatch = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
const readTouch = (): boolean => canMatch() && window.matchMedia(TOUCH_QUERY).matches
function subscribeTouch(onChange: () => void): () => void {
  if (!canMatch()) return () => {}
  const list = window.matchMedia(TOUCH_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

/**
 * The wallet picker, rendered from the wallet layer's dialog state: the wallets it found (installed first), what
 * choosing each one does, loading and error states, and the Testnet sentence. On a touch device it lists only the
 * wallets that open in the browser. Under the test wallet (VITE_E2E=1) the state never opens and nothing is
 * rendered.
 */
export function ConnectDialog() {
  const { connect } = useWallet()
  const touch = useSyncExternalStore(subscribeTouch, readTouch, () => false)
  return <ConnectDialogView dialog={useWalletDialog()} touch={touch} onRetry={() => void connect()} />
}
