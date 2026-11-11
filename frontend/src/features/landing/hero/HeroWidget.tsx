// The floor widget: a contract note that answers "what do I get, and what does it cost" with the terms of one
// real put. It opens on the recorded option (a past Testnet option, labelled as such) and, once the lazy chunk
// has read the book, shows the best open offer instead. It never needs the data layer itself: `live` is plain data.
import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PAYOFF_CAPTION } from '../../../core/disclosures'
import { explorerAddress, explorerTx, isMockId } from '../../../core/explorer'
import { formatMoney, formatUnits, formatUtc, formatUtcDay, formatUtcTime, groupDigits, isoUtc, plural } from '../../../core/format'
import { Address, announce, Button, ButtonLink, ContractNote, Link, useIsPhone } from '../../../ui'
import { WithWithoutChart } from '../../../viz'
import { WIDGET } from '../copy'
import { RECORDED_PUT, RECORDED_PUT_TX } from '../recorded'
import type { LivePick, LiveState } from '../live/types'
import { floorFigure, floorOutcome } from './floor'
import type { FloorFigure, FloorTerms } from './floor'
import { TermSelect, TermValue } from './Term'
import css from './HeroWidget.module.css'

export interface HeroWidgetProps {
  /** Null until the lazy chunk has reported: the widget then shows the recorded option. */
  live: LiveState | null
  onPick: (pick: LivePick) => void
}


const serialOf = (id: bigint): string => id.toString().padStart(6, '0')
const ledgerText = (ledger: number): string => groupDigits(String(ledger))

interface BodyProps {
  figure: FloorFigure
  terms: FloorTerms
  reference: { value: number; label: string } | undefined
  height: number
}

/** The chart and the two outcome figures. Keyed by the option, so a new option starts at its own price. */
function FloorBody({ figure, terms, reference, height }: BodyProps) {
  const [price, setPrice] = useState(figure.startPrice)
  const code = terms.underlying.code
  const quote = terms.quote.code
  const outcome = floorOutcome(figure, price)
  const verdict =
    outcome.direction === 'more' ? WIDGET.more(outcome.differenceText, quote) : outcome.direction === 'less' ? WIDGET.less(outcome.differenceText, quote) : WIDGET.same

  return (
    <>
      <WithWithoutChart
        className={css.chart}
        points={figure.points}
        domain={figure.domain}
        level={{ value: figure.strike, label: WIDGET.floorLevel(figure.text.strike) }}
        reference={reference}
        withLabel={WIDGET.withLabel}
        withoutLabel={WIDGET.withoutLabel}
        price={price}
        onPriceChange={setPrice}
        step={figure.step}
        largeStep={figure.largeStep}
        unit={quote}
        asset={code}
        title={WIDGET.chartTitle(figure.text.qty, code, figure.text.strike)}
        caption={
          <>
            {WIDGET.figure(1)} {PAYOFF_CAPTION}
          </>
        }
        readout={false}
        valueText={(state) => {
          const o = floorOutcome(figure, state.price)
          const said = o.direction === 'more' ? WIDGET.more(o.differenceText, quote) : o.direction === 'less' ? WIDGET.less(o.differenceText, quote) : WIDGET.same
          return WIDGET.valueText(code, o.priceText, o.withText, o.withoutText, quote, said)
        }}
        xLabel={WIDGET.xLabel(code, quote)}
        sliderLabel={WIDGET.slider(code)}
        height={height}
      />
      <dl className={css.outcomes}>
        <div className={css.outcome}>
          <dt className={css.outcomeLabel}>{WIDGET.ifPrice(code, outcome.priceText)}</dt>
          <dd className={css.outcomeFigure} data-testid="hero-with">
            {outcome.withText} <span className={css.outcomeUnit}>{quote}</span>
          </dd>
          <dd className={css.outcomeNote}>
            {outcome.exercised
              ? WIDGET.sellAtFloor(figure.text.qty, figure.text.strike, figure.text.premium)
              : WIDGET.keepAsset(figure.text.qty, code, outcome.withoutText, figure.text.premium)}
          </dd>
        </div>
        <div className={css.outcome}>
          <dt className={css.outcomeLabel}>{WIDGET.without}</dt>
          <dd className={css.outcomeFigure} data-secondary="true" data-testid="hero-without">
            {outcome.withoutText} <span className={css.outcomeUnit}>{quote}</span>
          </dd>
          <dd className={css.outcomeNote}>
            <span className={css.verdict} data-direction={outcome.direction}>
              {outcome.direction === 'same' ? null : (
                <span className={css.triangle} aria-hidden="true">
                  {outcome.direction === 'more' ? '▲' : '▼'}
                </span>
              )}
              {verdict}
            </span>{' '}
            {WIDGET.estimate}
          </dd>
        </div>
      </dl>
    </>
  )
}

