// The to-do strip: only what really needs the wallet, each card with what to do, by when and why. An exercise
// is urgent only when it is in the money at the reference price; otherwise it is a reminder of the deadline.
import type { ReactNode } from 'react'
import { formatExact, formatUnits } from '../../core/format'
import type { OptionOffer } from '../../core/options/types'
import { optionSubject, useSubjectBusy, useTxBusy } from '../../data'
import type { TodoView } from '../../data'
import { Amount, Button, Countdown, DateTime, IconClock, IconExpired, IconInbox, IconInfo, IconWarning } from '../../ui'
import { BUSY_REASON, LAST_MINUTES_NOTE, NO_DEADLINE, TODO_HEADING, VIEW_POSITION, todoCopy } from './copy'
import { PositionButtonLink, PositionLink } from './links'
import { ACTION_NAME, referenceName } from './model'
import type { PositionAction } from './model'
import css from './TodoStrip.module.css'

export interface TodoStripProps {
  items: readonly TodoView[]
  onAction: (option: OptionOffer, action: PositionAction) => void
}

function CardIcon({ t }: { t: TodoView }) {
  if (t.tone === 'urgent') return <IconWarning size={16} />
  if (t.tone === 'info') return <IconInfo size={16} />
  if (t.kind === 'claim' || t.kind === 'reclaim') return <IconInbox size={16} />
  return <IconClock size={16} />
}

/** By when: the countdown with the deadline in UTC and local time, or the words that stand for "no deadline". */
function When({ t }: { t: TodoView }) {
  const o = t.option
  if (t.kind === 'exercise') {
    return (
      <p className={css.when}>
        {t.tone === 'urgent' ? (
          <Countdown to={o.expiry * 1000} warnBelowMs={Number.MAX_SAFE_INTEGER} label="Time left to exercise" />
        ) : (
          <span className={css.left}>
            <IconClock size={14} />
            <Countdown to={o.expiry * 1000} label="Time left to exercise" />
          </span>
        )}
        <DateTime value={o.expiry * 1000} local="inline" className={css.date} />
      </p>
    )
  }
  if (t.kind === 'expired-unexercised') {
    return (
      <p className={css.when}>
        <span className={css.left}>
          <IconExpired size={14} />
          <span>Expired</span>
        </span>
        <DateTime value={o.expiry * 1000} className={css.date} />
      </p>
    )
  }
  return <p className={css.when}>{NO_DEADLINE}</p>
}

function ActionButton({ t, action, primary, onAction }: { t: TodoView; action: PositionAction; primary: boolean; onAction: TodoStripProps['onAction'] }) {
  const working = useSubjectBusy(optionSubject(t.option.id))
  const busy = useTxBusy()
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      loading={working}
      disabled={busy && !working}
      disabledReason={BUSY_REASON}
      onClick={() => onAction(t.option, action)}
    >
      {ACTION_NAME[action]}
    </Button>
  )
}

function TodoCard({ t, primary, onAction }: { t: TodoView; primary: boolean; onAction: TodoStripProps['onAction'] }) {
  const copy = todoCopy(t)
  const o = t.option
  const value = t.kind === 'exercise' && t.moneyness === 'in' && t.reference ? t.exerciseValue : null
  let action: ReactNode
  if (copy.action) action = <ActionButton t={t} action={copy.action} primary={primary} onAction={onAction} />
  else if (t.tone === 'info') {
    action = (
      <PositionLink id={o.id} aria-label={`${VIEW_POSITION}: ${copy.title}`}>
        {VIEW_POSITION}
      </PositionLink>
    )
  } else {
    action = (
      <PositionButtonLink id={o.id} aria-label={`${VIEW_POSITION}: ${copy.title}`}>
        {VIEW_POSITION}
      </PositionButtonLink>
    )
  }
  return (
    <li className={css.card} data-tone={t.tone} data-testid={`todo-${t.kind}-${o.id}`}>
      <p className={css.label}>
        <CardIcon t={t} />
        <span>{copy.label}</span>
      </p>
      <h3 className={css.title}>{copy.title}</h3>
      <p className={css.body}>{copy.body}</p>
      {value !== null && value > 0n && t.reference ? (
        <p className={css.value}>
          <span className={css.valueLabel}>Exercise value at the {referenceName(t.reference)}</span>
          <Amount value={formatUnits(value, o.quote.decimals)} exact={formatExact(value, o.quote.decimals)} unit={o.quote.code} direction="gain" figure="serif" />
        </p>
      ) : null}
      {t.kind === 'exercise' && t.urgency === 'within15min' ? (
        <p className={css.lastMinutes}>
          <IconWarning size={14} />
          <span>{LAST_MINUTES_NOTE}</span>
        </p>
      ) : null}
      <When t={t} />
      <div className={css.action}>{action}</div>
    </li>
  )
}

export function TodoStrip({ items, onAction }: TodoStripProps) {
  if (items.length === 0) return null
  // One ink button on the page: the most pressing action. The list is already sorted most pressing first.
  const firstAction = items.findIndex((t) => todoCopy(t).action !== null)
  return (
    <section className={css.root} aria-labelledby="portfolio-todo">
      <h2 id="portfolio-todo" className={css.heading}>
        {TODO_HEADING}
      </h2>
      <ul className={css.list}>
        {items.map((t, i) => (
          <TodoCard key={t.key} t={t} primary={i === firstAction} onAction={onAction} />
        ))}
      </ul>
    </section>
  )
}
