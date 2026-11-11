// The two tickets with a form of terms: write an offer (lock the collateral, ask a premium) and post a request
// (escrow a premium, wait for a seller). Same fields, same validator; they differ in who locks what.
//
// The form defaults to the standard grid (listed expiries, the strike ladder around the reference price). The
// contract accepts any terms, so "Custom terms" opens a strike and an expiry of the user's own.
import { Link as RouterLink } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { PRO_ENABLED } from '../../core/config'
import { COLLATERAL_CARDS, bidEscrowDisclosure } from '../../core/disclosures'
import type { CollateralChoice } from '../../core/disclosures'
import { MARGIN_TRADE_HREF } from '../../core/market/marginAck'
import { formatUnits, formatUtc, formatUtcDay, secondsUntil } from '../../core/format'
import { lowestOpenInSeriesOf } from '../../core/maker/lowestOffer'
import type { SeriesTermsRef } from '../../core/maker/lowestOffer'
import type { PreTradeAction } from '../../core/options/preTrade'
import { MAX_OPEN_PER_WRITER, requiredCollateral } from '../../core/options/types'
import type { NewOffer, OptionKind, OptionOffer, SupportedAssets, TokenInfo } from '../../core/options/types'
import { MAX_OPEN_BIDS_PER_BUYER } from '../../core/requests/types'
import { plainAmount } from '../../core/units'
import { useAssets, useBalancesById, useBuyerOpenCount, useCreateBid, useMe, useNowSec, useOptions, useReference, useWriteOffer, useWriterOpenCount } from '../../data'
import { AmountField, ButtonLink, ChoiceChips, RadioGroup, Segmented, TextField } from '../../ui'
import type { ChoiceChip, NoteTerm } from '../../ui'

import { CONSENT, CUSTOM_TERMS_HINT, CUSTOM_TERMS_LABEL, LOADING_TITLE, MARGIN_ELSEWHERE, MARGIN_NOT_HERE, OFF_GRID_NOTE, WRITE_STANDING_NOTE, optionPhrase, receiptReminder, receiptTitle, settlementSentence, signSummary, ticketTitle } from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { moneyText, priceText } from './fmt'
import { chipCountdown, draftOf, gridFor, initialForm, isOnGrid, parseUtcDateTime, strikeText, strikeUnitsOf, takeOver, utcDateTimeFields } from './form'
import type { FormField, Grid, TermsForm } from './form'
import type { FormIntent, TicketIntent } from './intent'
import type { ReceiptView } from './ReceiptStep'
import { breakevenRow, deadlineRow, moneyRow, mostYouCanLoseRow, perUnitPhrase, receiptTerms } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { exerciseGives, exerciseReceives, glyphOf, positionWords, premiumPerUnit, serialOf, strikePerUnit } from './terms'
import type { Leg } from './terms'
import { TermsList } from './TermsList'
import styles from './OrderFlow.module.css'

const KINDS: { value: OptionKind; label: string }[] = [
  { value: 'put', label: 'Put' },
  { value: 'call', label: 'Call' },
]

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

/** The open offers of one asset, and the cheapest one in a series that `me` could buy. */
function useSeriesOffers(underlying: TokenInfo, me: string | null, nowSec: number): { ofAsset: OptionOffer[]; buyable: OptionOffer[] } {
  const options = useOptions()
  return useMemo(() => {
    const ofAsset = (options.data ?? []).filter((o) => o.state === 'offered' && o.underlying.contractId === underlying.contractId && o.expiry > nowSec)
    return { ofAsset, buyable: ofAsset.filter((o) => o.writer !== me) }
  }, [options.data, underlying.contractId, me, nowSec])
}

