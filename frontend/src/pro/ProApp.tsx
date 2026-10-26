import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { config } from '../config'
import { Banner, Button, Card, PageHeader, Segmented } from '../ui'
import { useFreighter } from '../wallet/useFreighter'
import { PRO_ONCHAIN, PRO_SIMULATED } from './copy'
import { FixtureProClient } from './FixtureProClient'
import { LiquidationsScreen } from './LiquidationsScreen'
import { MarginScreen } from './MarginScreen'
import { OracleStrip } from './OracleStrip'
import { PositionsScreen } from './PositionsScreen'
import { ProProvider } from './ProContext'
import { usePro } from './proCtx'
import { parseProRoute, PRO_NAV, proHref } from './proRoutes'
import type { ProRoute } from './proRoutes'
import { TradeScreen } from './TradeScreen'
import { VaultScreen } from './VaultScreen'
import { proErrorName } from './errors'
import { SorobanProClient } from './SorobanProClient'
import './pro.css'

function useProRoute(): ProRoute {
  const [route, setRoute] = useState<ProRoute>(() => parseProRoute(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseProRoute(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function Outcome() {
  const { outcome, clearOutcome } = usePro()
  if (!outcome) return null
  const head = outcome.ok ? outcome.text : `${outcome.label} refused${outcome.name ? `: ${outcome.name}${outcome.code ? ` (${outcome.code})` : ''}` : ''}. ${outcome.text}`
  return (
    <Banner tone={outcome.ok ? 'neutral' : 'danger'} className="pro-outcome">
      <span>
        {head}
        {/* The replayed step shows in the Simulation card; the note is kept only when nothing was replayed. */}
        {outcome.note && !outcome.ok && outcome.code == null && <span className="pro-muted"> {outcome.note}</span>}
      </span>
      <Button variant="ghost" size="sm" onClick={clearOutcome}>
        Dismiss
      </Button>
    </Banner>
  )
}

/** Scenario, step, acting account and the recent steps. Shown only while running on fixtures. */
function SimControls() {
  const { sim, model, me, setMe } = usePro()
  if (!sim) return null
  const last = model.history.slice(-6).reverse()
  return (
    <Card title="Simulation">
      <div className="pro-sim-grid">
        <label className="pro-field">
          <span className="pro-label">Scenario</span>
          <span className="pro-input">
            <select value={sim.scenarioName} onChange={(e) => sim.setScenario(e.target.value)} aria-label="Scenario">
              {sim.scenarioNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="pro-field">
          <span className="pro-label">
            Step {sim.position} of {sim.stepCount}
          </span>
          <input type="range" min={0} max={sim.stepCount} value={sim.position} onChange={(e) => sim.moveTo(Number(e.target.value))} aria-label="Simulation step" />
        </label>
        <label className="pro-field">
          <span className="pro-label">Acting as</span>
          <span className="pro-input">
            <select value={me} onChange={(e) => setMe(e.target.value)} aria-label="Acting as">
              {sim.parties.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </span>
        </label>
        <div className="pro-actions">
          <Button size="sm" variant="secondary" disabled={sim.position === 0} onClick={() => sim.moveTo(sim.position - 1)}>
            Back
          </Button>
          <Button size="sm" variant="secondary" disabled={sim.position >= sim.stepCount} onClick={() => sim.moveTo(sim.position + 1)}>
            Next
          </Button>
        </div>
      </div>
      <div className="ui-table-wrap pro-log">
        <table className="ui-table" aria-label="Recent steps">
          <thead>
            <tr>
              <th className="num">Step</th>
              <th>Call</th>
              <th>Account</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {last.length === 0 && (
              <tr>
                <td colSpan={4}>No step applied yet.</td>
              </tr>
            )}
            {last.map((h) => (
              <tr key={h.index}>
                <td className="num">{h.index + 1}</td>
                <td>{h.op}</td>
                <td>{h.actor ?? ''}</td>
                <td className={h.ok ? undefined : 'pro-warn'}>{h.ok ? 'Ok' : `${proErrorName(h.code ?? 0)} (${h.code})`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Screen({ route }: { route: ProRoute }) {
  switch (route) {
    case 'trade':
      return <TradeScreen />
    case 'positions':
      return <PositionsScreen />
    case 'liquidations':
      return <LiquidationsScreen />
    case 'vault':
      return <VaultScreen />
    default:
      return <MarginScreen />
  }
}

/** Load failures and the wallet prompt, shown only against the live contract. */
function LiveStatus({ client, connected }: { client: SorobanProClient; connected: boolean }) {
  const status = useSyncExternalStore(client.subscribe.bind(client), () => client.getStatus())
  return (
    <>
      {status.error && <Banner tone="danger">Reading the Pro contract failed: {status.error}</Banner>}
      {!connected && <Banner tone="neutral">Connect a wallet to deposit, trade or claim.</Banner>}
    </>
  )
}

/**
 * Strata Pro inside the main AppShell at `#/pro/...`. One disclosure banner, sub-navigation as a segmented control.
 * Runs on the live contract when the build sets VITE_PRO_CONTRACT_ID, otherwise on fixtures.
 */
export default function ProApp() {
  const route = useProRoute()
  const wallet = useFreighter()
  // Built once; the wallet is handed over on every change (the client reads it at call time).
  const [live] = useState(() => (config.proContractId ? new SorobanProClient(config.proContractId) : null))
  const { address, sign, signAuthEntry } = wallet
  useEffect(() => {
    if (!live) return
    live.setWallet({ address, sign, signAuthEntry })
    void live.refresh()
  }, [live, address, sign, signAuthEntry])
  const sim = useMemo(() => (live ? null : new FixtureProClient()), [live])
  useEffect(() => live?.start(), [live])
  const client = live ?? sim!
  const me = live ? (address ?? '') : 'MAKER_A'
  const title = PRO_NAV.find((n) => n.route === route)?.label ?? 'Pro'
  return (
    <ProProvider key={me} client={client} sim={sim} defaultMe={me}>
      <div className="pro">
        <Banner tone="warn">{live ? PRO_ONCHAIN : PRO_SIMULATED}</Banner>
        {live && <LiveStatus client={live} connected={!!address} />}
        <PageHeader
          title={title}
          actions={
            <div className="pro-subnav">
              <Segmented
                label="Pro"
                options={PRO_NAV.map((n) => ({ value: n.route, label: n.label }))}
                value={route}
                onChange={(r) => {
                  window.location.hash = proHref(r)
                }}
              />
            </div>
          }
        />
        <OracleStrip />
        <Outcome />
        <div className="pro-screen">
          <Screen route={route} />
        </div>
        <SimControls />
      </div>
    </ProProvider>
  )
}
