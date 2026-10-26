import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Dialog, Mono } from '../ui'
import { shortAddress } from '../options/format'
import { hrefFor, NAV } from './routes'
import type { NavItem, Route } from './routes'
import type { NetworkStatus } from './useNetworkStatus'
import './layout.css'

export const DEMO_TEXT = 'Stellar Testnet. Fictional assets and makers. No real funds.'
export const MOCK_TEXT = 'Mock data, not read from a chain.'

function NavLinks({ current, badge, className }: { current: Route; badge?: number; className: string }) {
  return NAV.map((item: NavItem) => {
    const on = item.route === current
    const count = item.route === 'portfolio' && badge ? badge : 0
    return (
      <a key={item.route} href={hrefFor(item.route)} className={on ? `${className} is-on` : className} aria-current={on ? 'page' : undefined}>
        {item.label}
        {count ? (
          <>
            {' '}
            <span className="nav-count" title="Actions waiting">
              {count}
            </span>
          </>
        ) : null}
      </a>
    )
  })
}

/**
 * Wallet control: `Connect wallet` when disconnected, otherwise the short address. It opens the wallet menu:
 * wallet name, full address with copy, balances (real mode only), Refresh and Disconnect.
 */
export function WalletChip({
  address,
  walletName,
  onConnect,
  onDisconnect,
  balances,
  onRefresh,
}: {
  address: string | null
  walletName?: string | null
  onConnect: () => void
  onDisconnect: () => void
  /** Balances list for the menu; omit in mock mode. */
  balances?: ReactNode
  onRefresh?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!address) {
    return (
      <Button variant="primary" onClick={onConnect}>
        Connect wallet
      </Button>
    )
  }
  const copy = () => {
    void navigator.clipboard?.writeText(address).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => undefined,
    )
  }
  return (
    <>
      <button type="button" className="wallet-btn" aria-label="Wallet menu" aria-haspopup="dialog" title={address} onClick={() => setOpen(true)}>
        <Mono>{shortAddress(address)}</Mono>
      </button>
      {open && (
        <Dialog title="Wallet" width={420} onClose={() => setOpen(false)}>
          <dl className="ui-kv">
            <div>
              <dt>Wallet</dt>
              <dd>{walletName ?? 'Connected'}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd className="wm-addr">
                <Mono>{address}</Mono>
                <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy address">
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </dd>
            </div>
          </dl>
          {balances && (
            <div className="wm-balances">
              <h3>Balances</h3>
              {balances}
            </div>
          )}
          <div className="wm-actions">
            {onRefresh && (
              <Button variant="secondary" size="sm" onClick={onRefresh}>
                Refresh
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setOpen(false)
                onDisconnect()
              }}
            >
              Disconnect
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

export interface AppShellProps {
  route: Route
  /** Count shown after the Positions link: actions waiting for the connected wallet. */
  portfolioBadge?: number
  /** Options contract id. Shown once in the footer, linked to stellar.expert. Unset means mock data. */
  contractId?: string
  /** Real mode only: latest ledger and RPC reachability, appended to the footer. */
  network?: NetworkStatus | null
  /** Wallet control (WalletChip). */
  wallet: ReactNode
  /** Page content. */
  children: ReactNode
}

/** Desktop: sidebar, top bar with the wallet control, content, footer. Phones (<= 768px): compact top bar and a bottom tab bar. */
export function AppShell({ route, portfolioBadge, contractId, network, wallet, children }: AppShellProps) {
  const tabbarRef = useRef<HTMLElement>(null)
  // When the tab bar scrolls (narrow phones), keep the current tab in view.
  useEffect(() => {
    tabbarRef.current?.querySelector<HTMLElement>('.tab.is-on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [route])
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <a href={hrefFor('markets')} className="brand">
            Strata
          </a>
          <nav className="sidebar-nav" aria-label="Main">
            <NavLinks current={route} badge={portfolioBadge} className="nav-link" />
          </nav>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <a href={hrefFor('markets')} className="brand topbar-brand">
            Strata
          </a>
          <div className="topbar-wallet">{wallet}</div>
        </header>
        <main className="content">{children}</main>
        <footer className="shell-footer">
          <span>
            {DEMO_TEXT}{' '}
            {contractId ? (
              <>
                Contract{' '}
                <a className="ui-mono" href={`https://stellar.expert/explorer/testnet/contract/${contractId}`} target="_blank" rel="noreferrer" title={contractId}>
                  {shortAddress(contractId)}
                </a>
                {network?.rpc === 'degraded' && <span className="footer-warn"> RPC not responding.</span>}
              </>
            ) : (
              MOCK_TEXT
            )}
          </span>
          {contractId && network?.ledger != null && <span className="ui-mono footer-ledger">Ledger {network.ledger.toLocaleString('en-US')}</span>}
        </footer>
      </div>

      <nav className="tabbar" aria-label="Main" ref={tabbarRef}>
        <NavLinks current={route} badge={portfolioBadge} className="tab" />
      </nav>
    </div>
  )
}
