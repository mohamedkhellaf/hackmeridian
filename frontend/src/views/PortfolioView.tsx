import { OptionsTable } from '../market/OptionsTable'
import type { OptionOffer } from '../options/types'
import { PageHeader } from '../ui'
import type { PositionAction } from '../state/useStrata'

const LEGEND: [string, string][] = [
  ['offered', 'listed, collateral locked, no buyer yet'],
  ['active', 'sold; the holder can exercise until expiry'],
  ['exercised', 'awaiting writer claim: proceeds wait in the contract'],
  ['settled', 'writer claimed the proceeds; done'],
  ['expired', 'collateral reclaimable by the writer'],
  ['reclaimed', 'writer took the collateral back'],
  ['cancelled', 'offer withdrawn before any buyer'],
]

/** What each option state means. */
export function StateLegend() {
  return (
    <ul className="legend">
      {LEGEND.map(([s, d]) => (
        <li key={s}>
          <span className={`state state-${s}`}>{s}</span> {d}
        </li>
      ))}
    </ul>
  )
}

export interface PortfolioViewProps {
  me: string | null
  /** Options the connected wallet holds or wrote. */
  rows: OptionOffer[]
  actionFor: (o: OptionOffer) => PositionAction | undefined
}

export function PortfolioView({ me, rows, actionFor }: PortfolioViewProps) {
  return (
    <>
      <PageHeader title="Portfolio" subtitle="Options you hold and options you wrote, with the next action for each." />
      {me ? (
        <>
          <OptionsTable rows={rows} actionFor={actionFor} />
          <StateLegend />
        </>
      ) : (
        <p className="empty">Connect Freighter to see your positions.</p>
      )}
    </>
  )
}
