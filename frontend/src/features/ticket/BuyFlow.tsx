// Buy a maker's funded offer: the buyer pays the premium and becomes the holder. One offer is one lot. There is
// nothing to set, so the ticket opens on its review.
import { useMemo, useState } from 'react'
import { PREMIUM_DISCLOSURE } from '../../core/disclosures'
import { formatUtc } from '../../core/format'
import type { PreTradeAction } from '../../core/options/preTrade'
import { requiredCollateral } from '../../core/options/types'
import type { OptionOffer } from '../../core/options/types'
import { plainDecimal } from '../../core/series'
import { lowestOpenInSeriesOf } from '../../core/maker/lowestOffer'
import { isNotFoundMessage, useBuy, useMe, useNowSec, useOption, useOptions, useReference } from '../../data'
import { Button } from '../../ui'
import { COMMITMENT, LOADING_TITLE, optionPhrase, receiptReminder, receiptTitle, signSummary, ticketTitle } from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { errorText, moneyText, priceText } from './fmt'
import type { TicketIntent } from './intent'
import { calendarFor } from './calendar'
import type { ReceiptView } from './ReceiptStep'
import { breakevenRow, deadlineRow, leadRow, moneyRow, mostYouCanLoseRow, partyRow, quantityRow, receiptTerms, strikeRow } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { glyphOf, positionWords, premiumPerUnit, serialOf, strikePerUnit } from './terms'
import { holderWords, outcomeFor } from './words'

export function BuyFlow({ intent, onIntentChange }: { intent: Extract<TicketIntent, { mode: 'buy' }>; onIntentChange?: (next: TicketIntent) => void }) {
  // Kept fresh while the ticket is open: the offer can be bought, cancelled or expire under the reader.
  const query = useOption(intent.offerId, { cadence: 'book' })
  const nowSec = useNowSec(30)
  const offer = query.data
  // Once the ticket has shown the offer open it stays the ticket (a purchase, this one included, changes the state
  // under it; the re-check says so). Opened on an offer that is no longer open, it says that instead.
  const [shownOpen, setShownOpen] = useState(false)
  const open = offer !== undefined && offer.state === 'offered' && offer.expiry > nowSec
  if (open && !shownOpen) setShownOpen(true)
  if (!offer) {
    if (query.isError) {
      // An id the contract does not have is not a failed read: there is nothing to try again.
      if (isNotFoundMessage(errorText(query.error))) return <FlowGone title={LOADING_TITLE.buy} sentence="This offer does not exist." hint={`The contract has no option No. ${serialOf(intent.offerId)}. Pick an offer in the chain.`} />
      return <FlowError title={LOADING_TITLE.buy} what={`Offer No. ${serialOf(intent.offerId)}`} onRetry={() => void query.refetch()} />
    }
    return <FlowLoading title={LOADING_TITLE.buy} />
  }
  if (!open && !shownOpen) {
    // A bought or ended offer is not a term sheet to pay: one sentence, and a request for the same terms.
    const ask = onIntentChange
      ? () => onIntentChange({ mode: 'bid', assetId: offer.underlying.contractId, kind: offer.kind, strike: strikeText(offer), expiry: offer.expiry })
      : undefined
    const sentence =
      offer.state === 'active' || offer.state === 'exercised' || offer.state === 'settled'
        ? 'This offer was bought.'
        : offer.state === 'cancelled'
          ? 'This offer was cancelled.'
          : 'This offer has expired.'
    return (
      <FlowGone
        title={LOADING_TITLE.buy}
        sentence={sentence}
        action={
          ask && offer.expiry > nowSec ? (
            <Button variant="secondary" onClick={ask}>
              Post a request on these terms
            </Button>
          ) : undefined
        }
      />
    )
  }
  return <BuyTicket offer={offer} readAt={query.isPlaceholderData ? 0 : query.dataUpdatedAt} nowSec={nowSec} onIntentChange={onIntentChange} />
}

const strikeText = (o: OptionOffer): string | undefined => {
  const k = strikePerUnit(o)
  return k === null ? undefined : plainDecimal(k, o.quote.decimals)
}

