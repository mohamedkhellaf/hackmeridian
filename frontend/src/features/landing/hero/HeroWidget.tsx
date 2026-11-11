// The floor widget: a contract note that answers "what do I get, and what does it cost" with the terms of one
// real put. It opens on the recorded option (a past Testnet option, labelled as such) and, once the lazy chunk
// has read the book, shows the best open offer instead. It never needs the data layer itself: `live` is plain data.
//
// Nothing moves by itself (DESIGN.md principle 6): the swap from the recorded option to the open offer waits while
// the visitor points at or works in the note, the chart is never remounted (focus and a dragged price survive a
// change of terms), and the note does not play the "print" of a confirmed trade.
import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FocusEvent } from 'react'
import { PAYOFF_CAPTION } from '../../../core/disclosures'
import { explorerAddress, explorerTx, isMockId } from '../../../core/explorer'
import { formatMoney, formatUnits, formatUtc, formatUtcDay, formatUtcTime, groupDigits, isoUtc, plural } from '../../../core/format'
import { Address, announce, Button, ButtonLink, ContractNote, Link, Marker, useIsPhone } from '../../../ui'
import { WithWithoutChart } from '../../../viz'
import { LOT_SLOT, WIDGET } from '../copy'
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

import { serialOf } from '../../../core/format/option'
const ledgerText = (ledger: number): string => groupDigits(String(ledger))

/** The window's height, for a chart that keeps the outcomes and the action on a short laptop screen. */
function subscribeResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}
const viewportHeight = (): number => window.innerHeight
function useViewportHeight(): number {
  return useSyncExternalStore(subscribeResize, viewportHeight, () => 900)
}

/** 216 px on a 900 px tall screen, down to 150 px on a 720 px one; a phone scrolls, so it keeps its own height. */
const chartHeight = (phone: boolean, vh: number): number => (phone ? 208 : Math.round(Math.min(216, Math.max(150, 216 - (900 - vh) * 0.37))))

interface BodyProps {
  figure: FloorFigure
  terms: FloorTerms
  reference: { value: number; label: string } | undefined
  height: number
}

/**
 * The chart and the two outcome figures. Mounted once: a new offer keeps the price the visitor set when it lies on
 * the new axis (clamped to it otherwise), and starts at its own price only when the asset changes.
 */
function FloorBody({ figure, terms, reference, height }: BodyProps) {
  const code = terms.underlying.code
  const quote = terms.quote.code
  const [assumed, setAssumed] = useState<{ code: string; price: number } | null>(null)
  const price = assumed !== null && assumed.code === code ? Math.min(figure.domain[1], Math.max(figure.domain[0], assumed.price)) : figure.startPrice
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
        onPriceChange={(next) => setAssumed({ code, price: next })}
        step={figure.step}
        largeStep={figure.largeStep}
        unit={quote}
        asset={code}
        title={WIDGET.chartTitle(figure.text.qty, code, figure.text.strike)}
        caption={PAYOFF_CAPTION}
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
              {verdict}
            </span>
          </dd>
        </div>
      </dl>
    </>
  )
}

/**
 * The lot of the put shown. When the visitor's own change of floor or deadline brings another lot, the figure
 * fades in and carries the marker flash once (brief 5.3); the first paint and the swap from the example do not.
 */
function Lot({ text, group }: { text: string; group: string | null }) {
  const [last, setLast] = useState({ group, text })
  const [changes, setChanges] = useState(0)
  if (group !== last.group || text !== last.text) {
    setLast({ group, text })
    if (group !== null && group === last.group) setChanges(changes + 1)
  }
  return changes > 0 ? (
    <Marker flash key={changes} className={css.changed}>
      {text}
    </Marker>
  ) : (
    <>{text}</>
  )
}

/**
 * True while the visitor works in the element: the pointer has moved or pressed inside it and not left, or focus
 * is inside it. A pointer that merely rests where the note appears does not count.
 */
function useEngaged() {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  return {
    engaged: hovered || focused,
    handlers: {
      onPointerMove: () => setHovered(true),
      onPointerDown: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: (event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      },
    },
  }
}

