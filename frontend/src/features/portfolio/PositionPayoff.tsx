// The payoff figure of a live position, under the required caption. A holder (or a viewer) sees the option leg
// against an assumed price, the readout leading with what exercising pays; a maker sees what it holds with the
// agreement and without it, as the guided page showed when it wrote the option. An ended option has no figure:
// its header and its lifecycle say what happened, with exact amounts.
import { useMemo } from 'react'
import { PAYOFF_CAPTION } from '../../core/disclosures'
import { formatNumber } from '../../core/format'
import type { OptionOffer } from '../../core/options/types'
import type { Role } from '../../core/portfolio/positions'
import type { ReferencePrice } from '../../core/reference'
import { Amount, Card } from '../../ui'
import { PayoffChart, WithWithoutChart } from '../../viz'
import type { PayoffReadoutState } from '../../viz'
import { PAYOFF_HEADING, PREMIUM_INCLUDED, PREMIUM_NOT_COUNTED, READOUT, VIEWER_LABELS, VIEWER_PAYOFF_NOTE } from './copy'
import { drawsPayoff, makerPayoff, positionPayoff } from './payoff'
import type { PositionPayoff as LegModel } from './payoff'
import css from './PositionPayoff.module.css'

export interface PositionPayoffProps {
  option: OptionOffer
  role: Role | null
  reference: ReferencePrice | null
  /** This browser bought the option from its holder: the original premium is left out of the line. */
  resold?: boolean
  className?: string
}

const num = (n: number) => formatNumber(n, { dp: 2 })

/** The holder's readout: what exercising pays at the assumed price, then what is left after the premium. */
function HolderReadout({ state, model, withPremium }: { state: PayoffReadoutState; model: LegModel; withPremium: boolean }) {
  const pays = model.exerciseAt(state.price)
  const unit = model.unit
  return (
    <div className={css.readout} data-testid="payoff-readout">
      {pays > 0.004 ? (
        <>
          <p className={css.readoutLabel}>{READOUT.at(model.asset, state.priceText)}</p>
          <p className={css.readoutValue}>
            <Amount value={num(pays)} unit={unit} direction="gain" figure="serif" size="lg" srLabel={`${num(pays)} ${unit}`} />
          </p>
        </>
      ) : (
        <p className={css.readoutLabel}>{READOUT.nothing(model.asset, state.priceText)}</p>
      )}
      {withPremium ? (
        <p className={css.readoutNet}>
          {READOUT.net(num(model.premium), unit)}{' '}
          <Amount value={num(Math.abs(state.value))} unit={unit} direction={state.value >= 0 ? 'gain' : 'loss'} srLabel={`${state.valueText} ${unit}`} />
        </p>
      ) : null}
    </div>
  )
}

export function PositionPayoff({ option, role, reference, resold = false, className }: PositionPayoffProps) {
  const maker = role === 'writer'
  const withoutPremium = role === 'holder' && resold
  // The domain and the sampled points are computed when the terms change, never while the handle moves.
  const leg = useMemo(() => (maker ? null : positionPayoff(option, reference, { withoutPremium })), [option, reference, maker, withoutPremium])
  const written = useMemo(() => (maker ? makerPayoff(option, reference) : null), [option, reference, maker])
  if (!drawsPayoff(option)) return null

  if (written) {
    return (
      <Card title={PAYOFF_HEADING} headingLevel={2} className={className}>
        <WithWithoutChart
          points={written.points}
          domain={written.domain}
          level={written.level}
          reference={written.reference}
          withLabel="With the agreement"
          withoutLabel={written.intent === 'earn-hold' ? 'Just holding' : 'Keeping the cash'}
          defaultPrice={written.defaultPrice}
          unit={written.unit}
          asset={written.asset}
          title={written.title}
          caption={`${PAYOFF_CAPTION} ${PREMIUM_INCLUDED}`}
        />
      </Card>
    )
  }
  if (!leg) return null
  const note = role === null ? VIEWER_PAYOFF_NOTE : withoutPremium ? PREMIUM_NOT_COUNTED : PREMIUM_INCLUDED
  return (
    <Card title={PAYOFF_HEADING} headingLevel={2} className={className}>
      <PayoffChart
        title={leg.title}
        points={leg.points}
        domain={leg.domain}
        strike={leg.strike}
        breakevens={leg.breakevens}
        reference={leg.reference}
        maxGain={leg.maxGain}
        maxLoss={leg.maxLoss}
        defaultPrice={leg.defaultPrice}
        unit={leg.unit}
        asset={leg.asset}
        caption={`${PAYOFF_CAPTION} ${note}`}
        readout={(state) => <HolderReadout state={state} model={leg} withPremium={!withoutPremium} />}
        labels={role === null ? VIEWER_LABELS : undefined}
      />
    </Card>
  )
}
