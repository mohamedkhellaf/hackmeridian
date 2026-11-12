import { PAYOFF_CAPTION } from '../../../core/disclosures'
import { formatExact, formatUnits } from '../../../core/format'
import { definitionOf } from '../../../core/glossary'
import { breakevenPerUnit, mostYouCanLose, premiumPerUnit } from '../../../core/payoff/leg'
import type { GuidedOutcome } from '../../../core/payoff/strategies'
import type { OptionKind } from '../../../core/options/types'
import { Amount, Card, KeyValue, KeyValueItem, Term, VisuallyHidden } from '../../../ui'
import { OutcomeCards, WithWithoutChart } from '../../../viz'
import type { Outcome as OutcomeCard } from '../../../viz'
import { CARDS_LABEL, FACT, GIVE_UP, INTENT_COPY, MAX_LOSS_HINT, READOUT_LABEL, SCENARIO, SLIDER_LABEL, outcomeSentence } from './copy'
import type { FactWords } from './copy'
import { differenceText, num } from './useOutcome'
import type { OutcomeView } from './useOutcome'
import styles from './Outcome.module.css'

const sentenceAt = (view: OutcomeView, o: GuidedOutcome) => outcomeSentence(view.input.intent, o.exercised, { ...view.words, value: num(o.assetValue) })

/** Two prices at the deadline, a lower and a higher one (E11): what the user would hold at each, as cards. */
export function OutcomeCardsBlock({ view }: { view: OutcomeView }) {
  const { intent, words } = view.input
  const cards: OutcomeCard[] = (
    [
      ['low', SCENARIO.low(words.a, num(view.prices.low))],
      ['high', SCENARIO.high(words.a, num(view.prices.high))],
    ] as const
  ).map(([id, label]) => {
    const o = view.at(view.prices[id])
    const delta = differenceText(intent, o.difference, words.q)
    return {
      id,
      label,
      figure: num(o.withValue),
      unit: words.q,
      delta: { value: delta.direction === null ? 0 : o.difference, text: delta.text },
      sentence: sentenceAt(view, o),
      current: Math.abs(view.price - view.prices[id]) < 1e-9,
    }
  })
  return (
    <div className={styles.cards}>
      <OutcomeCards outcomes={cards} onSelect={(id) => view.setPrice(view.prices[id as 'low' | 'high'])} label={CARDS_LABEL} />
      <VisuallyHidden>{PAYOFF_CAPTION}</VisuallyHidden>
    </div>
  )
}

export interface OutcomeDetailProps {
  view: OutcomeView
  kind: OptionKind
  side: 'buy' | 'write'
}

/**
 * The with-and-without figure with its price handle across the column, and under it, as one ruled row, the two
 * figures the ticket prints too: Breakeven and Most you can lose, from core/payoff/leg (a written covered call
 * has no loss figure; it says what is given up). Every number in the figure is a hypothetical payoff from
 * core/payoff/strategies. The read-out gives the two figures and their difference; the sentence for the price
 * is read out with the handle, and the cards above already say it in words.
 */
export function OutcomeDetail({ view, kind, side }: OutcomeDetailProps) {
  const { intent, words, asset, quote, qty, strikeTotal, premium, reference } = view.input
  const copy = INTENT_COPY[intent]
  const { a, q } = words
  const money = (n: bigint) => formatUnits(n, quote.decimals)
  const leg = { kind, underlying: asset, quote, underlyingQty: qty, totalStrike: strikeTotal, totalPremium: premium }
  const breakeven = breakevenPerUnit(leg)
  const loss = mostYouCanLose(leg, side === 'buy' ? 'long' : 'short')
  const perUnitPremium = premiumPerUnit(leg)
  const facts: FactWords = { ...words, premiumPerUnit: perUnitPremium !== null ? money(perUnitPremium) : '' }
  const amount = (n: bigint) => <Amount value={money(n)} exact={formatExact(n, quote.decimals)} unit={q} figure="serif" />

  return (
    <div className={styles.detail}>
      <Card padding="md" className={styles.chart}>
        <WithWithoutChart
          points={view.points}
          domain={view.domain}
          level={{ value: view.strike, label: copy.level(words.strike) }}
          reference={reference && view.entry !== null ? { value: view.entry, label: `${reference.label} ${reference.text}` } : undefined}
          withLabel={copy.withLabel}
          withoutLabel={copy.withoutLabel}
          price={view.price}
          onPriceChange={view.setPrice}
          unit={q}
          asset={a}
          title={copy.chartTitle(words)}
          caption={PAYOFF_CAPTION}
          sliderLabel={SLIDER_LABEL(a)}
          valueText={(state) => {
            const o = view.at(state.price)
            return `${READOUT_LABEL(a, state.priceText)}. ${sentenceAt(view, o)} ${num(o.withValue)} ${q}: ${differenceText(intent, o.difference, q).text}.`
          }}
          readoutDifference={(state) => {
            const delta = differenceText(intent, view.at(state.price).difference, q)
            return (
              <p className={styles.difference} data-direction={delta.direction ?? 'even'} data-testid="outcome-difference">
                {delta.text}
              </p>
            )
          }}
        />
      </Card>
      <KeyValue className={styles.facts} layout="stacked" variant="plain">
        {breakeven !== null ? (
          <KeyValueItem label={<Term definition={definitionOf('breakeven')}>{FACT.breakeven}</Term>}>{amount(breakeven)}</KeyValueItem>
        ) : null}
        {intent === 'earn-hold' ? (
          <KeyValueItem label={FACT.giveUp} hint={GIVE_UP.hint(words)}>
            {GIVE_UP.value(words)}
          </KeyValueItem>
        ) : loss !== null ? (
          <KeyValueItem label={FACT.maxLoss} hint={MAX_LOSS_HINT[intent](facts)}>
            {amount(loss.amount)}
          </KeyValueItem>
        ) : null}
      </KeyValue>
    </div>
  )
}
