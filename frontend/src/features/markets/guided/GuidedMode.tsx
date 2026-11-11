// Guided mode of the asset page (brief 4.3): one of four outcomes in plain words. The page reads top to bottom
// as a decision: what you want, your three terms, what the contract holds for them, what you would hold at the
// deadline, who acts and by when, then the one action, which opens the order ticket.
//
// State is the URL: intent, qty, strike, expiry (and premium on the fallback path). Anything the URL does not
// say falls back to a default computed from what is funded. Every figure comes from core/ and data/ hooks.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { AssetSearch } from '../../../app/search'
import { deadlineUrgency, formatCountdown, formatLocal, formatUnits, formatUtc, formatUtcDay, formatUtcTime, isoUtc } from '../../../core/format'
import { cellKey } from '../../../core/market/selection'
import { intentInfo } from '../../../core/payoff/strategies'
import type { GuidedIntent } from '../../../core/payoff/strategies'
import { distancePct, priceOf } from '../../../core/reference'
import { expiryDayKey, plainDecimal } from '../../../core/series'
import { shortBy } from '../../../core/units'
import { useBalances, useGuidedMatch, useMarket, useMe, useNowSec } from '../../../data'
import type { MarketView } from '../../../data'
import { Button, Callout, ContractNote, DateTime, EmptyNote, Skeleton, Timeline, announce } from '../../../ui'
import { useWallet } from '../../../wallet'
import { searchFromTicketIntent } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { Available } from './Available'

import {
  ACTION,
  ANNOUNCE,
  AT_REFERENCE,
  DEADLINE_NEAR,
  DISTANCE_FULL,
  EXPIRY_CHIPS_LABEL,
  FUNDED_LEGEND,
  FUNDED_WORD,
  GUEST_NOTE,
  HAVE,
  HOLD,
  INTENT_COPY,
  LOADING_LABEL,
  LOAD_ERROR_BODY,
  LOAD_ERROR_TITLE,
  LOCKS,
  MAX_AFFORD,
  MAX_HOLDING,
  NEED_QTY,
  NEED_QTY_ACTION,
  NEEDS_LATER,
  NEXT_NOTE,
  NOT_LISTED,
  NO_GRID,
  NO_GRID_HINT,
  OUTCOME_HEADING,
  OVER_HOLDING,
  OWN_SUMMARY,
  OWN_SUMMARY_NO_PREMIUM,
  QTY_EMPTY,
  REFRESH_FAILED,
  RETRY,
  SERIAL_LABEL,
  SHORT_ASSET,
  SHORT_QUOTE,
  STRIKE_CHIPS_LABEL,
  TIME_LEFT,
  UNTIL_LABEL,
  WHEN,
  WHEN_HEADING,
  WHEN_LEAD,
  WHEN_NEED_QTY,
  YOUR_TIME,
  qtyNotExact,
  timelineSteps,
} from './copy'
import type { Words } from './copy'
import { IntentPicker } from './IntentPicker'
import { Outcome } from './Outcome'
import { Terms } from './Terms'
import { defaultSeries, distanceWords, inputAmount, maxQuantity, normalizeDecimal, ownIntent, parsePositive, pinnedSeries, takeIntent, totalStrike } from './terms'
import { CLOSE_TICKET, ticketOpen, useDraftParam, useGuidedSearch } from './useGuidedSearch'
import type { PatchOptions } from './useGuidedSearch'
import styles from './GuidedMode.module.css'
import type { ChoiceChip } from '../../../ui'

type Patch = (next: Partial<AssetSearch>, opts?: PatchOptions) => void

/** Terms that belong to one intent. Choosing another intent starts from that intent's own defaults. */
const CLEAR_TERMS: Partial<AssetSearch> = { strike: undefined, expiry: undefined, qty: undefined, premium: undefined, kind: undefined }

