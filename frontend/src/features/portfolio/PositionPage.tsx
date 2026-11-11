// /portfolio/$id: one option as a contract note, its payoff figure, its lifecycle and the actions that apply.
// `?do=exercise|claim|reclaim|sell|cancel` opens the matching action, so a calendar entry or a to-do link lands
// on it; closing the action removes the param, and the back button closes it too.
import { Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { assetParam } from '../../core/assets'
import type { OptionOffer } from '../../core/options/types'
import { seriesNameOf } from '../../core/series'
import { OPTIONS_ERRORS } from '../../core/stellar/errors'
import { optionReference, optionSubject, useAsks, useLedger, useMe, useNowSec, usePosition, useSubjectBusy, useTxBusy } from '../../data'
import type { PositionView } from '../../data'
import { Button, Callout, EmptyNote, IconBack, Link, PageHeader, Skeleton } from '../../ui'
import { useWallet } from '../../wallet'
import { ActionFlow } from './actions/ActionFlow'
import { useActionFlow } from './actions/useActionFlow'
import {
  BUSY_REASON,
  CONNECT,
  GUEST_ACTIONS,
  LAST_MINUTES_NOTE,
  NOT_FOUND_HINT,
  NOT_FOUND_TITLE,
  NOT_YOURS,
  PAGE_TITLE,
  POSITION_ERROR_TITLE,
  noActionNote,
  positionSentence,
  readError,
  staleLink,
} from './copy'
import { Lifecycle } from './Lifecycle'
import { PortfolioLink } from './links'
import { ACTION_NAME, actionsFor, allows, optionTitle, sellLabel, strikeText } from './model'
import type { PositionAction } from './model'
import { PositionNote } from './PositionNote'
import { PositionPayoff } from './PositionPayoff'
import { parseOptionId, positionRoute } from './route'
import css from './PositionPage.module.css'

const Back = () => (
  <PortfolioLink tone="quiet" className={css.back}>
    <IconBack size={14} />
    <span>{PAGE_TITLE}</span>
  </PortfolioLink>
)

function Frame({ title = 'Position', description, actions, meta, children }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className={css.page}>
      <PageHeader back={<Back />} title={title} description={description} actions={actions} meta={meta} />
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

/** The buttons that apply now: the contract call first, in ink; listing and withdrawing a listing beside it. */
function HeaderActions({ option, position, actions, onOpen }: HeaderActionsProps) {
  const working = useSubjectBusy(optionSubject(option.id))
  const busy = useTxBusy()
  if (actions.length === 0) return null
  const [first, ...rest] = actions
  const label = (a: PositionAction) => (a === 'sell' ? sellLabel(position?.listing ?? null) : ACTION_NAME[a])
  // A contract call (exercise, claim, reclaim, cancel) is the page's main action. A position that can only be
  // listed has no ink button: selling is a choice, not something that is waiting.
  const firstIsCall = first !== 'sell' && first !== 'unlist'
  return (
    <>
      <Button variant={firstIsCall ? 'primary' : 'secondary'} loading={working && firstIsCall} disabled={busy && !working} disabledReason={BUSY_REASON} onClick={() => onOpen(first)}>
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
  // Withdrawing a listing has no link form: it is opened by its button only.
  const [local, setLocal] = useState<PositionAction | null>(null)

  const option = detail.data?.option ?? null
  const position = detail.data?.position ?? null
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
        <EmptyNote className={css.empty} headingLevel={2} title={NOT_FOUND_TITLE} hint={NOT_FOUND_HINT} action={<PortfolioLink>Back to your portfolio</PortfolioLink>} />
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
          {readError(detail.error)} Nothing was changed.
        </Callout>
      </Frame>
    )
  }

  if (!option) {
    return (
      <Frame>
        <div className={css.grid} aria-busy="true" aria-label="Loading the position">
          <Skeleton variant="block" height="26rem" />
          <div className={css.side}>
            <Skeleton variant="block" height="18rem" />
            <Skeleton variant="rows" lines={4} />
          </div>
        </div>
      </Frame>
    )
  }

  const role = position?.role ?? null
  const series = seriesNameOf(option)
  const reference = position?.reference ?? optionReference(option)
  const listing = position?.listing ? { token: option.quote, amount: position.listing.askTotal } : null
  const ended = option.state !== 'offered' && option.state !== 'active'
  const lastMinutes = role === 'holder' && option.state === 'active' && position?.urgency === 'within15min'
  const stale = wanted !== null && target === null && !flow.open

  let note: string | null = null
  if (!me) note = GUEST_ACTIONS
  else if (!position) note = NOT_YOURS
  else if (actions.length === 0) note = noActionNote(position)

  return (
    <Frame
      title={`${optionTitle(option)} at ${strikeText(option)}`}
      description={positionSentence(option, role, listing)}
      meta={
        <>
          {series ? <span className="ui-mono">{series}</span> : null}
          <Link tone="quiet" render={<RouterLink to="/markets/$asset" params={{ asset: assetParam(option.underlying) }} />}>
            {option.underlying.code} in Markets
          </Link>
        </>
      }
      actions={
        me ? (
          <HeaderActions option={option} position={position} actions={actions} onOpen={open} />
        ) : (
          <Button variant="primary" onClick={() => void wallet.connect()}>
            {CONNECT}
          </Button>
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
      {note ? <p className={css.note}>{note}</p> : null}

      <div className={css.grid}>
        <PositionNote option={option} position={position} me={me} ledger={ledger.data?.sequence ?? null} nowSec={nowSec} />
        <div className={css.side}>
          <PositionPayoff option={option} role={role} reference={reference} ended={ended} />
          <Lifecycle option={option} />
        </div>
      </div>

      <ActionFlow flow={flow.flow} open={flow.open} onClose={closeAction} finalFocus={flow.finalFocus} />
    </Frame>
  )
}
