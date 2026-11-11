import { Link as RouterLink } from '@tanstack/react-router'
import { PAYOFF_CAPTION } from '../../core/disclosures'
import type { GuidedIntent } from '../../core/payoff/strategies'
import { ButtonLink, Card, ContractNote, DateTime } from '../../ui'
import type { NoteTerm, PayoffGlyph } from '../../ui'
import { OutcomeCards, WithWithoutChart } from '../../viz'
import { INTENT_COPY, OUTCOMES_LABEL, OUTCOMES_TITLE, TERM_LABELS, breakevenLabel, premiumPerUnit, scenarioDelta, scenarioLabel } from './content'
import { Disclosure } from './Disclosure'
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
  /** The example deadline, in unix seconds, and its canonical UTC text. */
  deadline: number
  deadlineText: string
  /** Open when the page loads: the first example only. */
  defaultOpen?: boolean
}

/**
 * One intent as a worked example, in a disclosure. Closed, it reads as the intent's name and what it does. Open:
 * the deal in exact figures, the terms on a note, the with-and-without figure the guided page draws (captioned
 * with the required sentence), what it costs, three outcomes, and the way into Markets.
 */
export function IntentExample({ example: x, deadline, deadlineText, defaultOpen = false }: IntentExampleProps) {
  const copy = INTENT_COPY[x.intent]
  const unit = x.quoteCode

  const terms: NoteTerm[] = [
    { label: TERM_LABELS.quantity, value: x.qtyText },
    { label: copy.strikeLabel(x), value: `${x.strikePerUnitText} ${unit}` },
    { label: copy.premiumLabel, value: x.premiumText, hint: premiumPerUnit(x) },
    { label: copy.collateralLabel, value: x.collateralText },
    { label: TERM_LABELS.deadline, value: <DateTime value={deadline * 1000} local="below" /> },
    { label: breakevenLabel(x), value: `${x.breakevenText} ${unit}` },
    copy.givesUp
      ? { label: TERM_LABELS.givesUp, value: copy.givesUp.value(x), hint: copy.givesUp.hint(x) }
      : { label: TERM_LABELS.maxLoss, value: `${x.maxLossText} ${unit}`, hint: copy.maxLossHint?.(x) },
    {
      label: TERM_LABELS.maxGain,
      value: x.maxGainText === null ? TERM_LABELS.noCap : `${x.maxGainText} ${unit}`,
      hint: copy.maxGainHint?.(x),
    },
  ]

  // The content model of `summary` allows a heading and phrasing content, so the two sit in the row directly.
  const summary = (
    <>
      <h3 className={css.name}>{x.name}</h3>
      <span className={css.statement}>
        {copy.statement} {copy.contract}
      </span>
    </>
  )

  return (
    <Disclosure className={css.root} summaryClassName={css.summary} bodyClassName={css.body} summary={summary} defaultOpen={defaultOpen} data-intent={x.intent}>
      <p className={css.deal}>{copy.deal(x, deadlineText)}</p>
      <div className={css.pair}>
        <ContractNote className={css.note} plain glyph={GLYPH[x.intent]} kind={copy.position(x)} headingLevel={4} terms={terms} />
        <div className={css.figure}>
          <Card as="div" className={css.sheet}>
            <WithWithoutChart
              title={copy.chartTitle(x)}
              points={x.curve.map((p) => ({ x: p.s, with: p.withValue, without: p.withoutValue }))}
              domain={x.domain}
              level={{ value: x.strike, label: copy.levelLabel(x) }}
              withLabel={copy.withLabel}
              withoutLabel={copy.withoutLabel}
              defaultPrice={copy.openAt}
              unit={unit}
              asset={x.assetCode}
              height={CHART_HEIGHT}
              caption={PAYOFF_CAPTION}
            />
          </Card>
          <p className={css.trade}>{copy.trade(x)}</p>
        </div>
      </div>
      <h4 className={css.outcomesTitle}>{OUTCOMES_TITLE}</h4>
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
      <p className={css.action}>
        <ButtonLink variant="secondary" render={<RouterLink to="/markets" search={{ intent: x.intent }} />}>
          {copy.action}
        </ButtonLink>
      </p>
    </Disclosure>
  )
}