function OrderTicket(props: { intent: FormIntent; assets: SupportedAssets; underlying: TokenInfo; startAt?: 'terms' | 'review'; onIntentChange?: (next: TicketIntent) => void }) {
  const { intent, assets, underlying: u, onIntentChange } = props
  const mode = intent.mode
  const q = assets.quote
  const me = useMe()
  const write = useWriteOffer()
  const bid = useCreateBid()
  const reference = useReference(u)
  const nowSec = useNowSec(60)
  const offers = useSeriesOffers(u, me, nowSec)
  const grid = useMemo<Grid>(() => gridFor({ nowSec, referencePerUnit: reference.perUnit, quoteDecimals: q.decimals, existing: offers.ofAsset }), [nowSec, reference.perUnit, q.decimals, offers.ofAsset])

  const [form, setForm] = useState<TermsForm>(() => initialForm(intent, grid, reference.perUnit, q.decimals))
  const [custom, setCustom] = useState(() => !isOnGrid(form, grid, q.decimals))
  const [when, setWhen] = useState(() => (form.expiry === null ? { date: '', time: '08:00' } : utcDateTimeFields(form.expiry)))
  // A writer may be looking for the other regime. Full collateral is the default; Margin is never mixed in here.
  const [collateralChoice, setCollateralChoice] = useState<CollateralChoice>('full')
  const offersChoice = PRO_ENABLED && mode === 'write'
  const marginChosen = offersChoice && collateralChoice === 'margin'

  // The URL can change under the form (another cell of the chain is chosen): the form takes those terms over.
  // Its own echo differs in nothing, so typing and choosing never fight the address bar.
  const urlTerms = `${intent.kind}|${intent.strike ?? ''}|${intent.expiry ?? ''}|${intent.qty ?? ''}|${intent.premium ?? ''}`
  const [seenUrl, setSeenUrl] = useState(urlTerms)
  if (urlTerms !== seenUrl) {
    setSeenUrl(urlTerms)
    const patch = takeOver(form, intent, { underlying: u.decimals, quote: q.decimals })
    if (patch) {
      setForm({ ...form, ...patch })
      if (patch.expiry != null) setWhen(utcDateTimeFields(patch.expiry))
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
    if (next.premium !== '') out.premium = next.premium
    onIntentChange(out)
  }
  const mirrorNow = () => change({})

  const draft = useMemo(() => draftOf(form, u, assets), [form, u, assets])
  const offer: NewOffer | null = draft.ok ? draft.offer : null
  const leg = useMemo<Leg | null>(() => (offer ? { ...offer, quote: q } : null), [offer, q])
  const action = useMemo<PreTradeAction | null>(() => (offer && !marginChosen ? (mode === 'write' ? { type: 'write-offer', offer, quote: q } : { type: 'post-bid', bid: offer, quote: q }) : null), [offer, mode, q, marginChosen])

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

  const fieldError = (field: FormField) => (!draft.ok && draft.field === field ? draft.error : undefined)
  const collateral = leg ? requiredCollateral(leg) : null
  const premium = leg ? { token: q, amount: leg.totalPremium } : null
  const collateralToken = form.kind === 'put' ? q : u
  const spends = mode === 'write' ? collateral : premium
  const spendToken = mode === 'write' ? collateralToken : q
  const held = balances.data?.[spendToken.contractId]
  const have = held?.status === 'ok' && held.balance !== null ? held.balance : null
  const underlyingHeld = balances.data?.[u.contractId]
  const haveUnderlying = underlyingHeld?.status === 'ok' && underlyingHeld.balance !== null ? underlyingHeld.balance : null
  const onGrid = isOnGrid(form, grid, q.decimals)

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
    : { label: 'Lowest open offer in this series', value: 'None open', hint: mode === 'write' ? 'Yours would be the first offer on this series.' : 'Nobody sells this series yet: a request is the way to ask for it.' }

  const summaryRows: NoteTerm[] = []
  if (leg && collateral && premium) {
    if (mode === 'write') {
      summaryRows.push(moneyRow('You lock', collateral, 'In the contract, until you cancel the offer or the option runs its course.'))
      summaryRows.push({ label: 'Premium per unit', value: priceText(premiumPerUnit(leg), q) })
    } else {
      summaryRows.push(moneyRow('Total strike', { token: q, amount: leg.totalStrike }, `What ${form.kind === 'put' ? 'you would receive' : 'you would pay'} on exercise.`))
      summaryRows.push({ label: 'Premium per unit', value: priceText(premiumPerUnit(leg), q) })
    }
  }
  summaryRows.push(lowestRow)
  if (spends && have !== null && have >= spends.amount) summaryRows.push(moneyRow(`${spendToken.code} balance after`, { token: spendToken, amount: have - spends.amount }))

  const option = leg ? optionPhrase(leg.kind, moneyText({ token: u, amount: leg.underlyingQty }), priceText(strikePerUnit(leg), q), formatUtc(leg.expiry)) : ''
  const escrow = premium ? bidEscrowDisclosure(moneyText(premium)) : null

  const choice = offersChoice ? (
    <RadioGroup label="Collateral" value={collateralChoice} onValueChange={setCollateralChoice} options={COLLATERAL_CARDS.map((c) => ({ value: c.value, label: c.title, description: c.body }))} />
  ) : null

  const terms = marginChosen ? (
    <div className={styles.form}>
      {choice}
      <p className={styles.hint}>{MARGIN_ELSEWHERE}</p>
      <div>
        <ButtonLink variant="secondary" render={<RouterLink to={MARGIN_TRADE_HREF as never} />}>
          Continue in Margin
        </ButtonLink>
      </div>
    </div>
  ) : (
    <div className={styles.form}>
      {choice}
      <Segmented label="Kind" showLabel fullWidth value={form.kind} onValueChange={(kind) => change({ kind })} options={KINDS} />
      <ChoiceChips
        label="Expiry"
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
              label="Expiry date, UTC"
              value={when.date}
              placeholder="2026-12-18"
              inputMode="numeric"
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
              inputMode="numeric"
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
      <AmountField
        label="Quantity"
        value={form.qty}
        onValueChange={(qty) => change({ qty }, false)}
        onBlur={mirrorNow}
        unit={u.code}
        decimals={u.decimals}
        validate={() => fieldError('qty')}
        aside={haveUnderlying !== null ? `You hold ${moneyText({ token: u, amount: haveUnderlying })}` : undefined}
        onMax={mode === 'write' && form.kind === 'call' && haveUnderlying !== null && haveUnderlying > 0n ? () => change({ qty: plainAmount(haveUnderlying, u.decimals) }) : undefined}
        maxLabel={haveUnderlying !== null ? `use the full balance, ${moneyText({ token: u, amount: haveUnderlying })}` : undefined}
      />
      <AmountField
        label={mode === 'write' ? 'Premium you ask, in total' : 'Premium you offer, in total'}
        value={form.premium}
        onValueChange={(premiumText) => change({ premium: premiumText }, false)}
        onBlur={mirrorNow}
        unit={q.code}
        decimals={q.decimals}
        validate={() => fieldError('premium')}
        hint={leg ? `${perUnitPhrase(premiumPerUnit(leg), q, u)}.` : `For the whole quantity, in ${q.code}.`}
      />
      <TermsList
        rows={summaryRows}
        total={
          leg && premium
            ? mode === 'write'
              ? { label: 'You receive when bought', value: moneyText(premium), hint: WRITE_STANDING_NOTE }
              : { label: 'You escrow', value: moneyText(premium), hint: <span data-testid="escrow-line">{escrow}</span> }
            : undefined
        }
      />
      {!onGrid && leg ? <p className={styles.hint}>{OFF_GRID_NOTE}</p> : null}
    </div>
  )

  const openCount = mode === 'write' ? writerOpen.data : buyerOpen.data
  const capRow: NoteTerm[] = typeof openCount === 'number' ? [{ label: mode === 'write' ? 'Your open offers' : 'Your open requests', value: `${openCount} of ${mode === 'write' ? MAX_OPEN_PER_WRITER : MAX_OPEN_BIDS_PER_BUYER}`, hint: 'The contract caps how many can be open at once.' }] : []

  const impact: NoteTerm[] = !leg || !collateral || !premium
    ? []
    : mode === 'write'
      ? [
          moneyRow('You lock', collateral, 'In the contract. It comes back when you cancel the offer, or when you reclaim after the deadline.'),
          moneyRow('You receive', premium, 'From the buyer, only when someone takes the offer. Nothing until then.'),
          breakevenRow(leg, 'short'),
          mostYouCanLoseRow(leg, 'short'),
          deadlineRow(leg.expiry, true),
          { label: 'Counterparty', value: 'None yet', hint: 'Any account the issuer has authorized can buy the offer.' },
        ]
      : [
          moneyRow('You pay', premium, escrow ?? undefined),
          { label: 'You lock', value: 'Nothing more', hint: `The seller who fills the request locks ${moneyText(collateral)} in the contract.` },
          breakevenRow(leg, 'long'),
          mostYouCanLoseRow(leg, 'long'),
          deadlineRow(leg.expiry, true),
          { label: 'Counterparty', value: 'None yet', hint: 'The first seller to fill the request. The premium is paid at that moment.' },
        ]

  const side = mode === 'write' ? 'short' : 'long'
  const kindForTitle = form.kind
  const deal: Deal = {
    mode,
    title: ticketTitle(mode, kindForTitle, u.code),
    summary: leg && collateral && premium ? signSummary(mode, option, mode === 'write' ? { locks: moneyText(collateral), receives: moneyText(premium) } : { locks: moneyText(premium) }) : '',
    leg,
    side,
    action,
    terms,
    termsError: marginChosen ? MARGIN_NOT_HERE : draft.ok ? null : draft.error,
    warnOnTerms: !marginChosen,
    impact,
    extra: [...capRow, lowestRow],
    settlement: leg ? settlementSentence(side, leg.kind, moneyText(exerciseGives(leg)), moneyText(exerciseReceives(leg))) : undefined,
    issuerDisclosure: false,
    consent: CONSENT[mode],
    actionLabel: leg && collateral && premium ? (mode === 'write' ? `Write ${leg.kind}, lock ${moneyText(collateral)}` : `Post request, escrow ${moneyText(premium)}`) : mode === 'write' ? 'Write' : 'Post request',
    chartTitle: leg ? `Payoff at expiry, ${side} ${leg.kind} on ${moneyText({ token: u, amount: leg.underlyingQty })}` : '',
    series: { assetId: u.contractId, kind: form.kind, strike: form.strike === '' ? undefined : form.strike, expiry: form.expiry ?? undefined },
    bestOfferId: series ? (bestBuyable?.id ?? null) : undefined,
    reference,
  }

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
    })
    return <Flow deal={deal} tx={write} start={() => write.run(offer!)} receipt={receipt} startAt={props.startAt} />
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
  })
  return <Flow deal={deal} tx={bid} start={() => bid.run(offer!)} receipt={receipt} startAt={props.startAt} />
}
