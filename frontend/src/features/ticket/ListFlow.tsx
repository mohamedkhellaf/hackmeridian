// List a held option for sale at a price the holder sets, or change the price of a listing. A buyer pays the
// holder and becomes the holder; the collateral stays locked in the contract.
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
import { perUnit, plainAmount } from '../../core/units'
import { isNotFoundMessage, useAsk, useListForSale, useMe, useNowSec, useOption, useOptions, useReference } from '../../data'
import type { NoteTerm } from '../../ui'
import { AmountField } from '../../ui'
import { COMMITMENT, LOADING_TITLE, ORIGINAL_PREMIUM_HINT, SAME_PRICE, listingNote, receiptReminder, receiptTitle, reviewTitle, signSummary, ticketTitle } from './copy'
import { Flow } from './Flow'
import type { Deal } from './Flow'
import { errorText, moneyText, priceText } from './fmt'
import type { TicketIntent } from './intent'
import type { ReceiptView } from './ReceiptStep'
import { deadlineRow, kindRow, leadRow, moneyRow, partyRow, perUnitPhrase, quantityRow, strikeRow } from './rows'
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
          what={`Option ${serialOf(intent.optionId)}`}
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

function ListTicket({ option: o, current, readAt, startAt }: { option: OptionOffer; current: bigint | null; readAt: number; startAt?: 'terms' | 'review' }) {
  const me = useMe()
  const list = useListForSale()
  const reference = useReference(o.underlying)
  const u = o.underlying
  const q = o.quote
  const repricing = current !== null
  const [text, setText] = useState(() => (current === null ? '' : plainAmount(current, q.decimals)))

  const parsed = parseAmount(text, q.decimals)
  const askTotal = parsed !== null && parsed > 0n ? parsed : null
  const invalid =
    text.trim() === ''
      ? `Enter the price you ask, in ${q.code}.`
      : parsed === null
        ? `Enter an amount with at most ${q.decimals} decimals.`
        : parsed <= 0n
          ? 'The price must be above zero.'
          : current !== null && parsed === current
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
  const lowestRow: NoteTerm[] = lowest ? [{ label: 'Lowest open offer in this series', value: priceText(premiumPerUnit(lowest), q), hint: `Per ${u.code}. Offer No. ${serialOf(lowest.id)}, for ${moneyText({ token: u, amount: lowest.underlyingQty })}.` }] : []

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
      <TermsList rows={[kindRow(o.kind), strikeRow(o), deadlineRow(o.expiry), quantityRow(o), original, ...worthRow, ...lowestRow, ...(current !== null ? [moneyRow('Listed now', { token: q, amount: current })] : [])]}>
        <div className={styles.price}>
          <AmountField
            label={`Your price, ${q.code} in total`}
            value={text}
            onValueChange={setText}
            unit={q.code}
            decimals={q.decimals}
            validate={() => invalid}
            hint={askTotal !== null ? `${perUnitPhrase(perUnit(askTotal, o), q, u)}.` : `Total price in ${q.code} for the whole option.`}
          />
          <p className={styles.note}>{listingNote(q.code, repricing)}</p>
        </div>
      </TermsList>
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
      { label: 'Your price', value: priceLabel, marked: true },
      { label: 'Strike', value: `${priceText(strike, q)} per ${u.code}` },
      { label: 'Quantity', value: moneyText({ token: u, amount: o.underlyingQty }) },
      { label: 'Deadline', value: formatUtc(o.expiry) },
      { label: 'Collateral', value: `${moneyText(collateral)} in the contract` },
    ],
    state: 'Listed',
    reminder: receiptReminder('list', o.kind),
    calendar: null,
    link: { label: 'View position', to: '/portfolio/$id', params: { id: o.id.toString() } },
  })

  return <Flow deal={deal} tx={list} start={() => list.run(o, askTotal ?? 0n)} receipt={receipt} startAt={startAt} />
}