/** Why an offer that was open when the ticket showed it can no longer be bought, in words. Null while it is open. */
function goneReason(offer: OptionOffer, me: string | null, nowSec: number): string | null {
  if (offer.state === 'offered' && offer.expiry > nowSec) return null
  if (offer.state === 'cancelled') return 'The maker cancelled this offer.'
  if (offer.state === 'offered' || offer.state === 'expired' || offer.expiry <= nowSec) return `Its deadline passed at ${formatUtc(offer.expiry)}.`
  return offer.holder === me ? 'You bought this offer.' : 'Another account bought this offer.'
}

function BuyTicket({ offer, readAt, nowSec, onIntentChange }: { offer: OptionOffer; readAt: number; nowSec: number; onIntentChange?: (next: TicketIntent) => void }) {
  const me = useMe()
  const options = useOptions()
  const buy = useBuy()
  const reference = useReference(offer.underlying)
  const u = offer.underlying
  const q = offer.quote
  const action = useMemo<PreTradeAction>(() => ({ type: 'buy', offer }), [offer])

  const premium = { token: q, amount: offer.totalPremium }
  const collateral = requiredCollateral(offer)
  const strike = strikePerUnit(offer)
  const option = optionPhrase(offer.kind, moneyText({ token: u, amount: offer.underlyingQty }), priceText(strike, q), formatUtc(offer.expiry))

  // Taken or ended under the reader: the way on is the next offer of the same series, else a request on these terms.
  const gone = goneReason(offer, me, nowSec)
  const same = gone && strike !== null ? (options.data ?? []).filter((o) => o.id !== offer.id && o.state === 'offered' && o.expiry > nowSec && o.writer !== me && o.underlying.contractId === u.contractId) : []
  const next = gone && strike !== null ? lowestOpenInSeriesOf(same, { kind: offer.kind, underlying: u, strikePerUnit: strike, expiry: offer.expiry }, q) : null
  const fix = !gone || !onIntentChange
    ? undefined
    : next
      ? { label: `Next offer: ${priceText(premiumPerUnit(next), q)} per ${u.code}, ${moneyText({ token: u, amount: next.underlyingQty })}`, onClick: () => onIntentChange({ mode: 'buy', offerId: next.id }) }
      : offer.expiry > nowSec
        ? { label: 'Post a request on these terms', onClick: () => onIntentChange({ mode: 'bid', assetId: u.contractId, kind: offer.kind, strike: strikeText(offer), expiry: offer.expiry }) }
        : undefined

  const deal: Deal = {
    mode: 'buy',
    title: ticketTitle('buy', offer.kind, u.code),
    summary: signSummary('buy', option, { pays: moneyText(premium) }),
    leg: offer,
    side: 'long',
    action,
    terms: null,
    termsError: null,
    gone: gone ?? undefined,
    fix,
    serial: `Offer No. ${serialOf(offer.id)}`,
    money: [leadRow('You pay', premium, PREMIUM_DISCLOSURE), moneyRow('Collateral locked', collateral)],
    figures: [breakevenRow(offer)],
    details: [strikeRow(offer), quantityRow(offer), deadlineRow(offer.expiry), mostYouCanLoseRow(offer, 'long'), partyRow('Maker', offer.writer, me)],
    readAt,
    outcome: outcomeFor(offer, 'long'),
    commitment: COMMITMENT.buy,
    issuerDisclosure: true,
    actionLabel: `Pay ${moneyText(premium)}`,
    chartTitle: `Payoff at the deadline, long ${offer.kind} on ${moneyText({ token: u, amount: offer.underlyingQty })}`,
    series: { assetId: u.contractId, code: u.code, kind: offer.kind, strike: strikeText(offer), expiry: offer.expiry },
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
    reminder: receiptReminder('buy', offer.kind, holderWords(offer)),
    calendar: calendarFor(offer, offer.id),
    link: { label: 'View position', to: '/portfolio/$id', params: { id: offer.id.toString() } },
  })

  return <Flow deal={deal} tx={buy} start={() => buy.run(offer)} receipt={receipt} />
}
