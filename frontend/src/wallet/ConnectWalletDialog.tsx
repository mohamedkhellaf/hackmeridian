import { useEffect, useId, useRef } from 'react'
import { initials, splitWallets, type WalletInfo } from './helpers'
import type { DialogState } from './walletContext'

const GET_WALLET_URL = 'https://stellar.org/ecosystem/wallets'

function Badge({ name }: { name: string }) {
  return (
    <span className="cw-badge" aria-hidden="true">
      {initials(name)}
    </span>
  )
}

function Explainer() {
  return (
    <>
      <div className="cw-fact">
        <h3>What does connecting do?</h3>
        <p>Strata reads your public address and balances. Nothing moves until you approve a transaction in your wallet.</p>
      </div>
      <div className="cw-fact">
        <h3>Why Testnet?</h3>
        <p>This is a hackathon demo. Set your wallet to Testnet; the assets here have no real value.</p>
      </div>
      <div className="cw-fact">
        <h3>On your phone?</h3>
        <p>Use WalletConnect to sign with a mobile wallet such as LOBSTR (when enabled for this deployment).</p>
      </div>
      <a className="cw-get" href={GET_WALLET_URL} target="_blank" rel="noreferrer">
        Don&apos;t have a wallet? Get one ↗
      </a>
    </>
  )
}

export function ConnectWalletDialog({ dialog }: { dialog: DialogState }) {
  const { open, loading, wallets, busyId, error, pick, close } = dialog
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const returnFocus = useRef<Element | null>(null)

  // Focus management: move focus in on open, restore it on close.
  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement
    panelRef.current?.focus()
    return () => {
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus()
    }
  }, [open])

  if (!open) return null

  const { installed, more } = splitWallets(wallets)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    // Keep Tab inside the dialog.
    const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const walletButton = (w: WalletInfo, compact: boolean) => (
    <button
      key={w.id}
      type="button"
      className={compact ? 'cw-wallet cw-wallet-compact' : 'cw-wallet'}
      disabled={busyId !== null}
      aria-busy={busyId === w.id}
      onClick={() => pick(w.id)}
    >
      <Badge name={w.name} />
      <span className="cw-wallet-text">
        <span className="cw-wallet-name">{w.name}</span>
        {compact ? null : <span className="cw-wallet-kind">{w.kind}</span>}
      </span>
      {w.availability === 'installed' ? <span className="cw-pill">{busyId === w.id ? 'Waiting…' : 'Detected'}</span> : null}
    </button>
  )

  return (
    <div className="cw-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section
        ref={panelRef}
        className="cw-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="cw-side">
          <span className="cw-side-title">New to Stellar wallets?</span>
          <Explainer />
        </div>
        <div className="cw-main">
          <div className="cw-head">
            <h2 id={titleId}>Connect a wallet</h2>
            <button type="button" className="cw-close" aria-label="Close" onClick={close}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          </div>

          {error ? (
            <div className="cw-error" role="alert">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="cw-muted" role="status">
              Looking for wallets…
            </p>
          ) : (
            <>
              <span className="cw-lbl">Installed</span>
              {installed.length > 0 ? (
                <div className="cw-list">{installed.map((w) => walletButton(w, false))}</div>
              ) : (
                <p className="cw-muted">No wallet extension detected in this browser. Use a web wallet below or install one.</p>
              )}
              {more.length > 0 ? (
                <>
                  <span className="cw-lbl">More wallets</span>
                  <div className="cw-grid">
                    {more.map((w) =>
                      w.availability === 'web' ? (
                        <button
                          key={w.id}
                          type="button"
                          className="cw-wallet cw-wallet-compact"
                          disabled={busyId !== null}
                          aria-busy={busyId === w.id}
                          onClick={() => pick(w.id)}
                        >
                          <Badge name={w.name} />
                          <span className="cw-wallet-text">
                            <span className="cw-wallet-name">{w.name}</span>
                          </span>
                          <span className="cw-web-tag">{busyId === w.id ? 'Waiting…' : 'Web'}</span>
                        </button>
                      ) : (
                        <a
                          key={w.id}
                          className="cw-wallet cw-wallet-compact"
                          href={w.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Get ${w.name} (opens in a new tab)`}
                        >
                          <Badge name={w.name} />
                          <span className="cw-wallet-text">
                            <span className="cw-wallet-name">{w.name}</span>
                          </span>
                          <span className="cw-get-tag">Get ↗</span>
                        </a>
                      ),
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}

          <div className="cw-note">Strata never asks for your secret key or recovery phrase.</div>

          <details className="cw-collapse">
            <summary>New to Stellar wallets?</summary>
            <Explainer />
          </details>
        </div>
      </section>
    </div>
  )
}
