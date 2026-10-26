import { useEffect, useMemo, useState } from 'react'
import { Banner, Button, Card, Tag } from '../ui'
import { PRO_BANNER_PUBLISHER, PRO_BANNER_TESTNET, PRO_SIMULATED } from './copy'
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

function Banners({ simulated }: { simulated: boolean }) {
  return (
    <div className="pro-banners" role="note" aria-label="Strata Pro notices">
      {simulated && <span className="pro-sim">{PRO_SIMULATED}</span>}
      <span>{PRO_BANNER_TESTNET}</span>
      <span className="pro-banner-sub">{PRO_BANNER_PUBLISHER}</span>
    </div>
  )
}

function Outcome() {
  const { outcome, clearOutcome } = usePro()
  if (!outcome) return null
  return (
    <Banner tone={outcome.ok ? 'ok' : 'danger'} title={outcome.ok ? `${outcome.label}: done` : `${outcome.label}: refused${outcome.name ? ` (${outcome.name}${outcome.code ? `, ${outcome.code}` : ''})` : ''}`}>
      <span>{outcome.text}</span>
      {outcome.note && <span className="pro-note"> {outcome.note}</span>}{' '}
      <button type="button" className="pro-link" onClick={clearOutcome}>
        Dismiss
      </button>
    </Banner>
  )
}

/** Simulation controls: scenario, step, acting account and the log. Shown only while running on fixtures. */
function SimControls() {
  const { sim, model, me, setMe } = usePro()
  if (!sim) return null
  const last = model.history.slice(-6).reverse()
  return (
    <Card title="Simulation controls" subtitle="Fixture replay of packages/risk/fixtures/pro_v0.json. Nothing here is on-chain.">
      <div className="pro-sim-grid">
        <label className="pro-field">
          <span className="ui-label">Scenario</span>
          <select className="pro-input" value={sim.scenarioName} onChange={(e) => sim.setScenario(e.target.value)} aria-label="Scenario">
            {sim.scenarioNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="pro-field">
          <span className="ui-label">
            Step {sim.position} of {sim.stepCount}
          </span>
          <input type="range" min={0} max={sim.stepCount} value={sim.position} onChange={(e) => sim.moveTo(Number(e.target.value))} aria-label="Simulation step" />
        </label>
        <label className="pro-field">
          <span className="ui-label">Acting as</span>
          <select className="pro-input" value={me} onChange={(e) => setMe(e.target.value)} aria-label="Acting as">
            {sim.parties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="pro-field">
          <span className="ui-label">Step</span>
          <div className="pro-actions">
            <Button size="sm" variant="secondary" disabled={sim.position === 0} onClick={() => sim.moveTo(sim.position - 1)}>
              Back
            </Button>
            <Button size="sm" variant="secondary" disabled={sim.position >= sim.stepCount} onClick={() => sim.moveTo(sim.position + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
      <ul className="pro-log" aria-label="Recent steps">
        {last.length === 0 && <li>No step applied yet.</li>}
        {last.map((h) => (
          <li key={h.index}>
            <span className="pro-num">#{h.index + 1}</span> {h.op}
            {h.actor ? ` · ${h.actor}` : ''} {h.ok ? <Tag tone="ok">ok</Tag> : <Tag tone="warn">{`${proErrorName(h.code ?? 0)} ${h.code}`}</Tag>}
          </li>
        ))}
      </ul>
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

export default function ProApp() {
  const route = useProRoute()
  const sim = useMemo(() => new FixtureProClient(), [])
  return (
    <ProProvider client={sim} sim={sim} defaultMe="MAKER_A">
      <div className="pro">
        <Banners simulated />
        <div className="pro-head">
          <span className="pro-badge">PRO · experimental</span>
          <nav className="pro-nav" aria-label="Pro">
            {PRO_NAV.map((n) => (
              <a key={n.route} href={proHref(n.route)} className={n.route === route ? 'is-on' : undefined} aria-current={n.route === route ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <OracleStrip />
        <Outcome />
        <div className="pro-screen">
          <Screen route={route} />
        </div>
        <SimControls />
        <p className="pro-footnote">
          Strata Pro is experimental and partially collateralized: payouts are paid from the writer's margin, then the vault, and can be reduced. Roles: the admin lists series; the publisher posts prices and the
          settlement price and decides every liquidation, early exercise and payout. Parameters are illustrative.
        </p>
      </div>
    </ProProvider>
  )
}
