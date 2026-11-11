// The to-do strip: what the wallet can do now, each card with what to do, by when and why. An exercise asks for
// action only when it is in the money at the reference price; an option that is not, or that has no reference,
// gets a quiet card (no button, a link to the position) in its last 48 hours, because the reference is a demo
// figure and the deadline is real. A request past its deadline keeps its premium in the contract until it is
// cancelled, so it gets a card too.
import type { ReactNode } from 'react'
import { formatExact, formatUnits } from '../../core/format'
import type { OptionOffer, TokenInfo } from '../../core/options/types'
import { requiredCollateral } from '../../core/options/types'
import { claimAmount } from '../../core/portfolio/positions'
import type { Bid } from '../../core/requests/types'
import { bidSubject, optionSubject, useSubjectBusy, useTxBusy } from '../../data'
import type { TodoView } from '../../data'
import { Amount, Button, Countdown, DateTime, IconWarning } from '../../ui'
import { BUSY_REASON, CANCEL_REQUEST, LAST_MINUTES_NOTE, SHORT_LINE, TODO_HEADING, VIEW_POSITION, exerciseCover, expiredRequestCopy, todoCopy } from './copy'
import type { TodoCopy } from './copy'
import { isShort } from './hooks'
import { PositionLink, ReservesLink } from './links'
import { ACTION_NAME, exerciseShortOf, optionPhrase, showsCard } from './model'
import type { PositionAction } from './model'
import css from './TodoStrip.module.css'

const HOURS_48 = 48 * 3_600_000

export interface TodoStripProps {
  items: readonly TodoView[]
  /** The wallet's requests whose deadline passed while open: the premium waits for a cancel. */
  expiredRequests: readonly Bid[]
  /** Tokens the contract holds less of than it owes. */
  short: readonly TokenInfo[]
  /** The wallet's balances by token contract id, to say when an exercise is not covered yet. */
  balances?: Readonly<Record<string, { balance: bigint | null }>>
  onAction: (option: OptionOffer, action: PositionAction) => void
  onCancelRequest: (bid: Bid) => void
}

function ShortLine({ token }: { token: TokenInfo }) {
  return (
    <p className={css.short}>
      <ReservesLink tone="quiet" className={css.link}>
        {SHORT_LINE(token.code)}
      </ReservesLink>
    </p>
  )
}

function OptionButton({ t, action, primary, onAction }: { t: TodoView; action: PositionAction; primary: boolean; onAction: TodoStripProps['onAction'] }) {
  const working = useSubjectBusy(optionSubject(t.option.id))
  const busy = useTxBusy()
  return (
    <Button variant={primary ? 'primary' : 'secondary'} loading={working} disabled={busy && !working} disabledReason={BUSY_REASON} onClick={() => onAction(t.option, action)}>
      {ACTION_NAME[action]}
    </Button>
  )
}

function RequestButton({ b, primary, onCancel }: { b: Bid; primary: boolean; onCancel: (bid: Bid) => void }) {
  const working = useSubjectBusy(bidSubject(b.id))
  const busy = useTxBusy()
  return (
    <Button variant={primary ? 'primary' : 'secondary'} loading={working} disabled={busy && !working} disabledReason={BUSY_REASON} onClick={() => onCancel(b)}>
      {CANCEL_REQUEST}
    </Button>
  )
}

function Card({ copy, tone, testId, children, action }: { copy: TodoCopy; tone: string; testId: string; children?: ReactNode; action: ReactNode }) {
  return (
    <li className={css.card} data-tone={tone} data-testid={testId}>
      <h3 className={css.title}>{copy.title}</h3>
      {copy.body ? <p className={css.body}>{copy.body}</p> : null}
      {children}
      <div className={css.action}>{action}</div>
    </li>
  )
}