export function HeroWidget({ live, onPick }: HeroWidgetProps) {
  const phone = useIsPhone()
  const open = live?.status === 'open' ? live : null
  const offer = open?.offer ?? null
  const choices = open?.choices ?? null
  const terms: FloorTerms = offer ?? RECORDED_PUT
  const referenceUnits = offer?.reference?.perUnit ?? null
  const figure = useMemo(() => floorFigure(terms, referenceUnits), [terms, referenceUnits])

  // Say once that the example changed under the reader.
  const announced = useRef(false)
  useEffect(() => {
    if (offer && !announced.current) {
      announced.current = true
      announce(WIDGET.announceOpen)
    }
  }, [offer])

  const q = terms.quote
  const code = terms.underlying.code
  const reference =
    offer?.reference != null
      ? { value: Number(offer.reference.perUnit) / 10 ** q.decimals, label: `${offer.reference.label} ${formatUnits(offer.reference.perUnit, q.decimals)}` }
      : undefined

  const untilDay = formatUtcDay(terms.expiry)
  const untilRest = offer ? formatUtcTime(terms.expiry) : `${new Date(terms.expiry * 1000).getUTCFullYear()}, ${formatUtcTime(terms.expiry)}`
  const until = <time dateTime={isoUtc(terms.expiry)}>{untilDay}</time>

  const aside = offer ? (offer.source === 'resale' ? WIDGET.resaleAside : live?.mock ? WIDGET.openAsideMock : WIDGET.openAside) : WIDGET.recordedAside

  return (
    <div className={css.root} data-state={offer ? 'open' : 'recorded'} data-testid="hero-widget" aria-busy={live?.status === 'loading' || undefined}>
      <ContractNote
        className={css.note}
        serialLabel={offer ? WIDGET.serialOffer : WIDGET.serialOption}
        serial={serialOf(offer ? offer.id : RECORDED_PUT.id)}
        ledger={offer ? (live?.ledger != null ? ledgerText(live.ledger) : undefined) : ledgerText(RECORDED_PUT_TX.write.ledger)}
        state={offer ? (offer.source === 'resale' ? 'Active' : 'Offered') : 'Settled'}
        glyph="long-put"
        kind={WIDGET.heading(code)}
        headingLevel={2}
        aside={<span data-testid="hero-aside">{aside}</span>}
        printing={offer !== null}
        footer={<Source live={live} />}
      >
        {offer && choices ? (
          <div className={css.terms} role="group" aria-label={WIDGET.termsLabel}>
            <TermSelect
              label={WIDGET.hold}
              value={choices.assetId}
              onChange={(assetId) => onPick({ assetId })}
              options={choices.assets.map((a) => ({ value: a.id, label: a.typeLabel ? WIDGET.assetOption(a.code, a.typeLabel) : a.code }))}
              figure={figure.text.qty}
              unit={code}
            />
            <TermSelect
              label={WIDGET.floor}
              value={offer.strikePerUnit.toString()}
              onChange={(strike) => onPick({ assetId: choices.assetId, expiry: offer.expiry, strike: BigInt(strike) })}
              options={choices.strikes.map((s) => ({
                value: s.value.toString(),
                label:
                  s.perUnit === null
                    ? formatMoney(s.value, q)
                    : WIDGET.floorOption(formatMoney(s.value, q), formatUnits(s.perUnit, q.decimals)),
              }))}
              figure={figure.text.strike}
              unit={q.code}
              marked
            />
            <TermSelect
              label={WIDGET.until}
              value={String(offer.expiry)}
              onChange={(expiry) => onPick({ assetId: choices.assetId, strike: offer.strikePerUnit, expiry: Number(expiry) })}
              options={choices.expiries.map((e) => ({ value: String(e), label: formatUtc(e) }))}
              figure={until}
              unit={untilRest}
            />
          </div>
        ) : (
          <dl className={css.terms} aria-label={WIDGET.termsLabel}>
            <TermValue label={WIDGET.hold} figure={figure.text.qty} unit={code} />
            <TermValue label={WIDGET.floor} figure={figure.text.strike} unit={q.code} marked />
            <TermValue label={WIDGET.until} figure={until} unit={untilRest} />
          </dl>
        )}
        <p className={css.meta} data-testid="hero-meta">
          {offer ? WIDGET.premiumLine(figure.text.premium, figure.text.premiumPerUnit, q.code) : WIDGET.recordedLot(figure.text.premium, q.code)}
          {offer && choices?.movedFrom != null ? (
            <span className={css.moved}> {WIDGET.moved(formatUnits(choices.movedFrom, q.decimals), untilDay, figure.text.strike)}</span>
          ) : null}
        </p>
        <FloorBody key={offer ? `${offer.source}-${offer.id}` : 'recorded'} figure={figure} terms={terms} reference={reference} height={phone ? 208 : 216} />
      </ContractNote>
      <p className={css.under}>{WIDGET.captionExtra}</p>
    </div>
  )
}

