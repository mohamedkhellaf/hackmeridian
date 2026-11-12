// The totals of the portfolio, in the serif: exact sums per token, straight from the chain's own terms. Nothing
// here values a position. Columns on a desktop, a ruled list (label left, figure right) on a phone.
import type { ReactNode } from 'react'
import { formatExact, formatUnits } from '../../core/format'
import type { Money, TokenInfo } from '../../core/options/types'
import type { PortfolioSummary } from '../../core/portfolio/positions'
import { Amount } from '../../ui'
import { SUMMARY, SUMMARY_HEADING } from './copy'
import type { PortfolioTotals } from './totals'
import css from './Summary.module.css'

export interface SummaryProps {
  summary: PortfolioSummary
  totals: PortfolioTotals
  /** The quote token, for a zero figure when the wallet has none of a sum. */
  quote: TokenInfo | null
}

const LIST = new Intl.ListFormat('en', { type: 'conjunction', style: 'long' })

/** Every token of one sum on one baseline: `4.00 EQTY and 97.00 USDx`. Zero in the quote token when empty. */
function Sums({ sums, quote }: { sums: Money[]; quote: TokenInfo | null }) {
  const shown = sums.length > 0 ? sums : quote ? [{ token: quote, amount: 0n }] : []
  if (shown.length === 0) return <span className={css.figure}>0</span>
  const parts = LIST.formatToParts(shown.map((_, i) => String(i)))
  return (
    <span className={css.sums}>
      {parts.map((part, i) => {
        if (part.type === 'literal') return <span key={i} className={css.and}>{part.value}</span>
        const m = shown[Number(part.value)]
        return <Amount key={m.token.contractId} value={formatUnits(m.amount, m.token.decimals)} exact={formatExact(m.amount, m.token.decimals)} unit={m.token.code} figure="serif" size="lg" />
      })}
    </span>
  )
}

function Item({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={css.item}>
      <dt className={css.label}>{label}</dt>
      <dd className={css.value}>
        {children}
        {hint ? <span className={css.hint}>{hint}</span> : null}
      </dd>
    </div>
  )
}

export function Summary({ summary, totals, quote }: SummaryProps) {
  const back = totals.readyBack.length > 0
  return (
    <section className={css.root} aria-label={SUMMARY_HEADING}>
      <dl className={css.list} data-count={back ? 4 : 3}>
        <Item label={SUMMARY.premiumPaid.label} hint={SUMMARY.premiumPaid.hint}>
          <Sums sums={summary.premiumPaid} quote={quote} />
        </Item>
        <Item label={SUMMARY.premiumEarned.label}>
          <Sums sums={summary.premiumEarned} quote={quote} />
        </Item>
        <Item label={SUMMARY.locked.label}>
          <Sums sums={totals.locked} quote={quote} />
        </Item>
        {back ? (
          <Item label={SUMMARY.readyBack.label}>
            <Sums sums={totals.readyBack} quote={quote} />
          </Item>
        ) : null}
      </dl>
    </section>
  )
}
