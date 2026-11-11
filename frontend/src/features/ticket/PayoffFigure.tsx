// The payoff figure of the review: the engraved chart with the assumed-price handle, starting at the
// reference price, behind a disclosure that is closed by default (the review states the outcome in words first).
// Hypothetical by construction: its caption is the required sentence.
import { useMemo } from 'react'
import { PAYOFF_CAPTION } from '../../core/disclosures'
import type { ReferencePrice } from '../../core/reference'
import { SwipeIgnore } from '../../ui'
import { PayoffChart } from '../../viz'
import { PAYOFF_SUMMARY } from './copy'
import { payoffModel } from './payoff'
import type { Leg, Side } from './terms'
import styles from './PayoffFigure.module.css'

export function PayoffFigure({ leg, side, reference, title }: { leg: Leg; side: Side; reference: ReferencePrice; title: string }) {
  const model = useMemo(() => payoffModel(leg, side, reference), [leg, side, reference])
  if (!model) return null
  return (
    <details className={styles.root}>
      <summary className={styles.summary}>{PAYOFF_SUMMARY}</summary>
      {/* A drag on the price handle must not swipe the drawer away. */}
      <SwipeIgnore className={styles.body}>
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
          step={model.step}
          labels={model.labels}
          description={model.description}
          unit={leg.quote.code}
          asset={leg.underlying.code}
          caption={PAYOFF_CAPTION}
        />
        {/* The chart labels the price it uses ("Demo price 99.40"); without one it says why none is drawn. */}
        {model.reference ? null : <p className={styles.source}>{reference.note}</p>}
      </SwipeIgnore>
    </details>
  )
}
