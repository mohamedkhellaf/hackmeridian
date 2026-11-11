import { Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { useCallback, useState, useSyncExternalStore } from 'react'
import { marginBanner } from '../../core/disclosures'
import { formatUtc } from '../../core/format'
import { hasMarginAck, setMarginAck } from '../../core/market/marginAck'
import { isProSimulated } from '../../core/pro/createClient'
import type { SorobanProClient } from '../../core/pro/SorobanProClient'
import { ProLoader, usePro } from '../../data'
import { Button, Callout, EmptyNote, Link, NavTab, NavTabs, PageHeader, Skeleton } from '../../ui'
import { CONNECT_TO_ACT, SCREENS, SCREEN_ORDER, SCREEN_PATH, PAYOUT_RISK_LINE } from './copy'
import { partyName, scenarioCopy } from './model/names'
import { EntryWarning } from './parts/EntryWarning'
import { useMarginUi } from './parts/marginUi'
import { MarginUiProvider } from './parts/MarginUiProvider'
import { OracleStrip } from './parts/OracleStrip'
import { OutcomeRegion } from './parts/OutcomeRegion'
import { ReplayCard } from './parts/ReplayCard'
import type { MarginScreen } from './screen'
import { AccountScreen } from './screens/AccountScreen'
import { LiquidationsScreen } from './screens/LiquidationsScreen'
import { PositionsScreen } from './screens/PositionsScreen'
import { TradeScreen } from './screens/TradeScreen'
import { VaultScreen } from './screens/VaultScreen'
import css from './MarginPage.module.css'

function Screen({ screen }: { screen: MarginScreen }) {
  switch (screen) {
    case 'trade':
      return <TradeScreen />
    case 'positions':
      return <PositionsScreen />
    case 'liquidations':
      return <LiquidationsScreen />
    case 'vault':
      return <VaultScreen />
    default:
      return <AccountScreen />
  }
}

/** The one disclosure banner of the section, verbatim from core/disclosures, on every Margin screen. */
function Banner() {
  const simulated = isProSimulated()
  return (
    <Callout variant="warning" label="Notice">
      <p>{marginBanner(simulated)}</p>
      {simulated ? <p>{PAYOUT_RISK_LINE}</p> : null}
    </Callout>
  )
}

function SubNav({ screen }: { screen: MarginScreen }) {
  return (
    <NavTabs label="Margin sections">
      {SCREEN_ORDER.map((s) => (
        <NavTab key={s} current={s === screen} render={<RouterLink to={SCREEN_PATH[s]} activeOptions={{ exact: true }} />}>
          {SCREENS[s].nav}
        </NavTab>
      ))}
    </NavTabs>
  )
}

/** Fixture builds: which scenario, which step, and as whom, in one line under the navigation. */
function ReplayLine() {
  const { sim, me } = usePro()
  if (!sim) return null
  return (
    <p className={css.replayLine}>
      Replaying <span className={css.strong}>{scenarioCopy(sim.scenarioName).title}</span>, step {sim.position} of {sim.stepCount}. You act as <span className={css.strong}>{partyName(me)}</span>.{' '}
      <Link href="#replay">Change scenario, step or account</Link>
    </p>
  )
}

const NO_SUBSCRIPTION = () => {}

/** Testnet-contract builds: the read status of the live client (first read, last failure). Null on fixtures. */
function useLiveStatus(live: SorobanProClient | null) {
  const subscribe = useCallback((listener: () => void) => (live ? live.subscribe(listener) : NO_SUBSCRIPTION), [live])
  const read = useCallback(() => (live ? live.getStatus() : null), [live])
  return useSyncExternalStore(subscribe, read, read)
}

function Loading() {
  return (
    <div className={css.loading} aria-busy="true">
      <span className="ui-vh">Loading the margin section</span>
      <Skeleton variant="block" height="4rem" />
      <Skeleton variant="rows" lines={6} />
    </div>
  )
}

function Body({ screen }: { screen: MarginScreen }) {
  const { live, simulated, me } = usePro()
  const { connect } = useMarginUi()
  const status = useLiveStatus(live)
  const firstRead = status !== null && status.updatedAt === null

  if (firstRead && status.error) {
    return (
      <Callout variant="danger" label="Not loaded" title="Reading the margin contract failed." actions={<Button onClick={() => void live?.refresh()}>Try again</Button>}>
        <p>{status.error}</p>
        <p>Nothing was sent. The figures of this section could not be read from Testnet.</p>
      </Callout>
    )
  }
  if (firstRead) return <Loading />

  return (
    <>
      {status?.error ? (
        <Callout variant="warning" label="Not refreshed" title="The last read of the margin contract failed." actions={<Button size="sm" onClick={() => void live?.refresh()}>Read again</Button>}>
          <p>
            {status.error} The figures below are from {status.updatedAt !== null ? formatUtc(status.updatedAt) : 'an earlier read'}.
          </p>
        </Callout>
      ) : null}
      {!simulated && me === '' && screen !== 'account' ? (
        <Callout
          variant="info"
          title={CONNECT_TO_ACT}
          actions={
            <Button size="sm" onClick={connect}>
              Connect wallet
            </Button>
          }
        />
      ) : null}
      <ReplayLine />
      <OracleStrip />
      <OutcomeRegion />
      <Screen screen={screen} />
      <ReplayCard />
    </>
  )
}

/**
 * The Margin section (experimental): partial margin, cash-settled uncovered calls, kept apart from the
 * Covered product. One component for the five routes, so the warning, the replay and the acting account
 * survive a change of screen. Fixtures while the build has no Margin contract id, the Testnet contract otherwise.
 */
export function MarginPage({ screen }: { screen: MarginScreen }) {
  const navigate = useNavigate()
  // Asked once per browser tab, whichever screen the user lands on.
  const [acknowledged, setAcknowledged] = useState(hasMarginAck)
  const copy = SCREENS[screen]

  return (
    <div className={css.page}>
      <Banner />
      <PageHeader title={copy.title} description={copy.description} />
      <SubNav screen={screen} />
      <ProLoader
        loading={<Loading />}
        error={(_message, retry) => (
          <EmptyNote
            title="The margin section could not be loaded."
            hint={isProSimulated() ? 'The recorded scenarios did not arrive. Check the connection, then try again.' : 'The contract client did not arrive. Check the connection, then try again. Nothing was sent.'}
            action={
              <Button variant="primary" onClick={retry}>
                Try again
              </Button>
            }
          />
        )}
      >
        <MarginUiProvider>
          <Body screen={screen} />
        </MarginUiProvider>
      </ProLoader>
      <EntryWarning
        open={!acknowledged}
        onContinue={() => {
          setMarginAck()
          setAcknowledged(true)
        }}
        onCancel={() => void navigate({ to: '/markets' })}
      />
    </div>
  )
}
