// Fill a buyer's funded request: the maker locks the collateral, receives the escrowed premium at once, and
// has written the option; the buyer holds it. The terms are the buyer's, so the ticket opens on its review.
import { useMemo } from 'react'
import { formatUtc } from '../../core/format'
import type { PreTradeAction } from '../../core/options/preTrade'
import { requiredCollateral } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { plainDecimal } from '../../core/series'
import { isNotFoundMessage, useBid, useFillBid, useMe, useNowSec, useReference } from '../../data'
import { COMMITMENT, LOADING_TITLE, optionPhrase, receiptReminder, receiptTitle, signSummary, ticketTitle } from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { errorText, moneyText, priceText } from './fmt'
import type { TicketIntent } from './intent'
import type { ReceiptView } from './ReceiptStep'
import { breakevenRow, deadlineRow, leadRow, moneyRow, mostYouCanLoseRow, partyRow, quantityRow, receiptTerms, strikeRow } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { glyphOf, positionWords, serialOf, strikePerUnit } from './terms'
import { outcomeFor } from './words'

export function FillFlow({ intent }: { intent: Extract<TicketIntent, { mode: 'fill' }> }) {
  const query = useBid(intent.bidId, { cadence: 'book' })
  const nowSec = useNowSec(30)
  const bid = query.data
  if (!bid) {
    if (query.isError) {
      // An id the contract does not have is not a failed read: there is nothing to try again.
      if (isNotFoundMessage(errorText(query.error))) return <FlowGone title={LOADING_TITLE.fill} sentence="This request does not exist." hint={`The contract has no request No. ${serialOf(intent.bidId)}. Pick a request on the board.`} />
      return <FlowError title={LOADING_TITLE.fill} what={`Request No. ${serialOf(intent.bidId)}`} onRetry={() => void query.refetch()} />
    }
    return <FlowLoading title={LOADING_TITLE.fill} />
  }
  if (bid.state === 'cancelled' || bid.state === 'pruned') {
    return <FlowGone title={LOADING_TITLE.fill} sentence="This request is closed." hint="The buyer withdrew it or it expired, and the premium went back to the buyer." />
  }
  return <FillTicket bid={bid} readAt={query.isPlaceholderData ? 0 : query.dataUpdatedAt} nowSec={nowSec} />
}

function FillTicket({ bid, readAt, nowSec }: { bid: Bid; readAt: number; nowSec: number }) {
  const me = useMe()
  const fill = useFillBid()
  const reference = useReference(bid.underlying)
  const u = bid.underlying
  const q = bid.quote
  const action = useMemo<PreTradeAction>(() => ({ type: 'fill-bid', bid }), [bid])

  const premium = { token: q, amount: bid.totalPremium }
  const collateral = requiredCollateral(bid)
  const strike = strikePerUnit(bid)
  const option = optionPhrase(bid.kind, moneyText({ token: u, amount: bid.underlyingQty }), priceText(strike, q), formatUtc(bid.expiry))

  const deal: Deal = {
    mode: 'fill',
    title: ticketTitle('fill', bid.kind, u.code),
    summary: signSummary('fill', option, { locks: moneyText(collateral), receives: moneyText(premium) }),
    leg: bid,
    side: 'short',
    action,
    terms: null,
    termsError: null,
    gone: bid.state === 'filled' ? 'Another maker filled this request.' : bid.state !== 'open' || bid.expiry <= nowSec ? `Its deadline passed at ${formatUtc(bid.expiry)}.` : undefined,
    serial: `Request No. ${serialOf(bid.id)}`,
    money: [leadRow('You receive', premium, "Paid to you from the buyer's escrow when the transaction confirms."), moneyRow('You lock', collateral)],
    figures: [breakevenRow(bid), mostYouCanLoseRow(bid, 'short')],
    details: [strikeRow(bid), quantityRow(bid), deadlineRow(bid.expiry), partyRow('Buyer', bid.buyer, me)],
    readAt,
    outcome: outcomeFor(bid, 'short'),
    commitment: COMMITMENT.fill,
    issuerDisclosure: true,
    actionLabel: `Lock ${moneyText(collateral)} and fill`,
    chartTitle: `Payoff at the deadline, short ${bid.kind} on ${moneyText({ token: u, amount: bid.underlyingQty })}`,
    series: { assetId: u.contractId, code: u.code, kind: bid.kind, strike: strike === null ? undefined : plainDecimal(strike, q.decimals), expiry: bid.expiry },
    reference,
  }

  const receipt = (result: { optionId: bigint } | null): ReceiptView => ({
    title: receiptTitle('fill', bid.kind),
    serial: result ? serialOf(result.optionId) : undefined,
    glyph: glyphOf('short', bid.kind),
    kind: `${positionWords('short', bid.kind)}, ${u.code}`,
    terms: receiptTerms(bid, 'Premium received', collateral),
    state: 'Active',
    reminder: receiptReminder('fill', bid.kind),
    calendar: null,
    link: result ? { label: 'View position', to: '/portfolio/$id', params: { id: result.optionId.toString() } } : { label: 'View portfolio', to: '/portfolio', search: { tab: 'written' } },
  })

  return <Flow deal={deal} tx={fill} start={() => fill.run(bid)} receipt={receipt} />
}
