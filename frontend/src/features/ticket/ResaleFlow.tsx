// Buy an option from its holder at the price the holder set. The buyer pays the seller, not the maker; the
// collateral stays where it is. The price the buyer reviewed is the most the contract may take (max_total).
// There is nothing to set, so the ticket opens on its review.
import { useMemo, useState } from 'react'
import { RESALE_PRICE_DISCLOSURE } from '../../core/disclosures'
import { formatUtc } from '../../core/format'
import type { PreTradeAction } from '../../core/options/preTrade'
import { requiredCollateral } from '../../core/options/types'
import type { Ask, OptionOffer } from '../../core/options/types'
import { plainDecimal } from '../../core/series'
import { isNotFoundMessage, useAsk, useBuyResale, useMe, useOption, useReference } from '../../data'
import { calendarFor } from './calendar'
import { COMMITMENT, LOADING_TITLE, RESALE_NOTE, optionPhrase, receiptReminder, receiptTitle, signSummary, ticketTitle } from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { errorText, moneyText, priceText } from './fmt'
import type { TicketIntent } from './intent'
import type { ReceiptView } from './ReceiptStep'
import { breakevenRow, deadlineRow, leadRow, moneyRow, mostYouCanLoseRow, partyRow, quantityRow, receiptTerms, strikeRow } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { glyphOf, positionWords, serialOf, strikePerUnit } from './terms'
import type { Leg } from './terms'
import { holderWords, outcomeFor } from './words'

export function ResaleFlow({ intent }: { intent: Extract<TicketIntent, { mode: 'buy-resale' }> }) {
  const option = useOption(intent.optionId, { cadence: 'book' })
  const ask = useAsk(intent.optionId, { cadence: 'book' })
  // The listing as the buyer first saw it. A later change of price never slips in: it blocks until reviewed.
  const [seen, setSeen] = useState<Ask | null>(null)
  const o = option.data
  const live = ask.data
  if (seen === null && o && o.holder && live != null) setSeen({ id: o.id, holder: o.holder, askTotal: live })

  const title = LOADING_TITLE['buy-resale']
  if (!o || live === undefined) {
    if (option.isError && isNotFoundMessage(errorText(option.error))) {
      return <FlowGone title={title} sentence="This listing does not exist." hint={`The contract has no option No. ${serialOf(intent.optionId)}. Pick a listing in the chain.`} />
    }
    if (option.isError || ask.isError) {
      return (
        <FlowError
          title={title}
          what={`Listing ${serialOf(intent.optionId)}`}
          onRetry={() => {
            void option.refetch()
            void ask.refetch()
          }}
        />
      )
    }
    return <FlowLoading title={title} />
  }
  if (seen === null) return <FlowGone title={title} sentence="This option is not for sale." hint="It was bought, withdrawn, exercised or transferred. Pick another listing in the book." />
  return (
    <ResaleTicket
      option={o}
      seen={seen}
      liveAsk={live}
      readAt={option.isPlaceholderData ? 0 : Math.min(option.dataUpdatedAt, ask.dataUpdatedAt)}
      onAcceptPrice={(askTotal) => setSeen({ ...seen, askTotal })}
    />
  )
}

function ResaleTicket(props: { option: OptionOffer; seen: Ask; liveAsk: bigint | null; readAt: number; onAcceptPrice: (askTotal: bigint) => void }) {
  const { option: o, seen, liveAsk } = props
  const me = useMe()
  const buyResale = useBuyResale()
  const reference = useReference(o.underlying)
  const u = o.underlying
  const q = o.quote
  const action = useMemo<PreTradeAction>(() => ({ type: 'buy-resale', option: o, ask: seen }), [o, seen])

  // The same option, priced at what this buyer pays for it.
  const leg = useMemo<Leg>(() => ({ kind: o.kind, underlying: u, quote: q, underlyingQty: o.underlyingQty, totalStrike: o.totalStrike, totalPremium: seen.askTotal, expiry: o.expiry }), [o, u, q, seen.askTotal])
  const price = { token: q, amount: seen.askTotal }
  const collateral = requiredCollateral(o)
  const strike = strikePerUnit(o)
  const option = optionPhrase(o.kind, moneyText({ token: u, amount: o.underlyingQty }), priceText(strike, q), formatUtc(o.expiry))
  // Still for sale by the same holder at another price: offer to look at that price instead of a dead end.
  const repriced = liveAsk !== null && liveAsk !== seen.askTotal && o.holder === seen.holder
  // No longer for sale by the holder the buyer saw (bought by another account, withdrawn, exercised).
  const gone = o.holder !== seen.holder || liveAsk === null ? 'This option is no longer for sale by the holder you saw.' : undefined

  const deal: Deal = {
    mode: 'buy-resale',
    title: ticketTitle('buy-resale', o.kind, u.code),
    summary: signSummary('buy-resale', option, { pays: moneyText(price) }),
    leg,
    side: 'long',
    action,
    terms: null,
    termsError: null,
    serial: `Listing No. ${serialOf(o.id)}`,
    gone,
    fix: repriced ? { label: `Show the price of ${moneyText({ token: q, amount: liveAsk })}`, onClick: () => props.onAcceptPrice(liveAsk) } : undefined,
    money: [leadRow('You pay', price, RESALE_PRICE_DISCLOSURE), moneyRow('Collateral locked', collateral, RESALE_NOTE)],
    details: [strikeRow(o), quantityRow(o), deadlineRow(o.expiry), breakevenRow(leg), mostYouCanLoseRow(leg, 'long'), partyRow('Seller', seen.holder, me), partyRow('Maker', o.writer, me)],
    readAt: props.readAt,
    outcome: outcomeFor(leg, 'long'),
    commitment: COMMITMENT['buy-resale'],
    issuerDisclosure: true,
    actionLabel: `Pay ${moneyText(price)}`,
    chartTitle: `Payoff at the deadline, long ${o.kind} on ${moneyText({ token: u, amount: o.underlyingQty })}`,
    series: { assetId: u.contractId, code: u.code, kind: o.kind, strike: strike === null ? undefined : plainDecimal(strike, q.decimals), expiry: o.expiry },
    reference,
  }

  const receipt = (): ReceiptView => ({
    title: receiptTitle('buy-resale', o.kind),
    serial: serialOf(o.id),
    glyph: glyphOf('long', o.kind),
    kind: `${positionWords('long', o.kind)}, ${u.code}`,
    terms: receiptTerms(leg, 'Price paid', collateral),
    state: 'Active',
    reminder: receiptReminder('buy-resale', o.kind, holderWords(leg)),
    calendar: calendarFor(leg, o.id),
    link: { label: 'View position', to: '/portfolio/$id', params: { id: o.id.toString() } },
  })

  // The ask the buyer reviewed is the ceiling: a higher live ask is refused by the contract.
  return <Flow deal={deal} tx={buyResale} start={() => buyResale.run(o, seen.askTotal)} receipt={receipt} />
}
