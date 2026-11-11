// Buy a maker's funded offer: the buyer pays the premium and becomes the holder. One offer is one lot.
import { useMemo } from 'react'
import { PREMIUM_DISCLOSURE } from '../../core/disclosures'
import { formatUtc } from '../../core/format'
import type { PreTradeAction } from '../../core/options/preTrade'
import { requiredCollateral } from '../../core/options/types'
import type { OptionOffer } from '../../core/options/types'
import { plainDecimal } from '../../core/series'
import { isNotFoundMessage, useBalancesById, useBuy, useMe, useOption, useReference } from '../../data'
import { CONSENT, LOADING_TITLE, optionPhrase, receiptReminder, receiptTitle, settlementSentence, signSummary, ticketTitle } from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { errorText, moneyText, priceText, readAtText } from './fmt'
import type { TicketIntent } from './intent'
import { Party } from './parts'
import { calendarFor } from './calendar'
import type { ReceiptView } from './ReceiptStep'
import { breakevenRow, deadlineRow, kindRow, moneyRow, mostYouCanLoseRow, nothingRow, quantityRow, receiptTerms, strikeRow } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { exerciseGives, exerciseReceives, glyphOf, positionWords, premiumPerUnit, serialOf, strikePerUnit } from './terms'
import { TermsList } from './TermsList'

export function BuyFlow({ intent, startAt }: { intent: Extract<TicketIntent, { mode: 'buy' }>; startAt?: 'terms' | 'review' }) {
  // Kept fresh while the ticket is open: the offer can be bought, cancelled or expire under the reader.
  const query = useOption(intent.offerId, { cadence: 'book' })
  const offer = query.data
  if (!offer) {
    if (query.isError) {
      // An id the contract does not have is not a failed read: there is nothing to try again.
      if (isNotFoundMessage(errorText(query.error))) return <FlowGone title={LOADING_TITLE.buy} sentence="This offer does not exist." hint={`The contract has no option No. ${serialOf(intent.offerId)}. Pick an offer in the chain.`} />
      return <FlowError title={LOADING_TITLE.buy} what={`Offer ${serialOf(intent.offerId)}`} onRetry={() => void query.refetch()} />
    }
    return <FlowLoading title={LOADING_TITLE.buy} />
  }
  if (offer.state === 'cancelled' || offer.state === 'reclaimed' || offer.state === 'settled') {
    return <FlowGone title={LOADING_TITLE.buy} sentence="This offer is closed." hint="It was cancelled or has run its course. Pick another offer in the chain." />
  }
  return <BuyTicket offer={offer} readAt={query.isPlaceholderData ? 0 : query.dataUpdatedAt} startAt={startAt} />
}

function BuyTicket({ offer, readAt, startAt }: { offer: OptionOffer; readAt: number; startAt?: 'terms' | 'review' }) {
  const me = useMe()
  const buy = useBuy()
  const reference = useReference(offer.underlying)
  const u = offer.underlying
  const q = offer.quote
  const tokens = useMemo(() => [u, q], [u, q])
  const balances = useBalancesById(me, tokens)
  const action = useMemo<PreTradeAction>(() => ({ type: 'buy', offer }), [offer])

  const premium = { token: q, amount: offer.totalPremium }
  const collateral = requiredCollateral(offer)
  const strike = strikePerUnit(offer)
  const held = balances.data?.[u.contractId]
  const holding = held?.status === 'ok' && held.balance !== null ? ` You hold ${moneyText({ token: u, amount: held.balance })}.` : ''
  const option = optionPhrase(offer.kind, moneyText({ token: u, amount: offer.underlyingQty }), priceText(strike, q), formatUtc(offer.expiry))

  const deal: Deal = {
    mode: 'buy',
    title: ticketTitle('buy', offer.kind, u.code),
    summary: signSummary('buy', option, { pays: moneyText(premium) }),
    leg: offer,
    side: 'long',
    action,
    terms: (
      <TermsList
        rows={[
          kindRow(offer.kind),
          strikeRow(offer),
          deadlineRow(offer.expiry),
          { label: 'Offer', value: `No. ${serialOf(offer.id)}`, hint: <Party role="Maker" address={offer.writer} me={me} /> },
          { label: 'Collateral', value: moneyText(collateral), hint: 'Locked in the contract by the maker before you pay.' },
          { label: 'Premium per unit', value: priceText(premiumPerUnit(offer), q) },
          quantityRow(offer, `The whole offer: it is bought in one piece.${holding}`),
        ]}
        total={{ label: 'You pay', value: moneyText(premium) }}
      />
    ),
    termsError: null,
    impact: [
      moneyRow('You pay', premium, PREMIUM_DISCLOSURE),
      nothingRow('You lock'),
      breakevenRow(offer, 'long'),
      mostYouCanLoseRow(offer, 'long'),
      deadlineRow(offer.expiry, true),
      { label: 'Counterparty', value: <Party role="Maker" address={offer.writer} me={me} />, hint: `${moneyText(collateral)} locked in the contract` },
    ],
    readAt: readAtText(readAt),
    settlement: settlementSentence('long', offer.kind, moneyText(exerciseGives(offer)), moneyText(exerciseReceives(offer))),
    issuerDisclosure: true,
    consent: CONSENT.buy,
    actionLabel: `Pay ${moneyText(premium)}`,
    chartTitle: `Payoff at expiry, long ${offer.kind} on ${moneyText({ token: u, amount: offer.underlyingQty })}`,
    series: { assetId: u.contractId, kind: offer.kind, strike: strike === null ? undefined : plainDecimal(strike, q.decimals), expiry: offer.expiry },
    bestOfferId: offer.id,
    reference,
  }

  const receipt = (): ReceiptView => ({
    title: receiptTitle('buy', offer.kind),
    serial: serialOf(offer.id),
    glyph: glyphOf('long', offer.kind),
    kind: `${positionWords('long', offer.kind)}, ${u.code}`,
    terms: receiptTerms(offer, 'Premium paid', collateral),
    state: 'Active',
    reminder: receiptReminder('buy', offer.kind),
    calendar: calendarFor(offer, offer.id),
    link: { label: 'View position', to: '/portfolio/$id', params: { id: offer.id.toString() } },
  })

  return <Flow deal={deal} tx={buy} start={() => buy.run(offer)} receipt={receipt} startAt={startAt} />
}
