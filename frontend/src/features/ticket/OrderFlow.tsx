// The two tickets with a form of terms: write an offer (lock the collateral, ask a premium) and post a request
// (escrow a premium, wait for a maker). Same fields, same validator; they differ in who locks what.
//
// The form defaults to the standard grid (listed deadlines, the strike ladder around the reference price). A
// ticket opened on a series shows it as three rows, with the pickers behind "Change terms"; the contract accepts
// any terms, so "Custom terms" opens a strike and a deadline of the user's own. The premium is typed per unit;
// the total is computed exactly and the URL keeps the total.
import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PRO_ENABLED } from '../../core/config'
import { bidEscrowDisclosure } from '../../core/disclosures'
import { MARGIN_TRADE_HREF } from '../../core/market/marginAck'
import { formatUnits, formatUtc, formatUtcDay, secondsUntil } from '../../core/format'
import { lowestOpenInSeriesOf } from '../../core/maker/lowestOffer'
import type { SeriesTermsRef } from '../../core/maker/lowestOffer'
import type { PreTradeAction } from '../../core/options/preTrade'
import { MAX_OPEN_PER_WRITER, requiredCollateral } from '../../core/options/types'
import type { NewOffer, OptionKind, OptionOffer, SupportedAssets, TokenInfo } from '../../core/options/types'
import { MAX_OPEN_BIDS_PER_BUYER } from '../../core/requests/types'
import type { Bid } from '../../core/requests/types'
import { compareRatio, plainAmount } from '../../core/units'
import { useAssets, useBalancesById, useBids, useBuyerOpenCount, useCreateBid, useMe, useNowSec, useOptions, useReference, useWriteOffer, useWriterOpenCount } from '../../data'
import { AmountField, Button, Callout, ChoiceChips, Link, Segmented, TextField } from '../../ui'
import type { ChoiceChip, NoteTerm } from '../../ui'

import {
  CHANGE_TERMS_LABEL,
  COMMITMENT,
  CUSTOM_TERMS_HINT,
  CUSTOM_TERMS_LABEL,
  LOADING_TITLE,
  MARGIN_LINK,
  POST_ANOTHER,
  WRITE_ANOTHER,
  betterRequest,
  capOffers,
  capRequests,
  cheaperOffer,
  optionPhrase,
  receiptReminder,
  receiptTitle,
  reviewTitle,
  signSummary,
  ticketTitle,
} from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { moneyText, priceText } from './fmt'
import { chipCountdown, draftOf, gridFor, initialForm, isOnGrid, parseUtcDateTime, premiumTotalText, strikeText, strikeUnitsOf, takeOver, utcDateTimeFields } from './form'
import type { FormField, Grid, TermsForm } from './form'
import type { FormIntent, TicketIntent } from './intent'
import { PriceText } from './parts'
import type { ReceiptView } from './ReceiptStep'
import { breakevenRow, deadlineRow, kindRow, leadRow, moneyRow, mostYouCanLoseRow, quantityRow, receiptTerms, strikeRow } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { glyphOf, positionWords, premiumPerUnit, serialOf, strikePerUnit } from './terms'
import type { Leg } from './terms'
import { TermsList } from './TermsList'
import { outcomeFor } from './words'
import styles from './OrderFlow.module.css'

const KINDS: { value: OptionKind; label: string }[] = [
  { value: 'put', label: 'Put' },
  { value: 'call', label: 'Call' },
]

/** The count of open orders is shown only near the contract's cap. */
const NEAR_CAP = 5

export function OrderFlow(props: { intent: FormIntent; startAt?: 'terms' | 'review'; onIntentChange?: (next: TicketIntent) => void }) {
  const assets = useAssets()
  const title = LOADING_TITLE[props.intent.mode]
  if (!assets.data) {
    if (assets.isError) return <FlowError title={title} what="The list of assets" onRetry={() => void assets.refetch()} />
    return <FlowLoading title={title} />
  }
  const underlying = assets.data.underlyings.find((t) => t.contractId === props.intent.assetId)
  if (!underlying) return <FlowGone title={title} sentence="This asset is not listed in the contract." hint="Pick an asset from Markets." />
  return <OrderTicket {...props} assets={assets.data} underlying={underlying} />
}