export function GuidedMode({ assetId }: { assetId: string }) {
  const { search, patch } = useGuidedSearch()
  const intent: GuidedIntent = search.intent ?? 'floor'
  const market = useMarket(assetId)
  // Asked with no terms, the match only says which series have something the wallet can take: the chip marks
  // and the defaults are built from that.
  const probe = useGuidedMatch(assetId, intent, null, null, null)

  const setIntent = useCallback((next: GuidedIntent) => patch({ ...CLOSE_TICKET, ...CLEAR_TERMS, intent: next }), [patch])
  const retry = () => {
    market.retry()
    probe.retry()
  }

  let body
  if (market.isError || probe.isError) {
    body = (
      <Callout variant="danger" title={LOAD_ERROR_TITLE} actions={<Button onClick={retry}>{RETRY}</Button>}>
        {LOAD_ERROR_BODY}
      </Callout>
    )
  } else if (market.isLoading || probe.isLoading) {
    body = (
      <div className={styles.loading} aria-busy="true">
        <span className="ui-vh">{LOADING_LABEL}</span>
        <Skeleton variant="block" height="22rem" />
        <Skeleton variant="block" height="20rem" />
        <Skeleton variant="rows" lines={4} />
      </div>
    )
  } else if (!market.data || !probe.data) {
    body = <EmptyNote title={NOT_LISTED} headingLevel={2} />
  } else if (market.data.ladder.length === 0 || market.data.expiries.length === 0) {
    body = <EmptyNote title={NO_GRID} hint={NO_GRID_HINT} headingLevel={2} />
  } else {
    body = (
      <Flow
        key={`${assetId}:${intent}`}
        assetId={assetId}
        intent={intent}
        view={market.data}
        funded={probe.data.funded}
        search={search}
        patch={patch}
        refreshFailed={market.refreshFailed || probe.refreshFailed}
        onRetry={retry}
      />
    )
  }

  return (
    <div className={styles.root} data-testid="guided-mode">
      <IntentPicker value={intent} onChange={setIntent} />
      {body}
    </div>
  )
}

interface FlowProps {
  assetId: string
  intent: GuidedIntent
  view: MarketView
  funded: ReadonlySet<string>
  search: AssetSearch
  patch: Patch
  refreshFailed: boolean
  onRetry: () => void
}

