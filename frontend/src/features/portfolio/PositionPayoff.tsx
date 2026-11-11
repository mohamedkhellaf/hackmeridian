// The payoff figure of a position: the option leg at expiry against an assumed price the user can move. Always
// under the required caption; a closed position gets the same figure without the handle.
import { useMemo } from 'react'
import { PAYOFF_CAPTION } from '../../core/disclosures'
import type { OptionOffer } from '../../core/options/types'
import type { Role } from '../../core/portfolio/positions'
import type { ReferencePrice } from '../../core/reference'
import { Card } from '../../ui'
import { PayoffChart } from '../../viz'
import { ENDED_PAYOFF_NOTE, HOLDER_PAYOFF_NOTE, PAYOFF_HEADING, VIEWER_PAYOFF_NOTE, writerPayoffNote } from './copy'
import { positionPayoff } from './payoff'
import css from './PositionPayoff.module.css'

export interface PositionPayoffProps {
  option: OptionOffer
  role: Role | null
  reference: ReferencePrice | null
  /** The option was exercised, expired or cancelled: draw the figure without the assumed-price handle. */
  ended: boolean
}

export function PositionPayoff({ option, role, reference, ended }: PositionPayoffProps) {
  // The domain and the sampled points are computed when the terms change, never while the handle moves.
  const model = useMemo(() => positionPayoff(option, role, reference), [option, role, reference])
  if (!model) return null
  const note = ended ? ENDED_PAYOFF_NOTE : role === 'writer' ? writerPayoffNote(option) : role === 'holder' ? HOLDER_PAYOFF_NOTE : VIEWER_PAYOFF_NOTE
  return (
    <Card title={PAYOFF_HEADING} headingLevel={2}>
      <PayoffChart
        title={model.title}
        points={model.points}
        domain={model.domain}
        strike={model.strike}
        breakevens={model.breakevens}
        reference={model.reference}
        maxGain={model.maxGain}
        maxLoss={model.maxLoss}
        defaultPrice={model.defaultPrice}
        unit={model.unit}
        asset={model.asset}
        caption={PAYOFF_CAPTION}
        readOnly={ended}
      />
      <p className={css.note}>{note}</p>
    </Card>
  )
}