/** The foot of the note: where the terms come from, and the one thing to do next. */
function Source({ live }: { live: LiveState | null }) {
  if (live?.status === 'open') {
    const { offer, mock, ledger } = live
    const amount = formatMoney(offer.collateral, offer.quote)
    const resale = offer.source === 'resale'
    return (
      <>
        <p className={css.source} data-testid="hero-source">
          <Address
            value={offer.seller}
            name={resale ? WIDGET.holder : WIDGET.maker}
            explorerUrl={isMockId(offer.seller) ? undefined : explorerAddress(offer.seller)}
            copyLabel={null}
          />{' '}
          {resale
            ? WIDGET.sourceResale(amount)
            : mock
              ? WIDGET.sourceOpenMock(amount)
              : ledger != null
                ? WIDGET.sourceOpenLive(amount, ledgerText(ledger))
                : WIDGET.sourceOpenNoLedger(amount)}
        </p>
        <ButtonLink render={<RouterLink to="/markets/$asset" params={{ asset: offer.assetParam }} search={offer.ticketSearch} />}>
          {WIDGET.open}
        </ButtonLink>
      </>
    )
  }
  if (live?.status === 'none') {
    const at = live.ledger != null ? ledgerText(live.ledger) : null
    const others = live.openOffers
    return (
      <>
        <p className={css.source} data-testid="hero-source">
          {others > 0
            ? `${WIDGET.noStandardPut(at)} ${plural(others, { one: WIDGET.otherOffers.one, other: WIDGET.otherOffers.other(groupDigits(String(others))) })}`
            : WIDGET.noOffer(at)}{' '}
          {WIDGET.stillRecorded}
        </p>
        {others > 0 ? (
          <ButtonLink render={<RouterLink to="/markets" />}>{WIDGET.markets}</ButtonLink>
        ) : (
          <ButtonLink render={<RouterLink to="/requests" search={{ new: '1' }} />}>{WIDGET.request}</ButtonLink>
        )}
      </>
    )
  }
  if (live?.status === 'error') {
    return (
      <>
        <p className={css.source} data-testid="hero-source">
          {WIDGET.error}
        </p>
        <Button onClick={live.retry}>
          {WIDGET.retry}
        </Button>
      </>
    )
  }
  return (
    <>
      <p className={css.source} data-testid="hero-source">
        {WIDGET.sourceRecorded(ledgerText(RECORDED_PUT_TX.exercise.ledger), formatMoney(RECORDED_PUT.totalStrike, RECORDED_PUT.quote))}
      </p>
      <Link external href={explorerTx(RECORDED_PUT_TX.exercise.hash)} className={css.sourceLink}>
        {WIDGET.sourceRecordedLink}
      </Link>
    </>
  )
}