function Flow({ assetId, intent, view, funded, search, patch, refreshFailed, onRetry }: FlowProps) {
  const info = intentInfo(intent)
  const copy = INTENT_COPY[intent]
  const { asset, quote, reference } = view
  const kind = info.optionKind
  const side = info.side
  const me = useMe()
  const wallet = useWallet()
  const nowSec = useNowSec(30)
  const refPrice = priceOf(reference)

  // ---- the series: what the URL names, else the default
  const grid = useMemo(() => ({ ladder: view.ladder, expiries: view.expiries, reference: refPrice, nowSec }), [view.ladder, view.expiries, refPrice, nowSec])
  const pinned = pinnedSeries(search, grid, quote.decimals)
  const series = defaultSeries(kind, grid, funded, pinned)
  // The grid is not empty here (checked by the caller), so both are set.
  const strike = series.strike ?? view.ladder[0]
  const expiry = series.expiry ?? view.expiries[0]
  const cell = view.cells.get(cellKey({ expiry, kind, strikePerUnit: strike }))

  // ---- the quantity and, on the fallback path, the premium: text inputs kept in step with the URL
  const lot = (side === 'buy' ? cell?.best : cell?.bestBid)?.underlyingQty ?? null
  const scope = `${assetId}:${intent}`
  const closed = !ticketOpen(search)
  const restoreQty = useCallback((value: string) => patch({ qty: value }, { replace: true }), [patch])
  const restorePremium = useCallback((value: string) => patch({ premium: value }, { replace: true }), [patch])
  const qtyDraft = useDraftParam(scope, search.qty, lot !== null ? inputAmount(lot, asset.decimals) : '1.00', { enabled: closed, write: restoreQty })
  const premiumDraft = useDraftParam(scope, search.premium, '', { enabled: closed, write: restorePremium })

  const typedQty = parsePositive(qtyDraft.text, asset.decimals)
  const strikeTotal = typedQty !== null ? totalStrike(strike, typedQty, asset.decimals) : null
  // A quantity counts once strike times quantity is an exact amount: the contract takes totals.
  const qty = strikeTotal !== null ? typedQty : null

  const match = useGuidedMatch(assetId, intent, qty, strike, expiry)
  const balances = useBalances(me)

  const exact = match.data?.exact ?? null
  const ownPremium = exact ? null : parsePositive(premiumDraft.text, quote.decimals)
  const premium = exact ? exact.totalPremium : ownPremium
  const premiumSource: 'order' | 'own' | 'none' = exact ? 'order' : ownPremium !== null ? 'own' : 'none'

  // ---- writing the URL: any change of terms pins all of them and closes an open ticket
  const pin = (next: { qty?: string | undefined; strike?: bigint; expiry?: number; premium?: string | undefined }, opts?: PatchOptions) =>
    patch(
      {
        ...CLOSE_TICKET,
        intent,
        strike: plainDecimal(next.strike ?? strike, quote.decimals),
        expiry: expiryDayKey(next.expiry ?? expiry),
        qty: 'qty' in next ? next.qty : normalizeDecimal(qtyDraft.text),
        ...('premium' in next ? { premium: next.premium } : {}),
      },
      opts,
    )
  const typeQty = (text: string) => pin({ qty: qtyDraft.type(text) }, { replace: true })
  const typePremium = (text: string) => pin({ premium: premiumDraft.type(text) }, { replace: true })

  // ---- text
  const money = (units: bigint) => formatUnits(units, quote.decimals)
  const units = (amount: bigint) => formatUnits(amount, asset.decimals)
  const deadline = formatUtc(expiry)
  const words: Words = {
    a: asset.code,
    q: quote.code,
    qty: qty !== null ? units(qty) : '',
    strike: money(strike),
    strikeTotal: strikeTotal !== null ? money(strikeTotal) : '',
    premium: premium !== null ? money(premium) : null,
  }
  const referenceLabel = reference.label.toLowerCase()
  const referenceText = refPrice !== null ? money(refPrice) : null

  // ---- balances and what the quantity field says about them
  const balanceOf = (id: string): bigint | null => (me ? (balances.data?.find((b) => b.contractId === id)?.balance ?? null) : null)
  const held = balanceOf(asset.contractId)
  const cash = balanceOf(quote.contractId)
  const max = me ? maxQuantity(intent, { asset: held, quote: cash }, strike, asset.decimals) : null
  const qtyAside = info.starts === 'asset' ? (held !== null ? HOLD(units(held), asset.code) : undefined) : cash !== null ? HAVE(money(cash), quote.code) : undefined
  let qtyHint: string | undefined
  let qtyError: string | undefined
  if (qtyDraft.text.trim() === '' || typedQty === null) qtyError = QTY_EMPTY
  else if (strikeTotal === null) qtyError = qtyNotExact(asset.code)
  else if (intent === 'floor') {
    if (held !== null && typedQty > held) qtyHint = OVER_HOLDING(units(held), asset.code)
  } else if (intent === 'earn-hold') {
    if (held !== null && typedQty > held) qtyError = SHORT_ASSET(units(held), units(typedQty), units(shortBy(held, typedQty)), asset.code)
  } else if (intent === 'earn-buy') {
    if (cash !== null && strikeTotal > cash) qtyError = SHORT_QUOTE(money(cash), money(strikeTotal), money(shortBy(cash, strikeTotal)), quote.code)
    else qtyHint = LOCKS(money(strikeTotal), quote.code)
  } else {
    qtyHint = NEEDS_LATER(money(strikeTotal), quote.code)
  }

  // ---- chips
  const fundedWord = FUNDED_WORD[side]
  const isFunded = (e: number, k: bigint) => funded.has(cellKey({ expiry: e, kind, strikePerUnit: k }))
  // The full name of a chip carries the words its two short lines leave out:
  // `99.00 USDx, 0.4% below the demo price, funded offer available`.
  const chipName = (parts: ReadonlyArray<string | undefined>): string => parts.filter((part) => part !== undefined && part !== '').join(', ')
  const strikeChips: ChoiceChip[] = view.ladder.map((k) => {
    const distance = distanceWords(distancePct(k, reference))
    const on = isFunded(expiry, k)
    const detailName = distance ? (distance.side !== 'at' ? `${distance.short} the ${referenceLabel}` : distance.short) : undefined
    return {
      value: k.toString(),
      label: money(k),
      detail: distance?.short,
      marked: on,
      name: chipName([`${money(k)} ${quote.code}`, detailName, on ? fundedWord.yes : fundedWord.no]),
    }
  })
  const expiryChips: ChoiceChip[] = view.expiries.map((e) => {
    const on = isFunded(e, strike)
    const left = TIME_LEFT(formatCountdown(e - nowSec))
    return {
      value: e.toString(),
      label: formatUtcDay(e),
      detail: left,
      marked: on,
      name: chipName([formatUtcDay(e), left, on ? fundedWord.yes : fundedWord.no]),
    }
  })
  const strikeDistance = distanceWords(distancePct(strike, reference))
  const strikeHint =
    strikeDistance && referenceText ? (strikeDistance.side === 'at' ? AT_REFERENCE(referenceLabel, referenceText) : DISTANCE_FULL(strikeDistance.short, referenceLabel, referenceText)) : undefined

  // ---- the ticket
  // The link carries the quantity and the premium as they are typed, so the inputs do not change under the user.
  const strikeParam = plainDecimal(strike, quote.decimals)
  const qtyParam = qty !== null ? normalizeDecimal(qtyDraft.text) : undefined
  const premiumParam = ownPremium !== null ? normalizeDecimal(premiumDraft.text) : undefined
  const own = (withPremium: boolean): TicketIntent | null =>
    qtyParam === undefined ? null : ownIntent(side, { assetId, kind, strike: strikeParam, qty: qtyParam, premium: withPremium ? premiumParam : undefined, expiry })
  const open = (ticket: TicketIntent, step: 'terms' | 'review') =>
    patch({ ...searchFromTicketIntent(ticket), intent, strike: strikeParam, expiry: expiryDayKey(expiry), qty: qtyParam, step })
  // A funded order is taken as it stands, at the review step. Terms of one's own go to review once they have a
  // premium, and to the terms step of the ticket while they do not.
  const taking = exact ? takeIntent(exact, me) : null
  const posting = exact ? null : own(true)
  const primary: { ticket: TicketIntent; step: 'terms' | 'review' } | null = taking
    ? { ticket: taking, step: 'review' }
    : posting
      ? { ticket: posting, step: ownPremium !== null ? 'review' : 'terms' }
      : null
  const primaryLabel = exact
    ? exact.source === 'bid'
      ? ACTION.request
      : exact.source === 'resale'
        ? ACTION.listing
        : ACTION.offer
    : side === 'buy'
      ? ownPremium !== null
        ? ACTION.ownRequest
        : ACTION.postRequest
      : ownPremium !== null
        ? ACTION.ownOffer
        : ACTION.postOffer
  const ownTerms = exact ? own(false) : null
  const collateral = kind === 'put' ? `${words.strikeTotal} ${words.q}` : `${words.qty} ${words.a}`
  const summary =
    qty === null
      ? null
      : exact
        ? copy.summary({ ...words, deadline })
        : ownPremium !== null
          ? OWN_SUMMARY[side]({ ...words, collateral, deadline })
          : OWN_SUMMARY_NO_PREMIUM[side]

  const steps = timelineSteps(intent, exact ? 'take' : 'own', words)
  const urgency = deadlineUrgency(expiry - nowSec)
  const near = urgency === 'within48h' || urgency === 'within2h' || urgency === 'within15min' ? DEADLINE_NEAR[urgency] : null

  // A change of terms that changes what is available is read out: the block is far from the chips that caused it.
  const found = match.data ? (exact ? `${exact.key}:${exact.totalPremium}` : 'none') : null
  const lastFound = useRef<string | null>(null)
  useEffect(() => {
    if (found === null) return
    const first = lastFound.current === null
    const changed = lastFound.current !== found
    lastFound.current = found
    if (first || !changed) return
    if (!exact) announce(ANNOUNCE.nothing)
    else announce((exact.source === 'bid' ? ANNOUNCE.request : exact.source === 'resale' ? ANNOUNCE.listing : ANNOUNCE.offer)(formatUnits(exact.totalPremium, quote.decimals), quote.code))
  }, [found, exact, quote.decimals, quote.code])

  return (
    <>
      {refreshFailed ? (
        <Callout variant="warning" actions={<Button size="sm" onClick={onRetry}>{RETRY}</Button>}>
          {REFRESH_FAILED}
        </Callout>
      ) : null}

      <ContractNote
        className={styles.note}
        serialLabel={exact ? SERIAL_LABEL[exact.source] : undefined}
        serial={exact ? (exact.bid?.id ?? exact.offer?.id ?? 0n).toString().padStart(6, '0') : undefined}
        glyph={copy.glyph}
        kind={copy.heading(asset.code)}
        headingLevel={2}
        aside={copy.contract}
      >
        <p className={styles.lead}>{copy.lead(asset.code, quote.code)}</p>
        <Terms
          qty={{
            label: copy.qtyLabel,
            text: qtyDraft.text,
            unit: asset.code,
            decimals: asset.decimals,
            onChange: typeQty,
            onMax: max !== null ? () => typeQty(inputAmount(max, asset.decimals)) : undefined,
            maxLabel: max !== null ? (info.starts === 'asset' ? MAX_HOLDING(units(max), asset.code) : MAX_AFFORD(units(max), asset.code)) : undefined,
            aside: qtyAside,
            hint: qtyHint,
            error: qtyError,
          }}
          strike={{
            label: copy.strikeLabel,
            figure: money(strike),
            unit: quote.code,
            hint: strikeHint,
            chipsLabel: STRIKE_CHIPS_LABEL[intent],
            reference: referenceText ? `${reference.label} ${referenceText} ${quote.code}. ${reference.note}` : `${reference.label}. ${reference.note}`,
            chips: strikeChips,
            value: strike.toString(),
            onChange: (value) => pin({ strike: BigInt(value) }),
          }}
          expiry={{
            label: UNTIL_LABEL,
            day: formatUtcDay(expiry),
            time: formatUtcTime(expiry),
            iso: isoUtc(expiry),
            hint: `${TIME_LEFT(formatCountdown(expiry - nowSec))}. ${YOUR_TIME(formatLocal(expiry))}.`,
            chipsLabel: EXPIRY_CHIPS_LABEL,
            chips: expiryChips,
            value: expiry.toString(),
            onChange: (value) => pin({ expiry: Number(value) }),
          }}
          legend={FUNDED_LEGEND[side]}
        />
        {near ? (
          <Callout variant="warning" title={near.title} className={styles.near}>
            {near.body}
          </Callout>
        ) : null}
        {match.data ? (
          <Available
            intent={intent}
            match={match.data}
            asset={asset}
            quote={quote}
            words={{ ...words, deadline }}
            qty={qty}
            lowestOffer={cell?.best ?? null}
            premiumText={premiumDraft.text}
            onPremiumChange={typePremium}
            onUse={(t) => pin({ qty: inputAmount(t.qty, asset.decimals), strike: t.strike, expiry: t.expiry })}
          />
        ) : (
          <Skeleton variant="rows" lines={3} />
        )}
      </ContractNote>

      <section className={styles.section} aria-labelledby="guided-outcome">
        <h2 id="guided-outcome" className={styles.heading}>
          {OUTCOME_HEADING}
        </h2>
        {qty !== null && strikeTotal !== null ? (
          <Outcome
            key={`${strike}:${expiry}`}
            intent={intent}
            qty={qty}
            strikeTotal={strikeTotal}
            premium={premium}
            assetDecimals={asset.decimals}
            quoteDecimals={quote.decimals}
            words={words}
            reference={refPrice !== null && referenceText ? { perUnit: refPrice, label: reference.label, text: referenceText } : null}
            premiumSource={premiumSource}
          />
        ) : (
          <EmptyNote title={NEED_QTY} headingLevel={3} />
        )}
      </section>

      <section className={styles.section} aria-labelledby="guided-when">
        <h2 id="guided-when" className={styles.heading}>
          {WHEN_HEADING}
        </h2>
        <p className={styles.whenLead}>{WHEN_LEAD}</p>
        {qty === null ? (
          <p className={styles.whenNeed}>{WHEN_NEED_QTY}</p>
        ) : (
          <Timeline
            label={WHEN_HEADING}
            items={[
              { time: WHEN.now, actor: steps.now.actor, title: steps.now.title, description: steps.now.body, status: 'current' },
              { time: WHEN.until, actor: steps.until.actor, title: steps.until.title, description: steps.until.body, status: 'upcoming' },
              {
                time: (
                  <>
                    {WHEN.at}, <DateTime value={expiry * 1000} local="inline" />
                  </>
                ),
                actor: steps.at.actor,
                title: steps.at.title,
                description: steps.at.body,
                status: 'upcoming',
              },
              { time: WHEN.after, actor: steps.after.actor, title: steps.after.title, description: steps.after.body, status: 'upcoming' },
            ]}
          />
        )}
      </section>

      <section className={styles.action} aria-label="Next step">
        {summary ? (
          <p className={styles.summary} data-testid="guided-summary">
            {summary}
          </p>
        ) : null}
        <div className={styles.buttons}>
          {me === null ? (
            <Button variant="primary" onClick={() => void wallet.connect()}>
              {ACTION.connect}
            </Button>
          ) : (
            <Button variant="primary" disabled={primary === null} disabledReason={NEED_QTY_ACTION} onClick={() => primary && open(primary.ticket, primary.step)}>
              {primaryLabel}
            </Button>
          )}
          {me !== null && ownTerms ? (
            <Button variant="quiet" onClick={() => open(ownTerms, 'terms')}>
              {side === 'buy' ? ACTION.ownPriceRequest : ACTION.ownPriceOffer}
            </Button>
          ) : null}
        </div>
        <p className={styles.next}>{me === null ? GUEST_NOTE : NEXT_NOTE}</p>
      </section>
    </>
  )
}
