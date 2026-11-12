import { Link as RouterLink } from '@tanstack/react-router'
import type { Intent } from '../../../app/search'
import { PAYOFF_CAPTION } from '../../../core/disclosures'
import { formatMoney, formatUnits } from '../../../core/format'
import { strikeUnits } from '../../../core/units'
import { Amount, Glyph, Link } from '../../../ui'
import type { PayoffGlyph } from '../../../ui'
import { WithWithoutChart } from '../../../viz'
import { INTENTS, SECTION } from '../copy'
import { RECORDED_CALL, RECORDED_PUT } from '../recorded'
import { intentFigure } from './intentFigure'
import { Section } from './Section'
import css from './Intents.module.css'

interface Plate {
  intent: Intent
  glyph: PayoffGlyph
  figure: ReturnType<typeof intentFigure>
  asset: string
  quote: string
  withLabel: string
  level: string
  figureCaption: string
  /** The premium the recorded example paid or was paid, for the one row under the figure. */
  premium: string
}

const put = RECORDED_PUT
const call = RECORDED_CALL
const money = formatMoney
const perUnit = (o: typeof put | typeof call) => money(strikeUnits(o) ?? 0n, o.quote)

const floor = intentFigure('floor', put)
const earnHold = intentFigure('earn-hold', call)
const earnBuy = intentFigure('earn-buy', put)

/** The recorded options behind the three figures. Computed once: nothing here changes at run time. */
const PLATES: Record<(typeof INTENTS.items)[number]['id'], Plate> = {
  floor: {
    intent: 'floor',
    glyph: 'long-put',
    figure: floor,
    asset: put.underlying.code,
    quote: put.quote.code,
    withLabel: INTENTS.floorWith,
    level: INTENTS.floorLevel(floor.strikeText),
    figureCaption: INTENTS.floorFigure(money(put.underlyingQty, put.underlying), perUnit(put)),
    premium: formatUnits(put.totalPremium, put.quote.decimals),
  },
  'earn-hold': {
    intent: 'earn-hold',
    glyph: 'short-call',
    figure: earnHold,
    asset: call.underlying.code,
    quote: call.quote.code,
    withLabel: INTENTS.earnHoldWith,
    level: INTENTS.capLevel(earnHold.strikeText),
    figureCaption: INTENTS.earnHoldFigure(money(call.underlyingQty, call.underlying), perUnit(call)),
    premium: formatUnits(call.totalPremium, call.quote.decimals),
  },
  'earn-buy': {
    intent: 'earn-buy',
    glyph: 'short-put',
    figure: earnBuy,
    asset: put.underlying.code,
    quote: put.quote.code,
    withLabel: INTENTS.earnBuyWith,
    level: INTENTS.buyLevel(earnBuy.strikeText),
    figureCaption: INTENTS.earnBuyFigure(money(put.totalStrike, put.quote), perUnit(put)),
    premium: formatUnits(put.totalPremium, put.quote.decimals),
  },
}

/**
 * Three uses, each one recorded option seen from one side. Each name is the link into Markets on that intent. The
 * payoff caption is said once under the row; each figure still carries it for a screen reader.
 */
export function Intents() {
  return (
    <Section id={SECTION.intents} heading={INTENTS.heading} layout="stack">
      <ul className={css.list} role="list">
        {INTENTS.items.map((item) => {
          const plate = PLATES[item.id]
          return (
            <li key={item.id} className={css.item}>
              <h3 className={css.name}>
                <Glyph name={plate.glyph} size={16} className={css.glyph} />
                <Link
                  tone="ink"
                  className={css.nameLink}
                  aria-label={`${item.name}${INTENTS.linkContext}`}
                  render={<RouterLink to="/markets" search={{ intent: plate.intent }} />}
                >
                  {item.name}
                </Link>
              </h3>
              <p className={css.statement}>{item.statement}</p>
              <WithWithoutChart
                className={css.figure}
                points={plate.figure.points}
                domain={plate.figure.domain}
                level={{ value: plate.figure.strike, label: plate.level }}
                withLabel={plate.withLabel}
                withoutLabel={INTENTS.without}
                readOnly
                readout={false}
                unit={plate.quote}
                asset={plate.asset}
                title={INTENTS.chartTitle(item.name)}
                caption={
                  <>
                    {plate.figureCaption}
                    <span className="ui-vh"> {PAYOFF_CAPTION}</span>
                  </>
                }
                height={184}
              />
              <dl className={css.facts}>
                <div className={css.fact}>
                  <dt>{item.flowLabel}</dt>
                  <dd>
                    <Amount value={plate.premium} unit={plate.quote} />
                  </dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
      <p className={css.note} aria-hidden="true">
        {PAYOFF_CAPTION}
      </p>
    </Section>
  )
}
