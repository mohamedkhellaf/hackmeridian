// /portfolio/$id: one option as a contract note, its lifecycle, its payoff figure while it is live, and the
// actions that apply. `?do=exercise|claim|reclaim|sell|cancel` opens the matching action, so a calendar entry or a
// to-do link lands on it; closing the action removes the param, and the back button closes it too.
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { AssetSearch } from '../../app/search'
import { clawbackShortfallDisclosure } from '../../core/disclosures'
import type { OptionOffer } from '../../core/options/types'
import { askOf } from '../../core/resale/resale'
import { OPTIONS_ERRORS } from '../../core/stellar/errors'
import { plainAmount, strikeUnits } from '../../core/units'
import { optionReference, optionSubject, useAsks, useBalancesById, useLedger, useMe, useNowSec, usePosition, useSubjectBusy, useTxBusy } from '../../data'
import type { PositionView } from '../../data'
import { Button, Callout, Countdown, DateTime, EmptyNote, PageHeader, Skeleton } from '../../ui'
import { useWallet } from '../../wallet'
import { ActionFlow } from './actions/ActionFlow'
import { useActionFlow } from './actions/useActionFlow'
import {
  BUSY_REASON,
  CONNECT,
  GUEST_ACTIONS,
  LAST_MINUTES_NOTE,
  ASSET_IN_MARKETS,
  LISTED_IN_MARKETS,
  NOT_FOUND_TITLE,
  NOT_YOURS,
  PAGE_TITLE,
  POSITION_ERROR_TITLE,
  SERIES_IN_MARKETS,
  UNTIL,
  exerciseCover,
  noActionNote,
  positionSentence,
  readError,
  staleLink,
} from './copy'
import { shortOf, useFromRequest, useReserveHealth, useResold } from './hooks'
import { Lifecycle } from './Lifecycle'
import { BackToPortfolio, MarketsLink, ReservesLink } from './links'
import { ACTION_NAME, actionsFor, allows, exerciseShortOf, optionTitle, sellLabel, strikeText } from './model'
import type { PositionAction } from './model'
import { PositionNote } from './PositionNote'
import { PositionPayoff } from './PositionPayoff'
import { drawsPayoff } from './payoff'
import { parseOptionId, positionRoute } from './route'
import css from './PositionPage.module.css'

interface FrameProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  /** The actions also sit in a bar at the bottom edge on a phone (and leave the header there). */
  bar?: boolean
  children?: ReactNode
}

function Frame({ title = 'Position', description, actions, meta, bar = false, children }: FrameProps) {
  return (
    <div className={css.page} data-bar={bar || undefined}>
      <PageHeader back={<BackToPortfolio label={PAGE_TITLE} />} title={title} description={description} actions={actions} meta={meta} />
      {children}
    </div>
  )
}

interface HeaderActionsProps {
  option: OptionOffer
  position: PositionView | null
  actions: readonly PositionAction[]
  onOpen: (action: PositionAction) => void
}

/**
 * The buttons that apply now. A contract call that is waiting (an in-the-money exercise, a claim, a reclaim) is
 * the page's one ink button; an exercise the reference calls out of the money, a cancellation and a listing are
 * choices, so they are outlined.
 */
function HeaderActions({ option, position, actions, onOpen }: HeaderActionsProps) {
  const working = useSubjectBusy(optionSubject(option.id))
  const busy = useTxBusy()
  if (actions.length === 0) return null
  const [first, ...rest] = actions
  const label = (a: PositionAction) => (a === 'sell' ? sellLabel(position?.listing ?? null) : ACTION_NAME[a])
  const isCall = first !== 'sell' && first !== 'unlist'
  const lead = isCall && first !== 'cancel' && !(first === 'exercise' && (position?.moneyness === 'out' || position?.moneyness === 'at'))
  return (
    <>
      <Button variant={lead ? 'primary' : 'secondary'} loading={working && isCall} disabled={busy && !working} disabledReason={BUSY_REASON} onClick={() => onOpen(first)}>
        {label(first)}
      </Button>
      {rest.map((a) => (
        <Button key={a} disabled={busy} disabledReason={BUSY_REASON} onClick={() => onOpen(a)}>
          {label(a)}
        </Button>
      ))}
    </>
  )
}

