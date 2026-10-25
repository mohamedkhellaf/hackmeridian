import { useCallback, useEffect, useMemo, useState } from 'react'
import { IssuerConsole } from './issuer/IssuerConsole'
import { createOptionsClient } from './options'
import { config, explorerTx } from './config'
import { CollateralPanel } from './maker/CollateralPanel'
import { WriteOfferForm } from './maker/WriteOfferForm'
import { MockOptionsClient } from './options/mockClient'
import type { OptionsClient } from './options/client'
import type { CollateralHealth, CollateralLine, NewOffer, OptionOffer, SupportedAssets } from './options/types'
import { shortAddress } from './options/format'
import { OptionsTable } from './market/OptionsTable'
import { MarketSeries } from './market/MarketSeries'
import { BuyDialog } from './market/BuyDialog'
import { useFreighter } from './wallet/useFreighter'
import { useBalances } from './wallet/useBalances'
import { BalancesBar } from './wallet/BalancesBar'
import './App.css'

type Tab = 'market' | 'write' | 'positions' | 'issuer'
type Notice = { kind: 'ok'; text: string; hash: string; mock: boolean } | { kind: 'err'; text: string }

const LEGEND: [string, string][] = [
  ['offered', 'listed, collateral locked, no buyer yet'],
  ['active', 'sold; the holder can exercise until expiry'],
  ['exercised', 'awaiting writer claim: proceeds wait in the contract'],
  ['settled', 'writer claimed the proceeds; done'],
  ['expired', 'collateral reclaimable by the writer'],
  ['reclaimed', 'writer took the collateral back'],
  ['cancelled', 'offer withdrawn before any buyer'],
]

function StateLegend() {
  return (
    <ul className="legend">
      {LEGEND.map(([s, d]) => (
        <li key={s}>
          <span className={`state state-${s}`}>{s}</span> {d}
        </li>
      ))}
    </ul>
  )
}

