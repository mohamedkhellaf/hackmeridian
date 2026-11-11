import { useMemo, useState } from 'react'
import { PAYOFF_CAPTION } from '../../../core/disclosures'
import { formatNumber } from '../../../core/format'
import { guidedOutcome, guidedTermsOf } from '../../../core/payoff/strategies'
import type { GuidedIntent, GuidedOutcome } from '../../../core/payoff/strategies'
import { Amount, Callout, Card, Marker } from '../../../ui'
import { OutcomeCards, WithWithoutChart, priceDomain } from '../../../viz'
import type { Outcome as OutcomeCard } from '../../../viz'
import {
  BREAKEVEN_HINT,
  CARDS_LABEL,
  FACT,
  INTENT_COPY,
  MAX_LOSS_HINT,
  NO_PREMIUM_NOTE,
  OUTCOME_HINT,
  OWN_PREMIUM_NOTE,
  READOUT_LABEL,
  SCENARIO,
  SLIDER_LABEL,
  THIRD_FACT,
  outcomeSentence,
} from './copy'
import type { FactWords, Words } from './copy'
import { scenarioPrices } from './terms'
import styles from './Outcome.module.css'

export interface OutcomeProps {
  intent: GuidedIntent
  /** The exact terms. They become display numbers here, once, for this hypothetical figure only. */
  qty: bigint
  strikeTotal: bigint
  /** Total premium, or null when no price is known: the figures then leave it out. */
  premium: bigint | null
  assetDecimals: number
  quoteDecimals: number
  /** The same terms as formatted text. */
  words: Words
  /** The reference price with its source, or null: `{ perUnit, label: 'Demo price', text: '99.40' }`. */
  reference: { perUnit: bigint; label: string; text: string } | null
  /** Where the premium comes from: a funded order, the user's own figure, or nowhere yet. */
  premiumSource: 'order' | 'own' | 'none'
}

const EVEN = 0.005
const num = (n: number) => formatNumber(n, { dp: 2 })

function differenceText(intent: GuidedIntent, difference: number, q: string): { direction: 'gain' | 'loss' | null; text: string } {
  const copy = INTENT_COPY[intent]
  if (Math.abs(difference) < EVEN) return { direction: null, text: `0.00 ${q}, ${copy.sameAs}` }
  return difference > 0
    ? { direction: 'gain', text: `${formatNumber(difference, { dp: 2, sign: true })} ${q} ${copy.moreThan}` }
    : { direction: 'loss', text: `${formatNumber(difference, { dp: 2, sign: true })} ${q} ${copy.lessThan}` }
}

/**
 * Block 4 of the guided flow: the with-and-without figure with its price handle, three prices as cards, and the
 * three figures that decide (breakeven, the most that can be lost, what is kept or given up). Every number here
 * is a hypothetical payoff from core/payoff/strategies; nothing is an amount that gets signed.
 */
