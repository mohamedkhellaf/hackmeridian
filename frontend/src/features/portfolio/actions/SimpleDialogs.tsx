// The four actions that move something back to the wallet and have no deadline of their own: claim delivery,
// reclaim collateral, cancel an open offer, withdraw a resale listing. Each confirms what moves, re-reads the
// option before the wallet is asked, then shows the staged transaction and the receipt.
import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { formatExact, formatUnits } from '../../../core/format'
import type { Fact } from '../../../core/options/preTrade'
import { requiredCollateral } from '../../../core/options/types'
import type { Money, OptionOffer } from '../../../core/options/types'
import { claimAmount } from '../../../core/portfolio/positions'
import { useAsk, useCancelOffer, useCancelSale, useClaimDelivery, useEligibility, useMe, useNowSec, useOption, useReclaim } from '../../../data'
import type { TxRun } from '../../../data'
import { Amount, DateTime, KeyValue, KeyValueItem } from '../../../ui'
import type { NoteTerm } from '../../../ui'
import { NOTE_TERMS, RECEIPT, cancelListingCopy, cancelOfferCopy, claimCopy, reclaimCopy } from '../copy'
import type { ActionCopy } from '../copy'
import { exactMoney, glyphOf, optionTitle, serialOf, strikeExact, strikeText } from '../model'
import { ActionDialog, CheckLines, Issue } from './ActionDialog'
import type { TxView } from './ActionDialog'
import { simpleCheck } from './checks'
import type { SimpleAction } from './checks'

export interface SimpleDialogProps {
  open: boolean
  onClose: () => void
  /** The option as it was when the dialog opened. */
  option: OptionOffer
  receiptAction?: ReactNode
  finalFocus?: RefObject<HTMLElement | null>
}

/** A query as a fact: undefined while reading (or showing the list's copy), 'unknown' when the read failed. */
function factOf<T>(q: { data: T | undefined; isError: boolean; isPlaceholderData?: boolean }): Fact<T> {
  if (q.isError) return 'unknown'
  if (q.isPlaceholderData || q.data === undefined) return undefined
  return q.data
}

const amountValue = (m: Money) => <Amount value={formatUnits(m.amount, m.token.decimals)} exact={formatExact(m.amount, m.token.decimals)} unit={m.token.code} figure="serif" />

interface FrameProps extends SimpleDialogProps {
  action: SimpleAction
  copy: ActionCopy
  tx: TxView
  run: () => Promise<TxRun<unknown>>
  /** The row that says what moves to the wallet. */
  moves: { label: string; amount: Money }
  receiptTerms: ReadonlyArray<NoteTerm>
  receiptState: string
}

function Frame({ open, onClose, option: o, receiptAction, finalFocus, action, copy, tx, run, moves, receiptTerms, receiptState }: FrameProps) {
  const me = useMe()
  const nowSec = useNowSec(10)
  const reviewing = open && tx.state.phase === 'idle'
  const fresh = useOption(o.id, { enabled: reviewing })
  const ask = useAsk(action === 'unlist' ? o.id : null, { enabled: reviewing })
  const eligible = useEligibility(o.underlying.contractId, me, { enabled: reviewing && action === 'claim' && o.kind === 'put' })
  const [checking, setChecking] = useState(false)

  const check = simpleCheck(action, o, {
    me,
    nowSec,
    option: factOf(fresh),
    ask: action === 'unlist' ? factOf(ask) : undefined,
    eligible: action === 'claim' && o.kind === 'put' ? (me ? factOf(eligible) : 'unknown') : undefined,
  })

  const start = async () => {
    setChecking(true)
    // One fresh read right before the wallet is asked. A read that fails does not stop the action.
    const [option, liveAsk] = await Promise.all([fresh.refetch(), action === 'unlist' ? ask.refetch() : Promise.resolve(null)])
    setChecking(false)
    const again = simpleCheck(action, o, {
      me,
      nowSec: Math.floor(Date.now() / 1000),
      option: option.isError ? 'unknown' : (option.data ?? 'unknown'),
      ask: liveAsk === null ? undefined : liveAsk.isError ? 'unknown' : (liveAsk.data ?? null),
      eligible: action === 'claim' && o.kind === 'put' ? factOf(eligible) : undefined,
    })
    if (again.blocked) return
    await run()
  }

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      copy={copy}
      serial={serialOf(o.id)}
      glyph={glyphOf(o.kind, action === 'unlist' ? 'holder' : 'writer')}
      tx={tx}
      onConfirm={() => void start()}
      checking={checking}
      blockedReason={me && check.blocked ? check.problem : null}
      receiptTerms={receiptTerms}
      receiptState={receiptState}
      receiptAction={receiptAction}
      finalFocus={finalFocus}
      size="sm"
    >
      <KeyValue>
        <KeyValueItem label={moves.label} marked>
          {amountValue(moves.amount)}
        </KeyValueItem>
        <KeyValueItem label="Option">{optionTitle(o)}</KeyValueItem>
        <KeyValueItem label={NOTE_TERMS.strike}>
          <Amount value={strikeText(o)} exact={strikeExact(o)} unit={`${o.quote.code} per ${o.underlying.code}`} figure="serif" />
        </KeyValueItem>
        <KeyValueItem label={NOTE_TERMS.deadline}>
          <DateTime value={o.expiry * 1000} />
        </KeyValueItem>
      </KeyValue>
      <CheckLines lines={check.lines} />
      {me && check.blocked && check.problem ? <Issue level="block">{check.problem}</Issue> : null}
    </ActionDialog>
  )
}

export function ClaimDialog(props: SimpleDialogProps) {
  const tx = useClaimDelivery()
  const amount = claimAmount(props.option)
  return (
    <Frame
      {...props}
      action="claim"
      copy={claimCopy(props.option)}
      tx={tx}
      run={() => tx.run(props.option)}
      moves={{ label: 'You receive', amount }}
      receiptTerms={[{ label: RECEIPT.received, value: exactMoney(amount), marked: true }]}
      receiptState="Settled"
    />
  )
}

export function ReclaimDialog(props: SimpleDialogProps) {
  const tx = useReclaim()
  const amount = requiredCollateral(props.option)
  return (
    <Frame
      {...props}
      action="reclaim"
      copy={reclaimCopy(props.option)}
      tx={tx}
      run={() => tx.run(props.option)}
      moves={{ label: 'You get back', amount }}
      receiptTerms={[{ label: RECEIPT.returned, value: exactMoney(amount), marked: true }]}
      receiptState="Expired"
    />
  )
}

export function CancelOfferDialog(props: SimpleDialogProps) {
  const tx = useCancelOffer()
  const amount = requiredCollateral(props.option)
  return (
    <Frame
      {...props}
      action="cancel"
      copy={cancelOfferCopy(props.option)}
      tx={tx}
      run={() => tx.run(props.option)}
      moves={{ label: 'You get back', amount }}
      receiptTerms={[{ label: RECEIPT.returned, value: exactMoney(amount), marked: true }]}
      receiptState="Cancelled"
    />
  )
}

export function CancelListingDialog(props: SimpleDialogProps & { ask: Money }) {
  const tx = useCancelSale()
  const { ask, ...rest } = props
  return (
    <Frame
      {...rest}
      action="unlist"
      copy={cancelListingCopy(props.option, ask)}
      tx={tx}
      run={() => tx.run(props.option)}
      moves={{ label: 'Listed at', amount: ask }}
      receiptTerms={[{ label: 'Was listed at', value: exactMoney(ask) }]}
      receiptState="Active"
    />
  )
}
