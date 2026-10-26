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

/** Routes that get a tab on phones. The rest open from More. */
const TAB_ROUTES: Route[] = ['markets', 'protect', 'portfolio', 'reserves']

function NavLink({ item, current, badge, className, onClick }: { item: NavItem; current: Route; badge?: number; className: string; onClick?: () => void }) {
  const on = item.route === current
  const count = item.route === 'portfolio' && badge ? badge : 0
  return (
    <a href={hrefFor(item.route)} className={on ? `${className} is-on` : className} aria-current={on ? 'page' : undefined} onClick={onClick}>
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
      <Button variant="primary" onClick={onConnect} title="Connect a Stellar wallet (Freighter)">
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

/** Desktop: top bar (wordmark, nav, wallet), content, footer. Phones (<= 768px): wordmark and wallet on top, four tabs and More at the bottom. */
export function AppShell({ route, portfolioBadge, contractId, network, wallet, children }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const tabbarRef = useRef<HTMLElement>(null)
  useEffect(() => {
    tabbarRef.current?.querySelector<HTMLElement>('.is-on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [route])
  const tabItems = NAV.filter((n) => TAB_ROUTES.includes(n.route))
  const moreItems = NAV.filter((n) => !TAB_ROUTES.includes(n.route))
  const moreOn = moreItems.some((n) => n.route === route)
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a href={hrefFor('markets')} className="brand">
            Strata
          </a>
          <nav className="topnav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.route} item={item} current={route} badge={portfolioBadge} className="nav-link" />
            ))}
          </nav>
          <div className="topbar-wallet">{wallet}</div>
        </div>
      </header>
      <main className="content">{children}</main>
      <footer className="shell-footer">
        <div className="shell-footer-inner">
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
        </div>
      </footer>

      <nav className="tabbar" aria-label="Main" ref={tabbarRef}>
        {tabItems.map((item) => (
          <NavLink key={item.route} item={item} current={route} badge={portfolioBadge} className="tab" />
        ))}
        <button type="button" className={moreOn ? 'tab is-on' : 'tab'} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          More
        </button>
      </nav>

      {moreOpen && (
        <Dialog title="More" width={360} onClose={() => setMoreOpen(false)}>
          <nav className="more-nav" aria-label="More pages">
            {moreItems.map((item) => (
              <NavLink key={item.route} item={item} current={route} className="more-link" onClick={() => setMoreOpen(false)} />
            ))}
          </nav>
        </Dialog>
      )}
    </div>
  )
}
