import { Link as RouterLink } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { explorerTx } from '../../../core/explorer'
import { formatMoney, formatUtcDate } from '../../../core/format'
import { Link, TxLink } from '../../../ui'
import { LIFECYCLE, SECTION } from '../copy'
import { RECORDED_PUT, RECORDED_PUT_TX, RECORDED_RECLAIM_TX } from '../recorded'
import type { RecordedTx } from '../recorded'
import { Section } from './Section'
import css from './Lifecycle.module.css'

const put = RECORDED_PUT
const qty = formatMoney(put.underlyingQty, put.underlying)
const strike = formatMoney(put.totalStrike, put.quote)
const premium = formatMoney(put.totalPremium, put.quote)

/** One transaction of the recorded option: its link, and a label when a step has two. */
function Recorded({ tx, label }: { tx: RecordedTx; label?: string }) {
  return (
    <p className={css.recorded}>
      {label ? <span className={css.recordedLabel}>{label}</span> : null}
      <TxLink hash={tx.hash} explorerUrl={explorerTx(tx.hash)} />
    </p>
  )
}

/**
 * The visible mark of each row. The deadline row is the other branch of the exercise, not a step after it, so it
 * carries "or" and the maker's step after it is number 4.
 */
const MARKS: Record<(typeof LIFECYCLE.steps)[number]['id'], { mark: string; label: string }> = {
  write: { mark: '1', label: LIFECYCLE.stepLabel(1) },
  buy: { mark: '2', label: LIFECYCLE.stepLabel(2) },
  exercise: { mark: '3', label: LIFECYCLE.stepLabel(3) },
  deadline: { mark: LIFECYCLE.or, label: LIFECYCLE.orLabel(3) },
  collect: { mark: '4', label: LIFECYCLE.stepLabel(4) },
}

const MOVES: Record<(typeof LIFECYCLE.steps)[number]['id'], string> = {
  write: LIFECYCLE.movesWrite(strike),
  buy: LIFECYCLE.movesBuy(premium),
  exercise: LIFECYCLE.movesExercise(qty, strike),
  deadline: LIFECYCLE.movesDeadline,
  collect: LIFECYCLE.movesCollect(qty, strike),
}

const EVIDENCE: Record<(typeof LIFECYCLE.steps)[number]['id'], ReactNode> = {
  write: <Recorded tx={RECORDED_PUT_TX.write} />,
  buy: <Recorded tx={RECORDED_PUT_TX.buy} />,
  exercise: <Recorded tx={RECORDED_PUT_TX.exercise} />,
  deadline: <p className={css.noTx}>{LIFECYCLE.noTx}</p>,
  collect: (
    <>
      <Recorded tx={RECORDED_PUT_TX.claim} label={LIFECYCLE.claimLabel} />
      <Recorded tx={RECORDED_RECLAIM_TX} label={LIFECYCLE.reclaimLabel} />
    </>
  ),
}

export function Lifecycle() {
  const columns = LIFECYCLE.columns
  return (
    <Section id={SECTION.lifecycle} heading={LIFECYCLE.heading} lead={LIFECYCLE.lead(formatUtcDate(RECORDED_PUT_TX.write.closedAt))} layout="stack">
      <div className={css.ledger}>
        {/* Column heads for wide screens. Each cell below repeats its own label for assistive technology and for phones. */}
        <div className={css.heads} aria-hidden="true">
          <span>{columns.step}</span>
          <span>{columns.when}</span>
          <span>{columns.moves}</span>
          <span>{columns.recorded}</span>
        </div>
        <ol className={css.steps} role="list" aria-label={LIFECYCLE.tableCaption}>
          {LIFECYCLE.steps.map((step) => (
            <li key={step.id} className={css.step} data-branch={step.id === 'deadline' || undefined}>
              <div className={css.title}>
                <span className={css.number} aria-hidden="true">
                  {MARKS[step.id].mark}
                </span>
                <h3 className={css.name}>
                  <span className="ui-vh">{MARKS[step.id].label}</span>
                  {step.title}
                </h3>
              </div>
              <dl className={css.facts}>
                <div className={css.fact}>
                  <dt>{columns.when}</dt>
                  <dd>{step.when}</dd>
                </div>
                <div className={css.fact}>
                  <dt>{columns.moves}</dt>
                  <dd>{MOVES[step.id]}</dd>
                </div>
                <div className={css.fact}>
                  <dt>{columns.recorded}</dt>
                  <dd>{EVIDENCE[step.id]}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </div>
      <p className={css.foot}>
        {LIFECYCLE.earlier}{' '}
        <Link render={<RouterLink to="/learn" />}>{LIFECYCLE.more}</Link>
      </p>
    </Section>
  )
}
