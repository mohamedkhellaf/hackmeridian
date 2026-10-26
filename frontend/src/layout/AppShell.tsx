import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Dialog, Icon, Mono, StatusDot } from '../ui'
import { shortAddress } from '../options/format'
import { hrefFor, NAV_TABS, NAV_TRADE, NAV_TRANSPARENCY } from './routes'
import type { NavItem, Route } from './routes'
import './layout.css'

export const DEMO_TEXT = 'Demo environment on Stellar Testnet. Assets and makers are fictional; no real funds are involved.'
export const MOCK_TEXT = 'Mock data: no contract connected.'

function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect x="3" y="4" width="20" height="4" rx="2" fill="#F2F4F7" />
      <rect x="3" y="11" width="15" height="4" rx="2" fill="#9DB1FF" />
      <rect x="3" y="18" width="10" height="4" rx="2" fill="#4E5A6E" />
    </svg>
  )
}

function NavLink({ item, current, badge }: { item: NavItem; current: Route; badge?: number }) {
  const on = item.route === current
  return (
    <a href={hrefFor(item.route)} className={on ? 'nav-link is-on' : 'nav-link'} aria-current={on ? 'page' : undefined}>
      <Icon name={item.icon} />
      {item.label}{" "}
      {badge ? (
        <span className="nav-badge" title="Actions waiting">
          {badge}
        </span>
      ) : null}
    </a>
  )
}

/**
 * Wallet chip: a Connect button when disconnected, otherwise a pill (green dot + short address) that opens the
 * wallet menu: wallet name, full address with copy, balances (real mode only), Refresh and Disconnect.
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
      <button type="button" className="wallet-pill" aria-label="Wallet menu" aria-haspopup="dialog" title={address} onClick={() => setOpen(true)}>
        <StatusDot tone="ok" />
        <Mono>
          {walletName && <span className="wallet-pill-name">{walletName} · </span>}
          {shortAddress(address)}
        </Mono>
        <Icon name="chevron" size={14} className="wallet-caret" />
      </button>
      {open && (
        <Dialog title="Wallet" width={400} onClose={() => setOpen(false)}>
          <div className="wm">
            <div className="wm-section">
              <span className="ui-label">Connected wallet</span>
              <span className="wm-name">
                <StatusDot tone="ok" />
                {walletName ?? 'Wallet'}
              </span>
              <div className="wm-addr">
                <Mono>{address}</Mono>
                <button type="button" className="wm-copy" onClick={copy} aria-label="Copy address">
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {balances && (
              <div className="wm-section">
                <span className="ui-label">Balances</span>
                {balances}
                {onRefresh && (
                  <Button variant="secondary" size="sm" onClick={onRefresh}>
                    <Icon name="refresh" size={14} /> Refresh
                  </Button>
                )}
              </div>
            )}
            <Button
              variant="danger"
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
  /** Count shown on the Portfolio link/tab: actions waiting for the connected wallet. */
  portfolioBadge?: number
  /** No contract configured: the in-memory mock client is in use. Shown in the banner and sidebar. */
  mock: boolean
  /** Options contract id (links to stellar.expert). */
  contractId?: string
  /** Token balances for the top bar. */
  balances?: ReactNode
  /** Wallet chip / connect button. */
  wallet: ReactNode
  /** Page content. */
  children: ReactNode
}

/**
 * Desktop: left sidebar + top bar + content. Phones (<= 768px): sidebar hidden, bottom tab bar
 * (Markets, Write, Portfolio, Reserves) and an Issuer shortcut in the top bar.
 */
export function AppShell({ route, portfolioBadge, mock, contractId, balances, wallet, children }: AppShellProps) {
  return (
    <div className="shell">
      <div className="demo-banner">
        <StatusDot tone="warn" />
        <span>{DEMO_TEXT}</span>
        {mock && <span className="demo-banner-mock">{MOCK_TEXT}</span>}
      </div>

      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <LogoMark />
            <span className="brand-name">Strata</span>
            <span className="net-pill">Testnet</span>
          </div>
          <nav className="sidebar-nav" aria-label="Main">
            <span className="ui-label nav-section">Trade</span>
            {NAV_TRADE.map((i) => (
              <NavLink key={i.route} item={i} current={route} badge={i.route === 'portfolio' ? portfolioBadge : undefined} />
            ))}
            <span className="ui-label nav-section nav-section--gap">Transparency</span>
            {NAV_TRANSPARENCY.map((i) => (
              <NavLink key={i.route} item={i} current={route} />
            ))}
          </nav>
          <div className="contract-card">
            <span className="ui-label">Options contract</span>
            {contractId ? (
              <>
                <Mono title={contractId}>{shortAddress(contractId)}</Mono>
                <a href={`https://stellar.expert/explorer/testnet/contract/${contractId}`} target="_blank" rel="noreferrer">
                  View on StellarExpert <Icon name="external" size={12} />
                </a>
              </>
            ) : (
              <span className="contract-mock">Mock mode — no contract</span>
            )}
          </div>
        </aside>

        <div className="shell-main">
          <header className="topbar">
            <a href={hrefFor('markets')} className="topbar-logo" aria-label="Strata home">
              <LogoMark size={22} />
              <span className="brand-name">Strata</span>
              <span className="net-pill">Testnet</span>
            </a>
            <div className="topbar-balances">{balances}</div>
            <a href={hrefFor('issuer')} className={route === 'issuer' ? 'topbar-issuer is-on' : 'topbar-issuer'} aria-label="Issuer console">
              <Icon name="issuer" size={18} />
            </a>
            <div className="topbar-wallet">{wallet}</div>
          </header>
          <main className="content">{children}</main>
          <footer className="shell-footer">
            Physically settled, fully collateralized. Issuer controls (freeze, clawback) on regulated assets can block settlement. This is not a guarantee
            against issuer action.
          </footer>
        </div>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV_TABS.map((i) => {
          const on = i.route === route
          return (
            <a key={i.route} href={hrefFor(i.route)} className={on ? 'tab is-on' : 'tab'} aria-current={on ? 'page' : undefined}>
              <span className="tab-icon">
                <Icon name={i.icon} size={20} strokeWidth={1.4} />
                {i.route === 'portfolio' && portfolioBadge ? (
                  <span className="nav-badge nav-badge--tab" title="Actions waiting">
                    {portfolioBadge}
                  </span>
                ) : null}
              </span>
              {i.label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