function App() {
  const wallet = useFreighter()
  // One mock for the whole session (recreating it would wipe the demo state). The Soroban client
  // captures the signer, so it is rebuilt when the wallet address or signers change.
  const [mock] = useState(() => (config.optionsContractId ? null : new MockOptionsClient()))
  const { address: walletAddress, sign: walletSign, signAuthEntry: walletSignAuth } = wallet
  const client: OptionsClient = useMemo(
    () => mock ?? createOptionsClient({ address: walletAddress, sign: walletSign, signAuthEntry: walletSignAuth }),
    [mock, walletAddress, walletSign, walletSignAuth],
  )
  const [options, setOptions] = useState<OptionOffer[]>([])
  const [assets, setAssets] = useState<SupportedAssets | null>(null)
  const [collateral, setCollateral] = useState<CollateralLine[]>([])
  const [health, setHealth] = useState<CollateralHealth[]>([])
  const [tab, setTab] = useState<Tab>('market')
  const [busyId, setBusyId] = useState<bigint | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [buying, setBuying] = useState<OptionOffer | null>(null)

  const balanceTokens = useMemo(() => (assets ? [assets.quote, ...assets.underlyings] : []), [assets])
  const balances = useBalances(wallet.address, balanceTokens)
  const refreshBalances = balances.refresh

  const refresh = useCallback(async () => {
    const [opts, assets, lines, hl] = await Promise.all([
      client.listOptions(),
      client.supportedAssets(),
      client.openCollateral(),
      client.collateralHealth().catch(() => [] as CollateralHealth[]),
    ])
    setOptions(opts)
    setAssets(assets)
    setCollateral(lines)
    setHealth(hl)
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Returns whether the transaction went through.
  const run = async (id: bigint, label: string, fn: () => Promise<{ hash: string }>) => {
    setBusyId(id)
    setNotice(null)
    let ok = false
    try {
      const { hash } = await fn()
      ok = true
      setNotice({ kind: 'ok', text: `${label} confirmed`, hash, mock: client.isMock })
      return true
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
      return false
    } finally {
      setBusyId(null)
      await refresh()
      if (ok) void refreshBalances()
    }
  }

  const writeOffer = (offer: NewOffer) => run(-1n, 'Offer published', () => client.createOffer(offer, me!))

  const me = wallet.address
  const market = options.filter((o) => o.state === 'offered')
  const positions = options.filter((o) => me && (o.holder === me || o.writer === me))
  const busy = busyId !== null

  return (
    <div className="app">
      <header>
        <div className="brand">
          <strong>Strata</strong>
          <span>Collateralized options on tokenized assets · Testnet</span>
        </div>
        {me ? (
          <div className="wallet">
            <span className="mono">{shortAddress(me)}</span>
            <button type="button" className="secondary" onClick={wallet.disconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => void wallet.connect()}>
            Connect Freighter
          </button>
        )}
      </header>

      {me && assets && (
        <BalancesBar
          tokens={balanceTokens.map((t) => ({ contractId: t.contractId, code: t.code, decimals: t.decimals }))}
          balances={balances.balances}
          loading={balances.loading}
          onRefresh={() => void refreshBalances()}
        />
      )}

      <details className="how">
        <summary>How it works</summary>
        <ol>
          <li>The maker locks collateral in the contract and publishes an offer.</li>
          <li>A buyer pays the premium to the maker and holds the option.</li>
          <li>The holder exercises before expiry: atomic delivery-versus-payment, all or nothing.</li>
        </ol>
      </details>

      {client.isMock && <div className="banner warn">Mock data: no contract connected. Assets, makers and transactions are fictional.</div>}
      {wallet.wrongNetwork && <div className="banner err">Freighter is not on Testnet. Switch network in the extension.</div>}
      {wallet.error && <div className="banner err">{wallet.error}</div>}
      {notice?.kind === 'ok' && (
        <div className="banner ok">
          {notice.text} · tx{' '}
          {notice.mock ? (
            <span className="mono">{notice.hash.slice(0, 12)}… (mock)</span>
          ) : (
            <a className="mono" href={explorerTx(notice.hash)} target="_blank" rel="noreferrer">
              {notice.hash.slice(0, 12)}…
            </a>
          )}
        </div>
      )}
      {notice?.kind === 'err' && <div className="banner err">{notice.text}</div>}

      <nav>
        <button type="button" className={tab === 'market' ? 'tab active' : 'tab'} onClick={() => setTab('market')}>
          Market ({market.length})
        </button>
        <button type="button" className={tab === 'write' ? 'tab active' : 'tab'} onClick={() => setTab('write')}>
          Write
        </button>
        <button type="button" className={tab === 'positions' ? 'tab active' : 'tab'} onClick={() => setTab('positions')}>
          My positions ({positions.length})
        </button>
        <button type="button" className={tab === 'issuer' ? 'tab active' : 'tab'} onClick={() => setTab('issuer')}>
          Issuer
        </button>
      </nav>

      <main>
        {tab === 'market' && (
          <MarketSeries offers={market} me={me ?? null} busy={busy} busyId={busyId} onBuy={setBuying} />
        )}
        {tab === 'write' && (
          <div className="write-grid">
            {assets && <WriteOfferForm assets={assets} client={client} me={me ?? null} disabled={!me || busy} onSubmit={writeOffer} />}
            <CollateralPanel lines={collateral} health={health} contractId={config.optionsContractId} />
            {!me && <p className="empty">Connect Freighter to write an option.</p>}
          </div>
        )}
        {tab === 'positions' &&
          (me ? (
            <OptionsTable
              rows={positions}
              actionFor={(o) => {
                if (o.holder === me && o.state === 'active' && Date.now() / 1000 < o.expiry)
                  return {
                    label: busyId === o.id ? 'Exercising…' : 'Exercise',
                    disabled: busy,
                    onClick: () => void run(o.id, 'Exercise', () => client.exercise(o.id, me)),
                  }
                if (o.writer === me && o.state === 'exercised')
                  return {
                    label: busyId === o.id ? 'Claiming…' : 'Claim delivery',
                    disabled: busy,
                    onClick: () => void run(o.id, 'Claim delivery', () => client.claimDelivery(o.id, me)),
                  }
                if (o.writer === me && o.state === 'expired')
                  return {
                    label: busyId === o.id ? 'Reclaiming…' : 'Reclaim collateral',
                    disabled: busy,
                    onClick: () => void run(o.id, 'Reclaim', () => client.reclaim(o.id, me)),
                  }
                if (o.writer === me && o.state === 'offered')
                  return {
                    label: busyId === o.id ? 'Cancelling…' : 'Cancel',
                    disabled: busy,
                    onClick: () => void run(o.id, 'Cancel', () => client.cancelOffer(o.id, me)),
                  }
                return undefined
              }}
            />
          ) : (
            <p className="empty">Connect Freighter to see your positions.</p>
          ))}
        {tab === 'positions' && me && <StateLegend />}
        {tab === 'issuer' && <IssuerConsole address={wallet.address} sign={wallet.sign} optionsContractId={config.optionsContractId} />}
      </main>

      {buying && me && (
        <BuyDialog
          offer={buying}
          client={client}
          me={me}
          onCancel={() => setBuying(null)}
          onConfirm={() => {
            const o = buying
            setBuying(null)
            void run(o.id, 'Purchase', () => client.buy(o.id, me))
          }}
        />
      )}

      <footer>
        Physically settled, fully collateralized. Issuer controls (freeze, clawback) on regulated assets can block settlement. This is not a guarantee against issuer action.
      </footer>
    </div>
  )
}

export default App
