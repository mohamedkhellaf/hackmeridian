// List a held option for sale at a price the holder sets, or change the price of a listing. A buyer pays the
// holder and becomes the holder; the collateral stays locked in the contract. The price is typed per unit, as the
// premium of write and request is; the contract gets the exact total, and the form shows it as a row.
//
// The chain records the premium the option was first bought for, not what this holder paid for it (a resale
// price is not recorded): the ticket names it "Original premium" and derives no loss or breakeven from it.
import { useMemo, useState } from 'react'
import { formatUtc } from '../../core/format'
import { parseAmount } from '../../core/options/format'
import type { PreTradeAction } from '../../core/options/preTrade'
import { requiredCollateral } from '../../core/options/types'
import type { OptionOffer } from '../../core/options/types'
import { lowestOpenInSeriesOf } from '../../core/maker/lowestOffer'
import { exerciseValue } from '../../core/reference/moneyness'
import { plainAmount } from '../../core/units'
import { isNotFoundMessage, useAsk, useCancelSale, useListForSale, useMe, useNowSec, useOption, useOptions, useReference } from '../../data'
import type { NoteTerm } from '../../ui'
import { AmountField, Button } from '../../ui'
import {
  CANCEL_LISTING,
  CANCEL_LISTING_REMINDER,
  COMMITMENT,
  LISTING_CANCELLED,
  LOADING_TITLE,
  NOT_HOLDER,
  NOT_LISTED,
  ORIGINAL_PREMIUM_HINT,
  SAME_PRICE,
  cancelListingCommitment,
  cancelListingSummary,
  cancelListingTitle,
  listingNote,
  receiptReminder,
  receiptTitle,
  reviewTitle,
  signSummary,
  ticketTitle,
} from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { errorText, moneyText, priceText } from './fmt'
import type { TicketIntent } from './intent'
import type { ReceiptView } from './ReceiptStep'
import { MoneyText, PriceText } from './parts'
import { deadlineRow, kindRow, leadRow, moneyRow, partyRow, quantityRow, strikeRow } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { glyphOf, positionWords, premiumPerUnit, serialOf, strikePerUnit } from './terms'
import { TermsList } from './TermsList'
import styles from './ListFlow.module.css'

export function ListFlow({ intent, startAt }: { intent: Extract<TicketIntent, { mode: 'list' }>; startAt?: 'terms' | 'review' }) {
  const option = useOption(intent.optionId, { cadence: 'book' })
  const ask = useAsk(intent.optionId)
  // Whether this is a first listing or a change of price is decided once, when the ticket opens.
  const [opened, setOpened] = useState<{ current: bigint | null } | null>(null)
  const o = option.data
  if (opened === null && o && ask.data !== undefined) setOpened({ current: ask.data })

  const title = LOADING_TITLE.list
  if (!o || opened === null) {
    if (option.isError && isNotFoundMessage(errorText(option.error))) {
      return <FlowGone title={title} sentence="This option does not exist." hint={`The contract has no option No. ${serialOf(intent.optionId)}. Open one of your positions in Portfolio.`} />
    }
    if (option.isError || ask.isError) {
      return (
        <FlowError
          title={title}
          what={`Option No. ${serialOf(intent.optionId)}`}
          onRetry={() => {
            void option.refetch()
            void ask.refetch()
          }}
        />
      )
    }
    return <FlowLoading title={title} />
  }
  if (o.state === 'offered' || o.holder === null) return <FlowGone title={title} sentence="Only a bought option can be sold on." hint="This one is still an open offer of its maker." />
  return <ListTicket option={o} current={opened.current} readAt={option.isPlaceholderData ? 0 : option.dataUpdatedAt} startAt={startAt} />
}

/** The price per unit for a total over the option's quantity, when it is exact; else null (the field then starts empty). */
function exactUnitPrice(total: bigint, o: OptionOffer): string | null {
  const scaled = total * 10n ** BigInt(o.underlying.decimals)
  if (o.underlyingQty <= 0n || scaled % o.underlyingQty !== 0n) return null
  return plainAmount(scaled / o.underlyingQty, o.quote.decimals)
}

/** The exact total for a price per unit, or `inexact` when the product is not a whole number of quote units. */
function totalOf(unitPrice: bigint, o: OptionOffer): bigint | 'inexact' {
  const scaled = unitPrice * o.underlyingQty
  const base = 10n ** BigInt(o.underlying.decimals)
  return scaled % base === 0n ? scaled / base : 'inexact'
}