export function HeroWidget({ live: reported, onPick }: HeroWidgetProps) {
  const phone = useIsPhone()
  const vh = useViewportHeight()
  const { engaged, handlers } = useEngaged()

  // The first open offer replaces the example only once the visitor has left the note; after that, every change
  // is one the visitor asked for (or a later read of the book) and shows at once.
  const [swapped, setSwapped] = useState(false)
  const hold = !swapped && reported?.status === 'open' && engaged
  const live = hold ? null : reported
  const open = live?.status === 'open' ? live : null
  if (open && !swapped) setSwapped(true)

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

  // The aside says only what the tag does not: that the example is recorded, a resale, or read from mock data.
  const aside = offer ? (offer.source === 'resale' ? WIDGET.resaleAside : live?.mock ? WIDGET.openAsideMock : null) : WIDGET.recordedAside

  const lotText = `${figure.text.qty} ${code}`
  const totalText = `${figure.text.premium} ${q.code}`
  const lotLine = offer
    ? (offer.source === 'resale' ? WIDGET.lotResale : WIDGET.lotOpen)(LOT_SLOT, totalText, figure.text.premiumPerUnit)
    : WIDGET.lotRecorded(LOT_SLOT, totalText, figure.text.premiumPerUnit)
  const [lotBefore, lotAfter] = lotLine.split(LOT_SLOT)
  const lotOf = (qty: bigint): string => `${formatUnits(qty, terms.underlying.decimals)} ${code}`

  return (
    <div
      className={css.root}
      data-state={offer ? 'open' : 'recorded'}
      data-held={hold || undefined}
      data-testid="hero-widget"
      aria-busy={reported?.status === 'loading' || undefined}
      {...handlers}
    >
      <ContractNote
        className={css.note}
        serialLabel={offer ? WIDGET.serialOffer : WIDGET.serialOption}
        serial={serialOf(offer ? offer.id : RECORDED_PUT.id)}
        ledger={offer ? (live?.ledger != null ? ledgerText(live.ledger) : undefined) : ledgerText(RECORDED_PUT_TX.write.ledger)}
        state={offer ? (offer.source === 'resale' ? 'Active' : 'Offered') : 'Settled'}
        glyph="long-put"
        kind={WIDGET.heading(code)}
        headingLevel={2}
        aside={aside === null ? undefined : <span data-testid="hero-aside">{aside}</span>}
        footer={<Source live={live} />}
      >
        {offer && choices ? (
          <div className={css.terms} role="group" aria-label={WIDGET.termsLabel}>
            <TermSelect
              label={WIDGET.hold}
              value={choices.assetId}
              onChange={(assetId) => onPick({ assetId })}
              options={choices.assets.map((a) => ({ value: a.id, label: a.typeLabel ? WIDGET.assetOption(a.code, a.typeLabel) : a.code }))}
              figure={code}
            />
            <TermSelect
              label={WIDGET.floor}
              value={offer.strikePerUnit.toString()}
              onChange={(strike) => onPick({ assetId: choices.assetId, expiry: offer.expiry, strike: BigInt(strike) })}
              options={choices.strikes.map((s) => ({
                value: s.value.toString(),
                label:
                  s.perUnit === null
                    ? WIDGET.floorOptionBare(formatMoney(s.value, q), lotOf(s.qty))
                    : WIDGET.floorOption(formatMoney(s.value, q), formatUnits(s.perUnit, q.decimals), lotOf(s.qty)),
              }))}
              figure={figure.text.strike}
              unit={q.code}
              marked
            />
            <TermSelect
              label={WIDGET.until}
              value={String(offer.expiry)}
              onChange={(expiry) => onPick({ assetId: choices.assetId, strike: offer.strikePerUnit, expiry: Number(expiry) })}
              options={choices.expiries.map((e) => ({ value: String(e.value), label: e.qty === null ? formatUtc(e.value) : WIDGET.untilOption(formatUtc(e.value), lotOf(e.qty)) }))}
              figure={until}
              unit={untilRest}
            />
          </div>
        ) : (
          <dl className={css.terms} aria-label={WIDGET.termsLabel}>
            <TermValue label={WIDGET.hold} figure={code} />
            <TermValue label={WIDGET.floor} figure={figure.text.strike} unit={q.code} marked />
            <TermValue label={WIDGET.until} figure={until} unit={untilRest} />
          </dl>
        )}
        <p className={css.meta} data-testid="hero-meta">
          {lotBefore}
          <Lot text={lotText} group={offer ? code : null} />
          {lotAfter}
          {offer && choices?.movedFrom != null ? (
            <span className={css.moved}> {WIDGET.moved(formatUnits(choices.movedFrom, q.decimals), untilDay, figure.text.strike)}</span>
          ) : null}
        </p>
        <FloorBody figure={figure} terms={terms} reference={reference} height={chartHeight(phone, vh)} />
      </ContractNote>
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
        <Button onClick={live.retry}>{WIDGET.retry}</Button>
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
