import { Link as RouterLink } from '@tanstack/react-router'
import { PAYOFF_CAPTION } from '../../core/disclosures'
import type { GuidedIntent } from '../../core/payoff/strategies'
import { Card, ContractNote, DateTime, Link } from '../../ui'
import type { NoteTerm, PayoffGlyph } from '../../ui'
import { OutcomeCards, PayoffChart, WithWithoutChart } from '../../viz'
import { EXAMPLE_SERIAL_LABEL, INTENT_COPY, OUTCOMES_LABEL, TERM_LABELS, exampleSerial, premiumPerUnit, scenarioDelta, scenarioLabel } from './content'
import type { WorkedExample } from './examples'
import css from './IntentExample.module.css'

const GLYPH: Record<GuidedIntent, PayoffGlyph> = {
  floor: 'long-put',
  'earn-hold': 'short-call',
  'earn-buy': 'short-put',
  'lock-buy': 'long-call',
}

/** A little taller than the kit's default, so the figure keeps pace with the note beside it. */
const CHART_HEIGHT = 280

export interface IntentExampleProps {
  example: WorkedExample
  /** Position in the series, from 1, and its length: printed on the note as "Example 1 of 4". */
  index: number
  total: number
  /** The example deadline, in unix seconds, and its canonical UTC text. */
  deadline: number
  deadlineText: string
}

/**
 * One intent as a worked example: what you do in a sentence, the deal in exact figures, the terms as a contract
 * note, the payoff figure with its caption, and three outcomes that say who acts.
 */
export function IntentExample({ example: x, index, total, deadline, deadlineText }: IntentExampleProps) {
  const copy = INTENT_COPY[x.intent]
  const unit = x.quoteCode

  const terms: NoteTerm[] = [
    { label: TERM_LABELS.quantity, value: x.qtyText },
    { label: copy.strikeLabel(x), value: `${x.strikePerUnitText} ${unit}`, marked: true },
    { label: copy.premiumLabel, value: x.premiumText, hint: premiumPerUnit(x) },
    { label: copy.collateralLabel, value: x.collateralText },
    { label: TERM_LABELS.deadline, value: <DateTime value={deadline * 1000} local="below" /> },
    { label: copy.breakevenLabel(x), value: `${x.breakevenText} ${unit}`, hint: copy.breakevenHint },
    { label: TERM_LABELS.maxLoss, value: `${x.maxLossText} ${unit}`, hint: copy.maxLossHint(x) },
    {
      label: TERM_LABELS.maxGain,
      value: x.maxGainText === null ? TERM_LABELS.noCap : `${x.maxGainText} ${unit}`,
      hint: copy.maxGainHint(x),
    },
  ]

  const chart =
    x.starts === 'asset' ? (
      <WithWithoutChart
        title={copy.chartTitle(x)}
        points={x.curve.map((p) => ({ x: p.s, with: p.withValue, without: p.withoutValue }))}
        domain={x.domain}
        level={copy.levelLabel ? { value: x.strike, label: copy.levelLabel(x) } : undefined}
        withLabel={copy.withLabel}
        withoutLabel={copy.withoutLabel}
        defaultPrice={copy.openAt}
        unit={unit}
        asset={x.assetCode}
        height={CHART_HEIGHT}
        caption={PAYOFF_CAPTION}
      />
    ) : (
      <PayoffChart
        title={copy.chartTitle(x)}
        points={x.curve.map((p) => ({ x: p.s, y: p.payoff }))}
        domain={x.domain}
        strike={{ value: x.strike, label: x.strikePerUnitText }}
        breakevens={[{ value: x.breakeven, label: x.breakevenText }]}
        maxGain={x.maxGainText === null ? { value: Infinity } : { value: x.maxGain ?? 0, label: x.maxGainText }}
        maxLoss={{ value: x.maxLoss, label: x.maxLossText, at: x.side === 'write' ? 0 : undefined }}
        defaultPrice={copy.openAt}
        unit={unit}
        asset={x.assetCode}
        height={CHART_HEIGHT}
        caption={PAYOFF_CAPTION}
      />
    )

  return (
    <div className={css.root} data-intent={x.intent}>
      <div className={css.lead}>
        <h3 className={css.name}>{x.name}</h3>
        <p className={css.statement}>
          {copy.statement} {copy.contract}
        </p>
        <p className={css.deal}>{copy.deal(x, deadlineText)}</p>
      </div>
      <div className={css.pair}>
        <ContractNote
          className={css.note}
          serialLabel={EXAMPLE_SERIAL_LABEL}
          serial={exampleSerial(index, total)}
          glyph={GLYPH[x.intent]}
          kind={copy.position(x)}
          headingLevel={4}
          terms={terms}
          footer={<Link render={<RouterLink to="/markets" search={{ intent: x.intent }} />}>{copy.action}</Link>}
        />
        <div className={css.figure}>
          <Card as="div" className={css.sheet}>
            {chart}
          </Card>
          <p className={css.trade}>{copy.trade(x)}</p>
        </div>
      </div>
      <OutcomeCards
        className={css.outcomes}
        label={`${x.name}: ${OUTCOMES_LABEL}`}
        outcomes={x.scenarios.map((s) => ({
          id: s.id,
          label: scenarioLabel(x, s),
          figure: s.withText,
          unit,
          delta: { value: s.difference, text: scenarioDelta(x, s) },
          sentence: copy.outcome(x, s),
        }))}
      />
    </div>
  )
}
