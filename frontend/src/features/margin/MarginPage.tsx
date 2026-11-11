import { Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { MARGIN_BANNER_ONCHAIN, marginBanner } from '../../core/disclosures'
import { formatUtc } from '../../core/format'
import { hasMarginAck, setMarginAck } from '../../core/market/marginAck'
import { isProSimulated } from '../../core/pro/createClient'
import type { SorobanProClient } from '../../core/pro/SorobanProClient'
import { ProLoader, usePro } from '../../data'
import { Button, Callout, EmptyNote, Link, NavTab, NavTabs, PageHeader, Skeleton } from '../../ui'
import { SCREENS, SCREEN_ORDER, SCREEN_PATH } from './copy'
import { partyName, scenarioCopy } from './model/names'
import { EntryWarning } from './parts/EntryWarning'
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

/**
 * The sentences every Margin screen carries, once, as one plain paragraph under the title: the payout risk and
 * who sets the prices (AGENTS.md, "StellSec Pro UI"), and on fixtures first that nothing here calls a contract.
 * Outside the loader, so loading and error states carry them too.
 */
function Sentences() {
  const simulated = isProSimulated()
  return <p className={css.sentences}>{simulated ? `${marginBanner(true)} ${MARGIN_BANNER_ONCHAIN}` : marginBanner(false)}</p>
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

/** Fixture builds: which scenario, which step, as whom and at what time on the scenario's clock, in one line. */
function ReplayLine() {
  const { sim, me, model } = usePro()
  if (!sim) return null
  return (
    <p className={css.replayLine}>
      <span className={css.strong}>{scenarioCopy(sim.scenarioName).title}</span>, step {sim.position} of {sim.stepCount}, as <span className={css.strong}>{partyName(me)}</span>. The
      scenario stands at {formatUtc(model.now)}.{' '}
      <Link href="#replay" aria-label="Change scenario, step or account">
        Change
      </Link>
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

/** The shape of the screen that is loading: figures and a rail for Account and Vault, tables for the others. */
function Loading({ screen }: { screen: MarginScreen }) {
  const withRail = screen === 'account' || screen === 'vault' || screen === 'trade'
  return (
    <div className={css.loading} aria-busy="true">
      <span className="ui-vh">Loading the margin section</span>
      <Skeleton variant="block" height="3.5rem" />
      <div className={withRail ? css.loadingRail : undefined}>
        <div className={css.loadingMain}>
          {screen === 'account' || screen === 'vault' ? <Skeleton variant="block" height="5rem" /> : null}
          <Skeleton variant="rows" lines={screen === 'account' ? 4 : 6} />
        </div>
        {withRail ? <Skeleton variant="block" height="14rem" /> : null}
      </div>
    </div>
  )
}

function Body({ screen }: { screen: MarginScreen }) {
  const { live } = usePro()
  const status = useLiveStatus(live)
  const firstRead = status !== null && status.updatedAt === null

  if (firstRead && status.error) {
    return (
      <Callout variant="danger" title="Reading the margin contract failed." actions={<Button onClick={() => void live?.refresh()}>Try again</Button>}>
        <p>{status.error}</p>
      </Callout>
    )
  }
  if (firstRead) return <Loading screen={screen} />

  return (
    <>
      {status?.error ? (
        <Callout variant="warning" title="The last read of the margin contract failed." actions={<Button size="sm" onClick={() => void live?.refresh()}>Read again</Button>}>
          <p>
            {status.error} The figures below are from {status.updatedAt !== null ? formatUtc(status.updatedAt) : 'an earlier read'}.
          </p>
        </Callout>
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
 * The Margin section: partial margin, cash-settled uncovered calls, kept apart from the Covered product. One
 * component for the five routes, so the warning, the replay and the acting account survive a change of screen.
 * Fixtures while the build has no Margin contract id, the Testnet contract otherwise.
 */
export function MarginPage({ screen }: { screen: MarginScreen }) {
  const navigate = useNavigate()
  // Asked once per browser tab, whichever screen the user lands on, and only where a call can be signed: a
  // fixture build replays recorded steps and calls no contract.
  const [acknowledged, setAcknowledged] = useState(() => isProSimulated() || hasMarginAck())
  const copy = SCREENS[screen]
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  return (
    <div className={css.page}>
      <PageHeader title={copy.title} description={copy.description} meta={<Sentences />} headingRef={headingRef} />
      <SubNav screen={screen} />
      <ProLoader
        loading={<Loading screen={screen} />}
        error={(_message, retry) => (
          <EmptyNote
            title="The margin section could not be loaded."
            headingLevel={2}
            hint={isProSimulated() ? 'The recorded scenarios did not arrive. Check the connection, then try again.' : 'The contract client did not arrive. Check the connection, then try again.'}
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
        finalFocus={headingRef}
        onContinue={() => {
          setMarginAck()
          setAcknowledged(true)
        }}
        onCancel={() => void navigate({ to: '/markets' })}
      />
    </div>
  )
}
