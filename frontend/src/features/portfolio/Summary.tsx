// The four summary figures of the portfolio, in the serif. Exact sums per token, straight from the chain's own
// terms: nothing here values a position.
import { formatExact, formatUnits } from '../../core/format'
import type { Money, TokenInfo } from '../../core/options/types'
import type { PortfolioSummary } from '../../core/portfolio/positions'
import { Amount, Stat } from '../../ui'
import { SUMMARY, SUMMARY_HEADING } from './copy'
import css from './Summary.module.css'

export interface SummaryProps {
  summary: PortfolioSummary
  /** The quote token, for a zero figure when the wallet has no premium yet. */
  quote: TokenInfo | null
  /** Open positions by side, for the line under the count. */
  held: number
  written: number
}

/** One line per token. A wallet that locked both USDx and an underlying shows both; none shows a zero in the quote token. */
function Sums({ sums, quote }: { sums: Money[]; quote: TokenInfo | null }) {
  const shown = sums.length > 0 ? sums : quote ? [{ token: quote, amount: 0n }] : []
  if (shown.length === 0) return <span>0</span>
  return (
    <span className={css.sums}>
      {shown.map((m) => (
        <span key={m.token.contractId} className={css.sum}>
          <Amount value={formatUnits(m.amount, m.token.decimals)} exact={formatExact(m.amount, m.token.decimals)} srLabel={`${formatUnits(m.amount, m.token.decimals)} ${m.token.code}`} figure="serif" size="lg" />
          <span className={css.unit} aria-hidden="true">
            {m.token.code}
          </span>
        </span>
      ))}
    </span>
  )
}

const sideLine = (held: number, written: number): string => `${held} held, ${written} written`

export function Summary({ summary, quote, held, written }: SummaryProps) {
  return (
    <section className={css.root} aria-label={SUMMARY_HEADING}>
      <Stat size="lg" label={SUMMARY.premiumPaid.label} value={<Sums sums={summary.premiumPaid} quote={quote} />} hint={SUMMARY.premiumPaid.hint} />
      <Stat size="lg" label={SUMMARY.premiumEarned.label} value={<Sums sums={summary.premiumEarned} quote={quote} />} hint={SUMMARY.premiumEarned.hint} />
      <Stat size="lg" label={SUMMARY.collateral.label} value={<Sums sums={summary.locked} quote={quote} />} hint={SUMMARY.collateral.hint} />
      <Stat size="lg" label={SUMMARY.open.label} value={summary.open} hint={sideLine(held, written)} />
    </section>
  )
}
