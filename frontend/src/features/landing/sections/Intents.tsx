import { Link as RouterLink } from '@tanstack/react-router'
import type { Intent } from '../../../app/search'
import { PAYOFF_CAPTION } from '../../../core/disclosures'
import { explorerTx } from '../../../core/explorer'
import { formatMoney, formatUtc } from '../../../core/format'
import { strikeUnits } from '../../../core/units'
import { Glyph, Link, TxLink } from '../../../ui'
import type { PayoffGlyph } from '../../../ui'
import { WithWithoutChart } from '../../../viz'
import { INTENTS, SECTION, WIDGET } from '../copy'
import { RECORDED_CALL, RECORDED_CALL_TX, RECORDED_PUT, RECORDED_PUT_TX } from '../recorded'
import { intentFigure } from './intentFigure'
import { Section } from './Section'
import css from './Intents.module.css'

interface Plate {
  intent: Intent
  glyph: PayoffGlyph
  figureNo: number
  figure: ReturnType<typeof intentFigure>
  asset: string
  quote: string
  withLabel: string
  level: string
  figureCaption: string
  example: string
  tx: string
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
    figureNo: 2,
    figure: floor,
    asset: put.underlying.code,
    quote: put.quote.code,
    withLabel: INTENTS.floorWith,
    level: INTENTS.floorLevel(floor.strikeText),
    figureCaption: INTENTS.floorFigure(money(put.underlyingQty, put.underlying), perUnit(put)),
    example: INTENTS.floorExample(money(put.totalPremium, put.quote), formatUtc(put.expiry), money(put.underlyingQty, put.underlying), money(put.totalStrike, put.quote)),
    tx: RECORDED_PUT_TX.buy.hash,
  },
  'earn-hold': {
    intent: 'earn-hold',
    glyph: 'short-call',
    figureNo: 3,
    figure: earnHold,
    asset: call.underlying.code,
    quote: call.quote.code,
    withLabel: INTENTS.earnHoldWith,
    level: INTENTS.capLevel(earnHold.strikeText),
    figureCaption: INTENTS.earnHoldFigure(money(call.underlyingQty, call.underlying), perUnit(call)),
    example: INTENTS.earnHoldExample(money(call.underlyingQty, call.underlying), money(call.totalPremium, call.quote), money(call.totalStrike, call.quote)),
    tx: RECORDED_CALL_TX.write.hash,
  },
  'earn-buy': {
    intent: 'earn-buy',
    glyph: 'short-put',
    figureNo: 4,
    figure: earnBuy,
    asset: put.underlying.code,
    quote: put.quote.code,
    withLabel: INTENTS.earnBuyWith,
    level: INTENTS.buyLevel(earnBuy.strikeText),
    figureCaption: INTENTS.earnBuyFigure(money(put.totalStrike, put.quote), perUnit(put)),
    example: INTENTS.earnBuyExample(money(put.totalStrike, put.quote), money(put.totalPremium, put.quote), money(put.underlyingQty, put.underlying)),
    tx: RECORDED_PUT_TX.write.hash,
  },
}

export function Intents() {
  return (
    <Section id={SECTION.intents} heading={INTENTS.heading} lead={INTENTS.lead} layout="stack">
      <ul className={css.list} role="list">
        {INTENTS.items.map((item) => {
          const plate = PLATES[item.id]
          return (
            <li key={item.id} className={css.item}>
              <h3 className={css.name}>
                <Glyph name={plate.glyph} size={16} className={css.glyph} />
                {item.name}
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
                    {WIDGET.figure(plate.figureNo)} {plate.figureCaption} {PAYOFF_CAPTION}
                  </>
                }
                height={184}
              />
              <dl className={css.facts}>
                <div className={css.fact}>
                  <dt>{item.flowLabel}</dt>
                  <dd>{item.flow}</dd>
                </div>
                <div className={css.fact}>
                  <dt>{INTENTS.recordedLabel}</dt>
                  <dd>
                    {plate.example} <TxLink hash={plate.tx} explorerUrl={explorerTx(plate.tx)} />
                  </dd>
                </div>
              </dl>
              <Link className={css.action} render={<RouterLink to="/markets" search={{ intent: plate.intent }} />}>
                {item.action}
                <span className="ui-vh">{item.actionContext}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className={css.after}>{INTENTS.afterNote}</p>
      <p className={css.fourth}>{INTENTS.fourth}</p>
    </Section>
  )
}