/** The open offers of one asset, and those `me` could buy. */
function useSeriesOffers(underlying: TokenInfo, me: string | null, nowSec: number): { ofAsset: OptionOffer[]; buyable: OptionOffer[] } {
  const options = useOptions()
  return useMemo(() => {
    const ofAsset = (options.data ?? []).filter((o) => o.state === 'offered' && o.underlying.contractId === underlying.contractId && o.expiry > nowSec)
    return { ofAsset, buyable: ofAsset.filter((o) => o.writer !== me) }
  }, [options.data, underlying.contractId, me, nowSec])
}

/** The best open request of another buyer on exactly this series (highest premium per unit), or null. */
function useBestRequest(series: SeriesTermsRef | null, me: string | null, nowSec: number): Bid | null {
  const bids = useBids()
  return useMemo(() => {
    if (!series) return null
    let best: Bid | null = null
    for (const b of bids.data ?? []) {
      if (b.state !== 'open' || b.expiry <= nowSec || b.buyer === me || b.kind !== series.kind || b.expiry !== series.expiry) continue
      if (b.underlying.contractId !== series.underlying.contractId || strikePerUnit(b) !== series.strikePerUnit) continue
      if (!best || compareRatio(b.totalPremium, b.underlyingQty, best.totalPremium, best.underlyingQty) > 0) best = b
    }
    return best
  }, [bids.data, series, me, nowSec])
}

const IN_FLIGHT = new Set(['checking', 'signing', 'submitting', 'pending', 'unknown'])