/** Nothing is left in the contract for an option in these states. */
const ENDED: ReadonlySet<OptionOffer['state']> = new Set(['settled', 'reclaimed', 'cancelled'])

/** The UTC day of the deadline, as the asset page's `expiry` param takes it. */
const expiryDay = (o: Pick<OptionOffer, 'expiry'>): string => new Date(o.expiry * 1000).toISOString().slice(0, 10)

/** Where the option can be seen in Markets: its listing, its open offer, or its series. */
function marketsSearch(o: OptionOffer, listed: boolean): AssetSearch {
  if (listed) return { mode: 'chain', ask: o.id.toString() }
  if (o.state === 'offered') return { mode: 'chain', offer: o.id.toString() }
  const strike = strikeUnits(o)
  return { mode: 'chain', kind: o.kind, expiry: expiryDay(o), ...(strike !== null ? { strike: plainAmount(strike, o.quote.decimals) } : {}) }
}

export function PositionPage() {
  const { id: raw } = positionRoute.useParams()
  const search = positionRoute.useSearch()
  const navigate = useNavigate({ from: '/portfolio/$id' })
  const id = parseOptionId(raw)
  const me = useMe()
  const wallet = useWallet()
  const detail = usePosition(id)
  const asks = useAsks()
  const ledger = useLedger()
  const nowSec = useNowSec(10)
  const flow = useActionFlow()
  const health = useReserveHealth()
  const balances = useBalancesById(me)
  const option = detail.data?.option ?? null
  const position = detail.data?.position ?? null
  const resold = useResold(option)
  const fromRequest = useFromRequest(option)
  // Withdrawing a listing has no link form: it is opened by its button only.
  const [local, setLocal] = useState<PositionAction | null>(null)

  const resale = Array.isArray(asks.data)
  const actions = actionsFor(position, me, nowSec, resale)
  const wanted: PositionAction | null = local ?? search.do ?? null
  const target = allows(actions, wanted) ? wanted : null

  // The URL (or the button) says which action is open; the flow follows it. An action stays open after it
  // confirmed, although the position no longer allows it: the dialog is showing its receipt.
  if (option && target && (!flow.open || flow.flow?.action !== target)) flow.start(option, target, position?.listing ?? null)
  if (wanted === null && flow.open) flow.close()

  const open = (action: PositionAction) => {
    if (action === 'unlist') setLocal('unlist')
    else void navigate({ search: { do: action } })
  }
  const closeAction = () => {
    setLocal(null)
    if (search.do) void navigate({ search: {}, replace: true })
  }

  if (id === null || (detail.isError && detail.error === OPTIONS_ERRORS[101])) {
    return (
      <Frame>
        <EmptyNote slip className={css.empty} headingLevel={2} title={NOT_FOUND_TITLE} />
      </Frame>
    )
  }

  if (detail.isError) {
    return (
      <Frame>
        <Callout
          variant="danger"
          title={POSITION_ERROR_TITLE}
          actions={
            <Button size="sm" onClick={detail.retry}>
              Try again
            </Button>
          }
        >
          {readError(detail.error)}
        </Callout>
      </Frame>
    )
  }

  if (!option) {
    return (
      <Frame>
        <div className={css.grid} aria-busy="true" aria-label="Loading the position">
          <Skeleton variant="block" height="26rem" />
          <Skeleton variant="block" height="18rem" />
        </div>
      </Frame>
    )
  }

  const role = position?.role ?? null
  const reference = position?.reference ?? optionReference(option)
  const listing = position?.listing ? { token: option.quote, amount: position.listing.askTotal } : null
  // A viewer who is not the holder still sees a live listing, and where to buy it.
  const viewerAsk = role === 'holder' ? undefined : option.state === 'active' && option.expiry > nowSec ? askOf(asks.data ?? null, option.id) : undefined
  const live = (option.state === 'offered' || option.state === 'active') && option.expiry > nowSec
  const lastMinutes = role === 'holder' && option.state === 'active' && position?.urgency === 'within15min'
  const stale = wanted !== null && target === null && !flow.open
  const short = shortOf(option, health)
  const holderActions = me ? <HeaderActions option={option} position={position} actions={actions} onOpen={open} /> : null
  const bar = !!me && actions.length > 0 && live
  // A live option has its payoff figure on the right and the lifecycle under the note; an ended one has no
  // figure, and its lifecycle takes the right column.
  const figure = drawsPayoff(option)
  const lifecycle = <Lifecycle option={option} role={role} resold={role === 'holder' && resold} fromRequest={fromRequest} />

  // A holder who cannot cover the exercise yet is told before opening it, with where the asset is.
  const uncovered = role === 'holder' && option.state === 'active' && live ? exerciseShortOf(option, balances.data) : null
  let note: string | null = null
  if (!me) note = GUEST_ACTIONS
  else if (!position) note = NOT_YOURS
  else if (actions.length === 0) note = noActionNote(position)

  const meta = (
    <>
      {live ? (
        <span className={css.deadline}>
          <span>{UNTIL}</span>
          <DateTime value={option.expiry * 1000} />
          <Countdown to={option.expiry * 1000} warnBelowMs={(role === 'holder' && position?.moneyness === 'in' ? 48 : 2) * 3_600_000} label="Time left" />
        </span>
      ) : null}
      <MarketsLink tone="quiet" className={css.metaLink} asset={option.underlying} search={live ? marketsSearch(option, !!viewerAsk) : undefined}>
        {viewerAsk ? LISTED_IN_MARKETS : live ? SERIES_IN_MARKETS : ASSET_IN_MARKETS(option.underlying.code)}
      </MarketsLink>
    </>
  )

  return (
    <Frame
      bar={bar}
      title={`${optionTitle(option)} at ${strikeText(option)}`}
      description={positionSentence(option, role, listing)}
      meta={meta}
      actions={
        me ? (
          <span className={css.headerActions}>{holderActions}</span>
        ) : (
          <Button onClick={() => void wallet.connect()}>{CONNECT}</Button>
        )
      }
    >
      {detail.refreshFailed ? (
        <Callout
          variant="warning"
          actions={
            <Button size="sm" onClick={detail.retry}>
              Try again
            </Button>
          }
        >
          Could not refresh. The terms below are from the last successful read.
        </Callout>
      ) : null}
      {stale && me ? (
        <Callout
          variant="info"
          actions={
            <Button size="sm" onClick={closeAction}>
              Dismiss
            </Button>
          }
        >
          {staleLink(wanted)}
        </Callout>
      ) : null}
      {lastMinutes ? (
        <Callout variant="warning" title="The deadline is close">
          {LAST_MINUTES_NOTE}
        </Callout>
      ) : null}
      {short.length > 0 && !ENDED.has(option.state) ? (
        <Callout variant="warning" actions={<ReservesLink>Reserves</ReservesLink>}>
          {clawbackShortfallDisclosure(short.map((t) => t.code))}
        </Callout>
      ) : null}
      {note ? <p className={css.note}>{note}</p> : null}
      {uncovered ? (
        <p className={css.uncovered}>
          {exerciseCover(option, uncovered.have, uncovered.need)}{' '}
          <MarketsLink asset={option.underlying}>{ASSET_IN_MARKETS(option.underlying.code)}</MarketsLink>
        </p>
      ) : null}

      <div className={css.grid}>
        <div className={css.main}>
          <PositionNote
            option={option}
            position={position}
            me={me}
            ledger={ledger.data?.sequence ?? null}
            nowSec={nowSec}
            resold={role === 'holder' && resold}
            listedAt={viewerAsk?.askTotal ?? null}
            short={short}
          />
          {figure ? lifecycle : null}
        </div>
        {figure ? <PositionPayoff className={css.side} option={option} role={role} reference={reference} resold={role === 'holder' && resold} /> : lifecycle}
      </div>

      {bar ? <div className={css.actionBar}>{holderActions}</div> : null}

      <ActionFlow flow={flow.flow} open={flow.open} onClose={closeAction} finalFocus={flow.finalFocus} />
    </Frame>
  )
}