function OptionCard({ t, primary, short, balances, onAction }: { t: TodoView; primary: boolean; short: readonly TokenInfo[]; balances?: TodoStripProps['balances']; onAction: TodoStripProps['onAction'] }) {
  const copy = todoCopy(t)
  const o = t.option
  const uncovered = t.kind === 'exercise' ? exerciseShortOf(o, balances) : null
  const value = t.kind === 'exercise' && t.moneyness === 'in' && t.reference ? t.exerciseValue : null
  // The token the contract pays out: an exercise and a reclaim pay the collateral, a claim what the exercise left.
  const payout = t.kind === 'claim' ? claimAmount(o).token : t.kind === 'reclaim' || t.kind === 'exercise' ? requiredCollateral(o).token : null
  const action = copy.action ? (
    <OptionButton t={t} action={copy.action} primary={primary} onAction={onAction} />
  ) : (
    <PositionLink id={o.id} className={css.link} aria-label={`${VIEW_POSITION}: ${copy.title}`}>
      {VIEW_POSITION}
    </PositionLink>
  )
  return (
    <Card copy={copy} tone={t.tone === 'urgent' ? 'urgent' : copy.action ? 'action' : 'quiet'} testId={`todo-${t.kind}-${o.id}`} action={action}>
      {value !== null && value > 0n ? (
        <p className={css.value}>
          <span className={css.valueLabel}>Exercise value</span>
          <Amount value={formatUnits(value, o.quote.decimals)} exact={formatExact(value, o.quote.decimals)} unit={o.quote.code} direction="gain" figure="serif" />
        </p>
      ) : null}
      {uncovered ? <p className={css.short}>{exerciseCover(o, uncovered.have, uncovered.need)}</p> : null}
      {t.kind === 'exercise' && t.urgency === 'within15min' ? (
        <p className={css.lastMinutes}>
          <IconWarning size={14} />
          <span>{LAST_MINUTES_NOTE}</span>
        </p>
      ) : null}
      {t.kind === 'exercise' ? (
        <p className={css.when}>
          <span className={css.left}>
            <Countdown to={o.expiry * 1000} warnBelowMs={HOURS_48} label="Time left to exercise" />
          </span>
          <DateTime value={o.expiry * 1000} local="inline" className={css.date} />
        </p>
      ) : null}
      {payout && isShort(payout, short) ? <ShortLine token={payout} /> : null}
    </Card>
  )
}

function RequestCard({ b, primary, short, onCancel }: { b: Bid; primary: boolean; short: readonly TokenInfo[]; onCancel: (bid: Bid) => void }) {
  const premium = { token: b.quote, amount: b.totalPremium }
  const copy = expiredRequestCopy(premium, optionPhrase(b))
  return (
    <Card copy={copy} tone="action" testId={`todo-request-${b.id}`} action={<RequestButton b={b} primary={primary} onCancel={onCancel} />}>
      {isShort(b.quote, short) ? <ShortLine token={b.quote} /> : null}
    </Card>
  )
}

export function TodoStrip({ items, expiredRequests, short, balances, onAction, onCancelRequest }: TodoStripProps) {
  const cards = items.filter(showsCard)
  if (cards.length === 0 && expiredRequests.length === 0) return null
  // Real actions first (in-the-money exercises, claims, reclaims, then expired requests), the quiet reminders last.
  const acting = cards.filter((t) => t.actionable)
  const quiet = cards.filter((t) => !t.actionable)
  // One ink button on the page: the most pressing action.
  const primaryRequest = acting.length === 0 ? (expiredRequests[0]?.id ?? null) : null
  return (
    <section className={css.root} aria-labelledby="portfolio-todo">
      <h2 id="portfolio-todo" className={css.heading}>
        {TODO_HEADING}
      </h2>
      <ul className={css.list}>
        {acting.map((t, i) => (
          <OptionCard key={t.key} t={t} primary={i === 0} short={short} balances={balances} onAction={onAction} />
        ))}
        {expiredRequests.map((b) => (
          <RequestCard key={`request:${b.id}`} b={b} primary={b.id === primaryRequest} short={short} onCancel={onCancelRequest} />
        ))}
        {quiet.map((t) => (
          <OptionCard key={t.key} t={t} primary={false} short={short} balances={balances} onAction={onAction} />
        ))}
      </ul>
    </section>
  )
}