function ListTicket({ option: o, current, readAt, startAt }: { option: OptionOffer; current: bigint | null; readAt: number; startAt?: 'terms' | 'review' }) {
  const me = useMe()
  const list = useListForSale()
  const reference = useReference(o.underlying)
  const u = o.underlying
  const q = o.quote
  const repricing = current !== null
  const [text, setText] = useState(() => (current === null ? '' : (exactUnitPrice(current, o) ?? '')))
  // A listed option can also be taken off sale from here: the same ticket, its own review.
  const [cancelling, setCancelling] = useState(false)

  const unitPrice = parseAmount(text, q.decimals)
  const total = unitPrice !== null && unitPrice > 0n ? totalOf(unitPrice, o) : null
  const askTotal = typeof total === 'bigint' && total > 0n ? total : null
  const invalid =
    text.trim() === ''
      ? `Enter the price per ${u.code}, in ${q.code}.`
      : unitPrice === null
        ? `Enter an amount with at most ${q.decimals} decimals.`
        : unitPrice <= 0n || total === 0n
          ? 'The price must be above zero.'
          : total === 'inexact'
            ? 'Price × quantity is not an exact amount; adjust the price.'
            : current !== null && askTotal === current
              ? SAME_PRICE
              : null
  const action = useMemo<PreTradeAction>(() => ({ type: 'list-for-sale', option: o, askTotal }), [o, askTotal])

  const price = askTotal === null ? null : { token: q, amount: askTotal }
  const collateral = requiredCollateral(o)
  const strike = strikePerUnit(o)
  const priceLabel = price ? moneyText(price) : ''
  const original = moneyRow('Original premium', { token: q, amount: o.totalPremium }, ORIGINAL_PREMIUM_HINT)

  // What helps set a price: what exercising is worth at the reference, and the cheapest offer of the same series.
  const options = useOptions()
  const nowSec = useNowSec(60)
  const worth = exerciseValue(o, reference)
  const worthRow: NoteTerm[] =
    worth !== null && reference.perUnit !== null
      ? [moneyRow('Exercise value', { token: q, amount: worth > 0n ? worth : 0n }, `At the ${reference.label.toLowerCase()} ${priceText(reference.perUnit, q)}.`)]
      : []
  const ofSeries = useMemo(() => (options.data ?? []).filter((x) => x.state === 'offered' && x.expiry > nowSec && x.underlying.contractId === u.contractId), [options.data, nowSec, u.contractId])
  const lowest = strike !== null ? lowestOpenInSeriesOf(ofSeries, { kind: o.kind, underlying: u, strikePerUnit: strike, expiry: o.expiry }, q) : null
  const lowestRow: NoteTerm[] = lowest
    ? [{ label: 'Lowest open offer in this series', value: <PriceText units={premiumPerUnit(lowest)} quote={q} per={u.code} />, hint: `Offer No. ${serialOf(lowest.id)}, for ${moneyText({ token: u, amount: lowest.underlyingQty })}.` }]
    : []

  const deal: Deal = {
    mode: 'list',
    title: ticketTitle('list', o.kind, u.code, repricing),
    reviewTitle: reviewTitle('list', repricing),
    summary: signSummary('list', `your ${o.kind} on ${moneyText({ token: u, amount: o.underlyingQty })}`, { receives: priceLabel }),
    // The terms being sold; the review draws no payoff figure (keeping and selling are different questions).
    leg: askTotal === null || invalid !== null ? null : o,
    side: 'long',
    action,
    terms: (
      <>
        <TermsList
          rows={[kindRow(o.kind), strikeRow(o), deadlineRow(o.expiry), quantityRow(o), original, ...worthRow, ...lowestRow, ...(current !== null ? [moneyRow('Listed now', { token: q, amount: current })] : [])]}
          total={{ label: 'You receive when bought', value: price ? <MoneyText money={price} size="lg" /> : '–', marked: price !== null }}
        >
          <div className={styles.price}>
            <AmountField label={`Your price per ${u.code}`} value={text} onValueChange={setText} unit={q.code} decimals={q.decimals} validate={() => invalid} />
          </div>
        </TermsList>
        <p className={styles.note}>{listingNote(q.code, repricing)}</p>
        {repricing ? (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setCancelling(true)}>
              {CANCEL_LISTING}
            </Button>
          </div>
        ) : null}
      </>
    ),
    termsError: invalid,
    serial: `Option No. ${serialOf(o.id)}`,
    money: price ? [leadRow('You receive', price)] : [],
    details: [strikeRow(o), quantityRow(o), deadlineRow(o.expiry), original, partyRow('Maker', o.writer, me)],
    readAt,
    commitment: COMMITMENT.list,
    issuerDisclosure: false,
    actionLabel: `List for ${priceLabel}`,
    chartTitle: null,
    series: null,
    reference,
  }

  const receipt = (): ReceiptView => ({
    title: receiptTitle('list', o.kind, repricing),
    serial: serialOf(o.id),
    glyph: glyphOf('long', o.kind),
    kind: `${positionWords('long', o.kind)}, ${u.code}, for sale`,
    terms: [
      { label: 'Your price', value: price ? <MoneyText money={price} /> : priceLabel, marked: true },
      { label: 'Strike', value: <PriceText units={strike} quote={q} per={u.code} /> },
      { label: 'Quantity', value: <MoneyText money={{ token: u, amount: o.underlyingQty }} /> },
      { label: 'Deadline', value: formatUtc(o.expiry) },
      {
        label: 'Collateral',
        value: (
          <>
            <MoneyText money={collateral} /> in the contract
          </>
        ),
      },
    ],
    state: 'Listed',
    reminder: receiptReminder('list', o.kind),
    calendar: null,
    link: { label: 'View position', to: '/portfolio/$id', params: { id: o.id.toString() } },
  })

  if (cancelling && current !== null) return <CancelListing option={o} current={current} readAt={readAt} onBack={() => setCancelling(false)} />
  return <Flow deal={deal} tx={list} start={() => list.run(o, askTotal ?? 0n)} receipt={receipt} startAt={startAt} />
}