export function Outcome({ intent, qty, strikeTotal, premium, assetDecimals, quoteDecimals, words, reference, premiumSource }: OutcomeProps) {
  const copy = INTENT_COPY[intent]
  const { a, q } = words
  const referencePerUnit = reference?.perUnit ?? null

  const model = useMemo(() => {
    const terms = guidedTermsOf(
      { underlying: { decimals: assetDecimals }, quote: { decimals: quoteDecimals }, underlyingQty: qty, totalStrike: strikeTotal, totalPremium: premium ?? 0n },
      referencePerUnit,
    )
    const entry = terms.entryPrice ?? null
    const at = (price: number) => guidedOutcome(intent, terms, price)
    const base = at(entry ?? terms.strike)
    const prices = scenarioPrices(terms.strike, entry, base.breakeven)
    const domain = priceDomain({ center: prices.mid, range: 0.12, include: [terms.strike, base.breakeven, prices.low, prices.high] })
    const curve = guidedOutcome(intent, terms, prices.mid, { from: domain[0], to: domain[1], steps: 80 }).curve
    return { terms, entry, at, base, prices, domain, points: curve.map((p) => ({ x: p.s, with: p.withValue, without: p.withoutValue })) }
  }, [intent, qty, strikeTotal, premium, assetDecimals, quoteDecimals, referencePerUnit])
  const { terms } = model

  const [picked, setPicked] = useState<number | null>(null)
  const price = picked ?? model.prices.mid

  const sentenceAt = (o: GuidedOutcome) => outcomeSentence(intent, o.exercised, { ...words, value: num(o.assetValue) })

  const cards: OutcomeCard[] = (
    [
      ['low', SCENARIO.low(a, num(model.prices.low))],
      ['mid', SCENARIO.mid(a, num(model.prices.mid), reference ? reference.label.toLowerCase() : null)],
      ['high', SCENARIO.high(a, num(model.prices.high))],
    ] as const
  ).map(([id, label]) => {
    const o = model.at(model.prices[id])
    const delta = differenceText(intent, o.difference, q)
    return {
      id,
      label,
      figure: num(o.withValue),
      unit: q,
      delta: { value: delta.direction === null ? 0 : o.difference, text: delta.text },
      sentence: sentenceAt(o),
      bar: { value: o.withValue, compare: o.withoutValue },
      current: Math.abs(price - model.prices[id]) < 1e-9,
    }
  })

  const facts: FactWords = {
    ...words,
    breakeven: num(model.base.breakeven),
    maxLoss: num(model.base.maxLoss),
    maxGain: model.base.maxGain === null ? null : num(model.base.maxGain),
    reference: reference ? `${reference.label.toLowerCase()} ${reference.text}` : null,
  }
  const third = THIRD_FACT[intent]
  const priced = premiumSource !== 'none'

  return (
    <div className={styles.root}>
      {premiumSource === 'none' ? <Callout variant="info">{NO_PREMIUM_NOTE}</Callout> : null}
      {premiumSource === 'own' && words.premium ? <Callout variant="info">{OWN_PREMIUM_NOTE(words.premium, q)}</Callout> : null}

      <Card padding="md" className={styles.chart}>
        <WithWithoutChart
          points={model.points}
          domain={model.domain}
          level={{ value: terms.strike, label: copy.level(words.strike) }}
          reference={reference && model.entry !== null ? { value: model.entry, label: `${reference.label} ${reference.text}` } : undefined}
          withLabel={copy.withLabel}
          withoutLabel={copy.withoutLabel}
          price={price}
          onPriceChange={setPicked}
          unit={q}
          asset={a}
          title={copy.chartTitle(words)}
          caption={PAYOFF_CAPTION}
          sliderLabel={SLIDER_LABEL(a)}
          valueText={(state) => {
            const o = model.at(state.price)
            return `${READOUT_LABEL(a, state.priceText)}. ${sentenceAt(o)} ${num(o.withValue)} ${q}: ${differenceText(intent, o.difference, q).text}.`
          }}
          readoutDifference={(state) => {
            const o = model.at(state.price)
            const delta = differenceText(intent, o.difference, q)
            return (
              <p className={styles.difference} data-direction={delta.direction ?? 'even'} data-testid="outcome-difference">
                {delta.direction ? (
                  <>
                    <Amount value={num(Math.abs(o.difference))} unit={q} direction={delta.direction} srLabel={`${num(Math.abs(o.difference))} ${q}`} />{' '}
                    <span>{delta.direction === 'gain' ? copy.moreThan : copy.lessThan}</span>
                  </>
                ) : (
                  <span>{delta.text}</span>
                )}
              </p>
            )
          }}
          readoutNote={(state) => (
            <p className={styles.sentence} data-testid="outcome-sentence">
              {sentenceAt(model.at(state.price))}
            </p>
          )}
        />
        <p className={styles.hint}>{OUTCOME_HINT}</p>
      </Card>

      <OutcomeCards outcomes={cards} onSelect={(id) => setPicked(model.prices[id as 'low' | 'mid' | 'high'])} barKey={{ value: copy.withLabel, compare: copy.withoutLabel }} label={CARDS_LABEL} />

      <dl className={styles.facts} data-count={priced ? 3 : 1}>
        {priced ? (
          <>
            <div className={styles.fact}>
              <dt>{FACT.breakeven}</dt>
              <dd>
                <span className={styles.factValue}>
                  <Marker>
                    {facts.breakeven} {q}
                  </Marker>
                </span>
                <span className={styles.factHint}>{BREAKEVEN_HINT[intent](facts)}</span>
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>{FACT.maxLoss}</dt>
              <dd>
                <span className={styles.factValue}>
                  {facts.maxLoss} {q}
                </span>
                <span className={styles.factHint}>{MAX_LOSS_HINT[intent](facts)}</span>
              </dd>
            </div>
          </>
        ) : null}
        <div className={styles.fact}>
          <dt>{third.label}</dt>
          <dd>
            <span className={styles.factValue}>{third.value(words)}</span>
            <span className={styles.factHint}>{third.hint(facts)}</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