function OrderTicket(props: { intent: FormIntent; assets: SupportedAssets; underlying: TokenInfo; startAt?: 'terms' | 'review'; onIntentChange?: (next: TicketIntent) => void }) {
  const { intent, assets, underlying: u, onIntentChange } = props
  const mode = intent.mode
  const q = assets.quote
  const decimals = useMemo(() => ({ underlying: u.decimals, quote: q.decimals }), [u.decimals, q.decimals])
  const me = useMe()
  const write = useWriteOffer()
  const bid = useCreateBid()
  const tx = mode === 'write' ? write : bid
  const reference = useReference(u)
  const nowSec = useNowSec(60)
  const offers = useSeriesOffers(u, me, nowSec)
  const grid = useMemo<Grid>(() => gridFor({ nowSec, referencePerUnit: reference.perUnit, quoteDecimals: q.decimals, existing: offers.ofAsset }), [nowSec, reference.perUnit, q.decimals, offers.ofAsset])

  const [form, setForm] = useState<TermsForm>(() => initialForm(intent, grid, reference.perUnit, decimals))
  const [custom, setCustom] = useState(() => !isOnGrid(form, grid, q.decimals))
  // A ticket opened on a series shows it as rows; the pickers wait behind "Change terms".
  const [changing, setChanging] = useState(() => !(intent.strike !== undefined && intent.expiry !== undefined && isOnGrid(form, grid, q.decimals)))
  const [when, setWhen] = useState(() => (form.expiry === null ? { date: '', time: '08:00' } : utcDateTimeFields(form.expiry)))
  // A new generation of the flow starts at Terms: new terms from the chain after a review or a settled
  // transaction, or "Write another" on the receipt. The transaction is reset with it.
  const [generation, setGeneration] = useState(0)
  const txRef = useRef(tx)
  useEffect(() => {
    txRef.current = tx
  })
  useEffect(() => {
    if (generation > 0) txRef.current.reset()
  }, [generation])

  // The URL can change under the form (another cell of the chain is chosen): the form takes those terms over and
  // starts again at Terms. Its own echo differs in nothing, so typing and choosing never fight the address bar.
  // While a transaction is in flight or its outcome is unknown, the change is ignored: what was signed stays shown.
  const urlTerms = `${intent.kind}|${intent.strike ?? ''}|${intent.expiry ?? ''}|${intent.qty ?? ''}|${intent.premium ?? ''}`
  const [seenUrl, setSeenUrl] = useState(urlTerms)
  if (urlTerms !== seenUrl) {
    setSeenUrl(urlTerms)
    const patch = IN_FLIGHT.has(tx.state.phase) ? null : takeOver(form, intent, decimals)
    if (patch) {
      setForm({ ...form, ...patch })
      if (patch.expiry != null) setWhen(utcDateTimeFields(patch.expiry))
      setGeneration((g) => g + 1)
    }
  }

  /** Applies a change and mirrors the terms to the URL, so the series stays linkable and the chain follows. */
  const change = (patch: Partial<TermsForm>, mirror = true) => {
    const next = { ...form, ...patch }
    setForm(next)
    if (!mirror || !onIntentChange) return
    const out: FormIntent = { mode, assetId: u.contractId, kind: next.kind }
    if (next.strike !== '') out.strike = next.strike
    if (next.expiry !== null) out.expiry = next.expiry
    if (next.qty !== '') out.qty = next.qty
    const total = premiumTotalText(next, decimals)
    if (total !== null && total !== 'inexact') out.premium = total
    onIntentChange(out)
  }
  const mirrorNow = () => change({})

  const draft = useMemo(() => draftOf(form, u, assets), [form, u, assets])
  const offer: NewOffer | null = draft.ok ? draft.offer : null
  const leg = useMemo<Leg | null>(() => (offer ? { ...offer, quote: q } : null), [offer, q])
  const action = useMemo<PreTradeAction | null>(() => (offer ? (mode === 'write' ? { type: 'write-offer', offer, quote: q } : { type: 'post-bid', bid: offer, quote: q }) : null), [offer, mode, q])

  const tokens = useMemo(() => [q, u], [q, u])
  const balances = useBalancesById(me, tokens)
  const writerOpen = useWriterOpenCount(me, { enabled: mode === 'write' })
  const buyerOpen = useBuyerOpenCount(me, { enabled: mode === 'bid' })

  // The series the form points at, even before a quantity is typed: one unit at the chosen strike.
  const strikeUnits = strikeUnitsOf(form, q.decimals)
  const series = useMemo<SeriesTermsRef | null>(
    () => (strikeUnits !== null && strikeUnits > 0n && form.expiry !== null ? { kind: form.kind, underlying: u, strikePerUnit: strikeUnits, expiry: form.expiry } : null),
    [strikeUnits, form.expiry, form.kind, u],
  )
  const lowest = series ? lowestOpenInSeriesOf(offers.ofAsset, series, q) : null
  const bestBuyable = series ? lowestOpenInSeriesOf(offers.buyable, series, q) : null
  const bestRequest = useBestRequest(mode === 'write' ? series : null, me, nowSec)

  const fieldError = (field: FormField) => (draft.ok ? undefined : (draft.errors?.[field] ?? (draft.field === field ? draft.error : undefined)))
  // The reason on Review names every open problem, in the order of the form.
  // The contract's cap on open orders does not depend on the terms: it is said as the ticket opens.
  const openCount = mode === 'write' ? writerOpen.data : buyerOpen.data
  const cap = mode === 'write' ? MAX_OPEN_PER_WRITER : MAX_OPEN_BIDS_PER_BUYER
  const capFull = typeof openCount === 'number' && openCount >= cap ? (mode === 'write' ? capOffers(openCount, cap) : capRequests(openCount, cap)) : null
  const fieldsError = draft.ok ? null : draft.errors && Object.keys(draft.errors).length > 1 ? Object.values(draft.errors).join(' ') : draft.error
  const termsError = capFull ?? fieldsError
  const collateral = leg ? requiredCollateral(leg) : null
  const premium = leg ? { token: q, amount: leg.totalPremium } : null
  const collateralToken = form.kind === 'put' ? q : u
  const spends = mode === 'write' ? collateral : premium
  // The balance that limits the quantity: the collateral of a written option, the premium of a request.
  const spendToken = mode === 'write' ? collateralToken : q
  const balanceOf = (t: TokenInfo) => {
    const held = balances.data?.[t.contractId]
    return held?.status === 'ok' && held.balance !== null ? held.balance : null
  }
  const have = balanceOf(spendToken)
  // More than the wallet holds marks the field that sets the amount (the quantity of a written option, the premium
  // of a request); the notice under the form says it with both figures and the way to test funds.
  const overBalance = spends !== null && have !== null && have < spends.amount ? `This ${mode === 'write' ? 'locks' : 'escrows'} more than the ${moneyText({ token: spendToken, amount: have })} you have.` : undefined

  // A request on these terms that pays at least what is asked: filling it is paid now.
  const requestPays = bestRequest !== null && (form.premium.trim() === '' || (leg !== null && compareRatio(bestRequest.totalPremium, bestRequest.underlyingQty, leg.totalPremium, leg.underlyingQty) >= 0))
  // An offer on these terms that costs no more per unit than this request: buying it is cheaper or the same.
  const offerCheaper =
    mode === 'bid' && bestBuyable !== null && (form.premium.trim() === '' || (leg !== null && compareRatio(bestBuyable.totalPremium, bestBuyable.underlyingQty, leg.totalPremium, leg.underlyingQty) <= 0))

  const crossLine =
    onIntentChange && mode === 'write' && requestPays && bestRequest ? (
      <Callout
        variant="info"
        label="Request"
        actions={
          <Button variant="secondary" size="sm" onClick={() => onIntentChange({ mode: 'fill', bidId: bestRequest.id })}>
            Fill request
          </Button>
        }
      >
        {betterRequest(moneyText({ token: q, amount: bestRequest.totalPremium }), moneyText({ token: u, amount: bestRequest.underlyingQty }), serialOf(bestRequest.id))}
      </Callout>
    ) : onIntentChange && offerCheaper && bestBuyable ? (
      <Callout
        variant="warning"
        label="Offer"
        actions={
          <Button variant="secondary" size="sm" onClick={() => onIntentChange({ mode: 'buy', offerId: bestBuyable.id })}>
            Buy that offer
          </Button>
        }
      >
        {cheaperOffer(priceText(premiumPerUnit(bestBuyable), q), u.code, moneyText({ token: u, amount: bestBuyable.underlyingQty }), serialOf(bestBuyable.id))}
      </Callout>
    ) : null

  const expiryChips: ChoiceChip[] = grid.expiries.map((ts) => ({
    value: String(ts),
    label: formatUtcDay(ts),
    detail: chipCountdown(secondsUntil(ts, nowSec)),
    name: `${formatUtc(ts)}, in ${chipCountdown(secondsUntil(ts, nowSec))}`,
  }))
  const strikeChips: ChoiceChip[] = grid.ladder.map((k) => ({ value: strikeText(k, q.decimals), label: formatUnits(k, q.decimals) }))
  const chosenStrike = strikeUnits !== null && grid.ladder.includes(strikeUnits) ? strikeText(strikeUnits, q.decimals) : null
  const chosenExpiry = form.expiry !== null && grid.expiries.includes(form.expiry) ? String(form.expiry) : null
  const refNote = reference.perUnit !== null ? `${reference.label} ${formatUnits(reference.perUnit, q.decimals)}` : undefined

  const lowestRow: NoteTerm = lowest
    ? { label: 'Lowest open offer in this series', value: priceText(premiumPerUnit(lowest), q), hint: `Per ${u.code}. Offer No. ${serialOf(lowest.id)}, for ${moneyText({ token: u, amount: lowest.underlyingQty })}.` }
    : { label: 'Lowest open offer in this series', value: 'None open' }

  const dash = '–'
  const summaryRows: NoteTerm[] = []
  if (mode === 'write') summaryRows.push(collateral ? moneyRow('You lock', collateral, 'In the contract, until you cancel the offer or the option runs its course.') : { label: 'You lock', value: dash })
  else summaryRows.push(leg ? moneyRow('Total strike', { token: q, amount: leg.totalStrike }) : { label: 'Total strike', value: dash })
  if (spends && have !== null && have >= spends.amount) summaryRows.push(moneyRow(`${spendToken.code} balance after`, { token: spendToken, amount: have - spends.amount }))
  if (!(mode === 'bid' && offerCheaper)) summaryRows.push(lowestRow)

  const option = leg ? optionPhrase(leg.kind, moneyText({ token: u, amount: leg.underlyingQty }), priceText(strikePerUnit(leg), q), formatUtc(leg.expiry)) : ''
  const escrow = premium ? bidEscrowDisclosure(moneyText(premium)) : null
  const total = premium ? moneyText(premium) : dash

  const pickers = (
    <>
      <Segmented label="Kind" showLabel fullWidth value={form.kind} onValueChange={(kind) => change({ kind })} options={KINDS} />
      <ChoiceChips
        label="Deadline"
        aside="Fridays, 08:00 UTC"
        value={chosenExpiry}
        chips={expiryChips}
        onValueChange={(v) => {
          const ts = Number(v)
          setWhen(utcDateTimeFields(ts))
          change({ expiry: ts })
        }}
      />
      <ChoiceChips label={`Strike, ${q.code} per ${u.code}`} aside={refNote} value={chosenStrike} chips={strikeChips} onValueChange={(strike) => change({ strike })} />
      <details className={styles.custom} open={custom} onToggle={(e) => setCustom(e.currentTarget.open)}>
        <summary className={styles.customSummary}>{CUSTOM_TERMS_LABEL}</summary>
        <div className={styles.customBody}>
          <p className={styles.hint}>{CUSTOM_TERMS_HINT}</p>
          <AmountField label={`Strike, ${q.code} per ${u.code}`} value={form.strike} onValueChange={(strike) => change({ strike }, false)} onBlur={mirrorNow} unit={q.code} decimals={q.decimals} validate={() => fieldError('strike')} />
          <div className={styles.pair}>
            <TextField
              label="Deadline date, UTC"
              value={when.date}
              placeholder="2026-12-18"
              autoComplete="off"
              onValueChange={(date) => {
                setWhen({ ...when, date })
                change({ expiry: parseUtcDateTime(date, when.time) }, false)
              }}
              onBlur={mirrorNow}
              error={form.expiry === null ? (when.date.trim() === '' ? undefined : 'Use the form 2026-12-18.') : fieldError('expiry')}
            />
            <TextField
              label="Time, UTC"
              value={when.time}
              placeholder="08:00"
              autoComplete="off"
              onValueChange={(time) => {
                setWhen({ ...when, time })
                change({ expiry: parseUtcDateTime(when.date, time) }, false)
              }}
              onBlur={mirrorNow}
            />
          </div>
        </div>
      </details>
    </>
  )

  const strikeShown: NoteTerm = {
    label: 'Strike',
    value: (
      <>
        <PriceText units={strikeUnits} quote={q} /> per {u.code}
      </>
    ),
  }
  const terms = (
    <div className={styles.form}>
      {capFull ? (
        <Callout
          variant="danger"
          label="Blocked"
          actions={
            mode === 'write' ? (
              <Link render={<RouterLink to={'/portfolio' as never} search={{ tab: 'orders' } as never} />}>Your open offers</Link>
            ) : (
              <Link render={<RouterLink to={'/requests' as never} search={{ mine: '1' } as never} />}>Your open requests</Link>
            )
          }
        >
          {capFull}
        </Callout>
      ) : null}
      <TermsList rows={[kindRow(form.kind), strikeShown, ...(form.expiry !== null ? [deadlineRow(form.expiry)] : [])]} />
      <details className={styles.change} open={changing} onToggle={(e) => setChanging(e.currentTarget.open)}>
        <summary className={styles.customSummary}>{CHANGE_TERMS_LABEL}</summary>
        <div className={styles.changeBody}>{pickers}</div>
      </details>
      <AmountField
        label="Quantity"
        value={form.qty}
        onValueChange={(qty) => change({ qty }, false)}
        onBlur={mirrorNow}
        unit={u.code}
        decimals={u.decimals}
        validate={() => fieldError('qty') ?? (mode === 'write' ? overBalance : undefined)}
        aside={have !== null ? `You have ${moneyText({ token: spendToken, amount: have })}` : undefined}
        onMax={mode === 'write' && form.kind === 'call' && have !== null && have > 0n ? () => change({ qty: plainAmount(have, u.decimals) }) : undefined}
        maxLabel={mode === 'write' && form.kind === 'call' && have !== null ? `use the full balance, ${moneyText({ token: u, amount: have })}` : undefined}
      />
      <AmountField
        label={`Premium per ${u.code}`}
        value={form.premium}
        onValueChange={(premiumText) => change({ premium: premiumText }, false)}
        onBlur={mirrorNow}
        unit={q.code}
        decimals={q.decimals}
        validate={() => fieldError('premium') ?? (mode === 'bid' ? overBalance : undefined)}
      />
      {crossLine}
      <TermsList
        rows={summaryRows}
        total={
          mode === 'write'
            ? { label: 'You receive when bought', value: total, marked: premium !== null }
            : { label: 'Total premium', value: total, marked: premium !== null, hint: escrow ? <span data-testid="escrow-line">{escrow}</span> : undefined }
        }
      />
      {mode === 'write' && PRO_ENABLED ? (
        <p className={styles.hint}>
          <Link render={<RouterLink to={MARGIN_TRADE_HREF as never} />}>{MARGIN_LINK}</Link>
        </p>
      ) : null}
    </div>
  )

  const capRow: NoteTerm[] = typeof openCount === 'number' && cap - openCount <= NEAR_CAP ? [{ label: mode === 'write' ? 'Your open offers' : 'Your open requests', value: `${openCount} of ${cap}`, hint: 'The contract caps how many can be open at once.' }] : []

  const side = mode === 'write' ? 'short' : 'long'
  const money: NoteTerm[] =
    !leg || !collateral || !premium
      ? []
      : mode === 'write'
        ? [leadRow('You lock', collateral), moneyRow('You receive', premium, 'From the buyer, only when someone takes the offer.')]
        : [leadRow('You escrow', premium, <span data-testid="escrow-line">{escrow}</span>)]
  const details: NoteTerm[] = leg ? [strikeRow(leg), quantityRow(leg), deadlineRow(leg.expiry), breakevenRow(leg), mostYouCanLoseRow(leg, side), ...capRow] : []

  const deal: Deal = {
    mode,
    title: ticketTitle(mode, form.kind, u.code),
    reviewTitle: reviewTitle(mode),
    summary: leg && collateral && premium ? signSummary(mode, option, mode === 'write' ? { locks: moneyText(collateral), receives: moneyText(premium) } : { locks: moneyText(premium) }) : '',
    leg,
    side,
    action,
    terms,
    termsError,
    warnOnTerms: true,
    money,
    details,
    notices: crossLine ?? undefined,
    outcome: leg ? outcomeFor(leg, side) : undefined,
    commitment: COMMITMENT[mode],
    issuerDisclosure: true,
    actionLabel: leg && collateral && premium ? (mode === 'write' ? `Write ${leg.kind}, lock ${moneyText(collateral)}` : `Post request, escrow ${moneyText(premium)}`) : mode === 'write' ? 'Write' : 'Post request',
    chartTitle: leg ? `Payoff at the deadline, ${side} ${leg.kind} on ${moneyText({ token: u, amount: leg.underlyingQty })}` : null,
    series: { assetId: u.contractId, code: u.code, kind: form.kind, strike: form.strike === '' ? undefined : form.strike, expiry: form.expiry ?? undefined },
    bestOfferId: series ? (bestBuyable?.id ?? null) : undefined,
    reference,
  }

  const another = { label: mode === 'write' ? WRITE_ANOTHER : POST_ANOTHER, onClick: () => setGeneration((g) => g + 1) }
  const flowKey = `${mode}:${generation}`
  const startAt = generation === 0 ? props.startAt : undefined

  if (mode === 'write') {
    const receipt = (result: { id: bigint } | null): ReceiptView => ({
      title: receiptTitle('write', form.kind),
      serial: result ? serialOf(result.id) : undefined,
      serialLabel: 'Offer No.',
      glyph: glyphOf('short', form.kind),
      kind: `${positionWords('short', form.kind)}, ${u.code}`,
      terms: leg ? receiptTerms(leg, 'Premium asked', collateral) : [],
      state: 'Offered',
      reminder: receiptReminder('write', form.kind),
      calendar: null,
      link: result ? { label: 'View offer', to: '/portfolio/$id', params: { id: result.id.toString() } } : { label: 'View portfolio', to: '/portfolio', search: { tab: 'orders' } },
      another,
    })
    return <Flow key={flowKey} deal={deal} tx={write} start={() => write.run(offer!)} receipt={receipt} startAt={startAt} />
  }
  const receipt = (result: { id: bigint } | null): ReceiptView => ({
    title: receiptTitle('bid', form.kind),
    serial: result ? serialOf(result.id) : undefined,
    serialLabel: 'Request No.',
    glyph: glyphOf('long', form.kind),
    kind: `Request, ${form.kind} on ${u.code}`,
    terms: leg ? receiptTerms(leg, 'Premium escrowed', null) : [],
    state: 'Open',
    reminder: receiptReminder('bid', form.kind),
    calendar: null,
    link: { label: 'View my requests', to: '/requests', search: { mine: '1' } },
    another,
  })
  return <Flow key={flowKey} deal={deal} tx={bid} start={() => bid.run(offer!)} receipt={receipt} startAt={startAt} />
}