/** Why a listing cannot be cancelled now, from what was read: null when it can (or while nothing is known yet). */
function cancelBlocked(option: OptionOffer, listed: bigint | null | undefined, me: string | null): string | null {
  if (me !== null && option.holder !== me) return NOT_HOLDER
  if (listed === null) return NOT_LISTED
  return null
}

/** Takes a listing off sale: the option stays with its holder. Opened from the Change price ticket. */
function CancelListing({ option, current, readAt, onBack }: { option: OptionOffer; current: bigint; readAt: number; onBack: () => void }) {
  const me = useMe()
  const cancel = useCancelSale()
  const reference = useReference(option.underlying)
  const fresh = useOption(option.id, { cadence: 'book' })
  const ask = useAsk(option.id, { cadence: 'book' })
  const o = fresh.data ?? option
  const u = o.underlying
  const q = o.quote
  const listed = ask.data
  const price = { token: q, amount: typeof listed === 'bigint' ? listed : current }
  const qty = moneyText({ token: u, amount: o.underlyingQty })

  const deal: Deal = {
    mode: 'list',
    title: cancelListingTitle(o.kind, u.code),
    summary: cancelListingSummary(o.kind, qty, moneyText(price)),
    leg: o,
    side: 'long',
    action: null,
    check: {
      blocked: cancelBlocked(o, listed, me),
      pending: listed === undefined,
      recheck: async () => {
        const [option2, ask2] = await Promise.all([fresh.refetch(), ask.refetch()])
        return cancelBlocked(option2.data ?? o, ask2.isError ? undefined : ask2.data, me)
      },
    },
    back: onBack,
    terms: null,
    termsError: null,
    serial: `Option No. ${serialOf(o.id)}`,
    money: [leadRow('Listed now', price)],
    details: [strikeRow(o), quantityRow(o), deadlineRow(o.expiry)],
    readAt,
    commitment: cancelListingCommitment(o.kind, qty, moneyText(price)),
    issuerDisclosure: false,
    actionLabel: CANCEL_LISTING,
    chartTitle: null,
    series: null,
    reference,
  }

  const receipt = (): ReceiptView => ({
    title: LISTING_CANCELLED,
    serial: serialOf(o.id),
    glyph: glyphOf('long', o.kind),
    kind: `${positionWords('long', o.kind)}, ${u.code}`,
    terms: [
      { label: 'Strike', value: <PriceText units={strikePerUnit(o)} quote={q} per={u.code} /> },
      { label: 'Quantity', value: <MoneyText money={{ token: u, amount: o.underlyingQty }} /> },
      { label: 'Deadline', value: formatUtc(o.expiry) },
    ],
    state: 'Active',
    reminder: CANCEL_LISTING_REMINDER,
    calendar: null,
    link: { label: 'View position', to: '/portfolio/$id', params: { id: o.id.toString() } },
  })

  return <Flow deal={deal} tx={cancel} start={() => cancel.run(o)} receipt={receipt} />
}
