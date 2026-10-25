import { useCallback, useEffect, useMemo, useState } from 'react'
import { explorerTx } from './config'
import { MockOptionsClient } from './options/mockClient'
import type { OptionsClient } from './options/client'
import type { OptionOffer } from './options/types'
import { formatAmount, formatExpiry, shortAddress, strikePerUnit } from './options/format'
import { useFreighter } from './wallet/useFreighter'
import './App.css'

type Tab = 'market' | 'positions'
type Notice = { kind: 'ok'; text: string; hash: string; mock: boolean } | { kind: 'err'; text: string }

function OptionRow({
  o,
  action,
}: {
  o: OptionOffer
  action?: { label: string; onClick: () => void; disabled?: boolean }
}) {
  return (
    <tr>
      <td>
        <span className={`kind kind-${o.kind}`}>{o.kind.toUpperCase()}</span>
      </td>
      <td>
        {formatAmount(o.underlyingQty, o.underlying.decimals)} {o.underlying.code}
      </td>
      <td>
        {strikePerUnit(o)} {o.quote.code}
      </td>
      <td>
        {formatAmount(o.totalStrike, o.quote.decimals)} {o.quote.code}
      </td>
      <td>
        {formatAmount(o.totalPremium, o.quote.decimals)} {o.quote.code}
      </td>
      <td>{formatExpiry(o.expiry)}</td>
      <td className="mono">{shortAddress(o.writer)}</td>
      <td>
        <span className={`state state-${o.state}`}>{o.state}</span>
      </td>
      <td>
        {action && (
          <button type="button" onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </button>
        )}
      </td>
    </tr>
  )
}

function OptionsTable({ rows, actionFor }: { rows: OptionOffer[]; actionFor: (o: OptionOffer) => Parameters<typeof OptionRow>[0]['action'] }) {
  if (rows.length === 0) return <p className="empty">Nothing here yet.</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Underlying</th>
            <th>Strike / unit</th>
            <th>Total strike</th>
            <th>Premium</th>
            <th>Expiry</th>
            <th>Writer</th>
            <th>State</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <OptionRow key={o.id.toString()} o={o} action={actionFor(o)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const wallet = useFreighter()
  // Swap for the bindings-backed client once the contract is deployed.
  const client: OptionsClient = useMemo(() => new MockOptionsClient(), [])
  const [options, setOptions] = useState<OptionOffer[]>([])
  const [tab, setTab] = useState<Tab>('market')
  const [busyId, setBusyId] = useState<bigint | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const refresh = useCallback(async () => setOptions(await client.listOptions()), [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (id: bigint, label: string, fn: () => Promise<{ hash: string }>) => {
    setBusyId(id)
    setNotice(null)
    try {
      const { hash } = await fn()
      setNotice({ kind: 'ok', text: `${label} confirmed`, hash, mock: client.isMock })
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusyId(null)
      await refresh()
    }
  }

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
        <button type="button" className={tab === 'positions' ? 'tab active' : 'tab'} onClick={() => setTab('positions')}>
          My positions ({positions.length})
        </button>
      </nav>

      <main>
        {tab === 'market' && (
          <OptionsTable
            rows={market}
            actionFor={(o) => ({
              label: busyId === o.id ? 'Buying…' : 'Buy',
              disabled: !me || busy || o.writer === me,
              onClick: () => void run(o.id, 'Purchase', () => client.buy(o.id, me!)),
            })}
          />
        )}
        {tab === 'positions' &&
          (me ? (
            <OptionsTable
              rows={positions}
              actionFor={(o) => {
                if (o.holder === me && o.state === 'active')
                  return {
                    label: busyId === o.id ? 'Exercising…' : 'Exercise',
                    disabled: busy,
                    onClick: () => void run(o.id, 'Exercise', () => client.exercise(o.id, me)),
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
      </main>

      <footer>
        Physically settled, fully collateralized. Issuer controls (freeze, clawback) on regulated assets can block settlement. This is not a guarantee against issuer action.
      </footer>
    </div>
  )
}

export default App
