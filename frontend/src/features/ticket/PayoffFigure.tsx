// The payoff figure of the review: the engraved chart with the assumed-price handle, starting at the
// reference price. Hypothetical by construction: its caption is the required sentence.
import { useMemo } from 'react'
import { PAYOFF_CAPTION } from '../../core/disclosures'
import type { ReferencePrice } from '../../core/reference'
import { SwipeIgnore } from '../../ui'
import { PayoffChart } from '../../viz'
import { payoffModel } from './payoff'
import type { Leg, Side } from './terms'
import styles from './PayoffFigure.module.css'

export function PayoffFigure({ leg, side, reference, title }: { leg: Leg; side: Side; reference: ReferencePrice; title: string }) {
  const model = useMemo(() => payoffModel(leg, side, reference), [leg, side, reference])
  if (!model) return null
  // A drag on the price handle must not swipe the drawer away.
  return (
    <SwipeIgnore className={styles.root}>
      <PayoffChart
        title={title}
        points={model.points}
        domain={model.domain}
        strike={model.strike}
        breakevens={model.breakevens}
        reference={model.reference}
        maxGain={model.maxGain}
        maxLoss={model.maxLoss}
        defaultPrice={model.defaultPrice}
        unit={leg.quote.code}
        asset={leg.underlying.code}
        caption={PAYOFF_CAPTION}
      />
      {model.reference ? <p className={styles.source}>{`${reference.label}: ${reference.note}`}</p> : <p className={styles.source}>{reference.note}</p>}
    </SwipeIgnore>
  )
}
