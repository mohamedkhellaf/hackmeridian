// Fill a buyer's funded request: the maker locks the collateral, receives the escrowed premium at once, and
// has written the option; the buyer holds it.
import { useMemo } from 'react'
import { formatUtc } from '../../core/format'
import type { PreTradeAction } from '../../core/options/preTrade'
import { requiredCollateral } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { plainDecimal } from '../../core/series'
import { isNotFoundMessage, useBid, useFillBid, useMe, useReference } from '../../data'
import { CONSENT, LOADING_TITLE, optionPhrase, receiptReminder, receiptTitle, settlementSentence, signSummary, ticketTitle } from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { errorText, moneyText, priceText, readAtText } from './fmt'
import type { TicketIntent } from './intent'
import { Party } from './parts'
import type { ReceiptView } from './ReceiptStep'
import { breakevenRow, deadlineRow, kindRow, moneyRow, mostYouCanLoseRow, quantityRow, receiptTerms, strikeRow } from './rows'
import { FlowError, FlowGone, FlowLoading } from './states'
import { exerciseGives, exerciseReceives, glyphOf, positionWords, premiumPerUnit, serialOf, strikePerUnit } from './terms'
import { TermsList } from './TermsList'

export function FillFlow({ intent, startAt }: { intent: Extract<TicketIntent, { mode: 'fill' }>; startAt?: 'terms' | 'review' }) {
  const query = useBid(intent.bidId, { cadence: 'book' })
  const bid = query.data
  if (!bid) {
    if (query.isError) {
      // An id the contract does not have is not a failed read: there is nothing to try again.
      if (isNotFoundMessage(errorText(query.error))) return <FlowGone title={LOADING_TITLE.fill} sentence="This request does not exist." hint={`The contract has no request No. ${serialOf(intent.bidId)}. Pick a request on the board.`} />
      return <FlowError title={LOADING_TITLE.fill} what={`Request ${serialOf(intent.bidId)}`} onRetry={() => void query.refetch()} />
    }
    return <FlowLoading title={LOADING_TITLE.fill} />
  }
  if (bid.state === 'cancelled' || bid.state === 'pruned') {
    return <FlowGone title={LOADING_TITLE.fill} sentence="This request is closed." hint="The buyer withdrew it or it expired, and the premium went back to the buyer." />
  }
  return <FillTicket bid={bid} readAt={query.isPlaceholderData ? 0 : query.dataUpdatedAt} startAt={startAt} />
}

function FillTicket({ bid, readAt, startAt }: { bid: Bid; readAt: number; startAt?: 'terms' | 'review' }) {
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
    terms: (
      <TermsList
        rows={[
          kindRow(bid.kind),
          strikeRow(bid),
          deadlineRow(bid.expiry),
          quantityRow(bid),
          { label: 'Request', value: `No. ${serialOf(bid.id)}`, hint: <Party role="Buyer" address={bid.buyer} me={me} /> },
          { label: 'Premium per unit', value: priceText(premiumPerUnit(bid), q), hint: `${moneyText(premium)} in total, already escrowed in the contract by the buyer.` },
          moneyRow('You lock', collateral, 'In the contract, until the option is exercised or the deadline passes.'),
        ]}
        total={{ label: 'You receive', value: moneyText(premium) }}
      />
    ),
    termsError: null,
    impact: [
      moneyRow('You receive', premium, "Paid to you from the buyer's escrow when the transaction confirms."),
      moneyRow('You lock', collateral, 'Until the buyer exercises, or until you reclaim it after the deadline.'),
      breakevenRow(bid, 'short'),
      mostYouCanLoseRow(bid, 'short'),
      deadlineRow(bid.expiry, true),
      { label: 'Counterparty', value: <Party role="Buyer" address={bid.buyer} me={me} />, hint: 'Becomes the holder of the option.' },
    ],
    readAt: readAtText(readAt),
    settlement: settlementSentence('short', bid.kind, moneyText(exerciseGives(bid)), moneyText(exerciseReceives(bid))),
    issuerDisclosure: true,
    consent: CONSENT.fill,
    actionLabel: `Lock ${moneyText(collateral)} and fill`,
    chartTitle: `Payoff at expiry, short ${bid.kind} on ${moneyText({ token: u, amount: bid.underlyingQty })}`,
    series: { assetId: u.contractId, kind: bid.kind, strike: strike === null ? undefined : plainDecimal(strike, q.decimals), expiry: bid.expiry },
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

  return <Flow deal={deal} tx={fill} start={() => fill.run(bid)} receipt={receipt} startAt={startAt} />
}
