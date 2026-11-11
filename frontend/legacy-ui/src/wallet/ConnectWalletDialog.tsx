import { Banner, Dialog } from '../ui'
import { splitWallets, type WalletInfo } from './helpers'
import type { DialogState } from './walletContext'

export function ConnectWalletDialog({ dialog }: { dialog: DialogState }) {
  const { open, loading, wallets, busyId, error, pick, close } = dialog
  if (!open) return null

  const { installed, more } = splitWallets(wallets)
  const rows: WalletInfo[] = [...installed, ...more]

  const row = (w: WalletInfo) => {
    const status = busyId === w.id ? 'Waiting' : w.availability === 'installed' ? 'Detected' : 'Web'
    if (w.availability === 'missing') {
      return (
        <a key={w.id} className="cw-row" href={w.url} target="_blank" rel="noreferrer" aria-label={`Install ${w.name} (opens in a new tab)`}>
          <span className="cw-name">{w.name}</span>
          <span className="cw-status">Install</span>
        </a>
      )
    }
    return (
      <button key={w.id} type="button" className="cw-row" disabled={busyId !== null} aria-busy={busyId === w.id} onClick={() => pick(w.id)}>
        <span className="cw-name">{w.name}</span>
        <span className="cw-status">{status}</span>
      </button>
    )
  }

  return (
    <Dialog title="Connect a wallet" width={400} onClose={close}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <p className="cw-muted" role="status">
          Looking for wallets
        </p>
      ) : rows.length > 0 ? (
        <div className="cw-list">{rows.map(row)}</div>
      ) : (
        <p className="cw-muted">No wallets found.</p>
      )}
      <p className="cw-muted">Set the wallet to Testnet. StellSec never asks for your secret key or recovery phrase.</p>
    </Dialog>
  )
}
