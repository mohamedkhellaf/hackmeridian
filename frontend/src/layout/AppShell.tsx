import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Dialog, Icon, Mono, StatusDot } from '../ui'
import { shortAddress } from '../options/format'
import { hrefFor, NAV_TABS, NAV_TRADE, NAV_TRANSPARENCY, PRO_ENABLED } from './routes'
import type { NavItem, Route } from './routes'
import type { NetworkStatus } from './useNetworkStatus'
import './layout.css'

export const DEMO_TEXT = 'Demo environment on Stellar Testnet. Assets and makers are fictional; no real funds are involved.'
export const MOCK_TEXT = 'Mock data: no contract connected.'

function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect x="2.4" y="3.5" width="21.2" height="4.2" rx="1.2" fill="#ECE9E2" />
      <rect x="2.4" y="11.2" width="15.4" height="4.2" rx="1.2" fill="#D9A05B" />
      <rect x="2.4" y="18.9" width="9.5" height="4.2" rx="1.2" fill="#55585F" />
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

/** Slim status bar at the foot of the main column (desktop only; hidden on phones to keep the tab bar clear). */
export function StatusBar({ mock, contractId, network }: { mock: boolean; contractId?: string; network?: NetworkStatus | null }) {
  if (mock || !contractId) {
    return (
      <div className="statusbar" role="contentinfo" aria-label="Network status">
        <StatusDot tone="warn" />
        <span>Mock mode · no contract</span>
      </div>
    )
  }
  const rpc = network?.rpc ?? 'unknown'
  return (
    <div className="statusbar" role="contentinfo" aria-label="Network status">
      <span>Stellar Testnet</span>
      <span aria-hidden="true">·</span>
      <span>ledger {network?.ledger != null ? network.ledger.toLocaleString('en-US') : '…'}</span>
      <span aria-hidden="true">·</span>
      <span className="statusbar-rpc">
        <StatusDot tone={rpc === 'ok' ? 'ok' : rpc === 'degraded' ? 'warn' : 'neutral'} />
        RPC {rpc === 'ok' ? 'ok' : rpc === 'degraded' ? 'degraded' : 'checking'}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        contract <Mono title={contractId}>{shortAddress(contractId)}</Mono>
      </span>
    </div>
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
  /**
   * Real mode only: latest backing read, for "Backing verified · ledger N" in the contract card.
   * `ok` = held covers reserved for every token. Omit (null) when unknown or in mock mode.
   */
  backing?: { ok: boolean; ledger: number | null } | null
  /** Real mode only: RPC reachability and latest ledger for the status bar. */
  network?: NetworkStatus | null
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
export function AppShell({ route, portfolioBadge, mock, contractId, backing, network, balances, wallet, children }: AppShellProps) {
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
            {PRO_ENABLED && <NavLink item={{ route: 'pro', label: 'Pro (experimental)', icon: 'markets' }} current={route} />}
          </nav>
          <div className="contract-card">
            <span className="ui-label">Options contract</span>
            {contractId ? (
              <>
                <Mono title={contractId}>{shortAddress(contractId)}</Mono>
                {backing && (
                  <span className={backing.ok ? 'contract-backing' : 'contract-backing contract-backing--bad'}>
                    <StatusDot tone={backing.ok ? 'ok' : 'danger'} />
                    <span>
                      {backing.ok ? 'Backing verified' : 'Backing shortfall'}
                      {backing.ledger != null && ` · ledger ${backing.ledger.toLocaleString('en-US')}`}
                    </span>
                  </span>
                )}
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
            {PRO_ENABLED && (
              <a href={hrefFor('pro')} className={route === 'pro' ? 'topbar-issuer is-on' : 'topbar-issuer'} aria-label="Pro (experimental)">
                Pro
              </a>
            )}
            <a href={hrefFor('issuer')} className={route === 'issuer' ? 'topbar-issuer is-on' : 'topbar-issuer'} aria-label="Issuer console">
              <Icon name="issuer" size={18} />
            </a>
            <div className="topbar-wallet">{wallet}</div>
          </header>
          <main className="content">{children}</main>
          {route !== 'pro' && (
            <footer className="shell-footer">
              Physically settled, fully collateralized. Issuer controls (freeze, clawback) on regulated assets can block settlement. This is not a guarantee
              against issuer action.
            </footer>
          )}
          <StatusBar mock={mock} contractId={contractId} network={network} />
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
