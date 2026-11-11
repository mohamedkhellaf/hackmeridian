// Withdraw a request (bid): the escrowed premium goes back to the buyer. Open and expired requests both hold
// their premium until the buyer cancels.
import { useState } from 'react'
import type { RefObject } from 'react'
import { formatExact, formatUnits } from '../../../core/format'
import type { Bid } from '../../../core/requests/types'
import { useBid, useCancelBid, useMe, useNowSec } from '../../../data'
import { Amount, DateTime, KeyValue, KeyValueItem } from '../../../ui'
import { NOTE_TERMS, RECEIPT, cancelRequestCopy } from '../copy'
import { KIND_WORD, exactMoney, glyphOf, money, optionPhrase, serialOf, strikeExact, strikeText } from '../model'
import { ActionDialog, CheckLines, Issue } from './ActionDialog'
import { cancelBidCheck } from './checks'

export interface CancelRequestDialogProps {
  open: boolean
  onClose: () => void
  /** The request as it was when the dialog opened. */
  bid: Bid
  finalFocus?: RefObject<HTMLElement | null>
}

export function CancelRequestDialog({ open, onClose, bid: b, finalFocus }: CancelRequestDialogProps) {
  const me = useMe()
  const nowSec = useNowSec(10)
  const tx = useCancelBid()
  const reviewing = open && tx.state.phase === 'idle'
  const fresh = useBid(b.id, { enabled: reviewing })
  const [checking, setChecking] = useState(false)
  const premium = { token: b.quote, amount: b.totalPremium }
  const expired = b.state === 'expired' || b.expiry <= nowSec
  const copy = cancelRequestCopy(premium, optionPhrase(b), expired)
  const check = cancelBidCheck({ me, bid: fresh.isError ? 'unknown' : fresh.isPlaceholderData || fresh.data === undefined ? undefined : fresh.data })

  const start = async () => {
    setChecking(true)
    const again = await fresh.refetch()
    setChecking(false)
    if (cancelBidCheck({ me, bid: again.isError ? 'unknown' : (again.data ?? 'unknown') }).blocked) return
    await tx.run(b)
  }

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      copy={copy}
      serial={serialOf(b.id)}
      glyph={glyphOf(b.kind, 'holder')}
      tx={tx}
      onConfirm={() => void start()}
      checking={checking}
      blockedReason={me && check.blocked ? check.problem : null}
      receiptTerms={[{ label: RECEIPT.returned, value: exactMoney(premium), marked: true }]}
      receiptState="Cancelled"
      finalFocus={finalFocus}
      size="sm"
    >
      <KeyValue>
        <KeyValueItem label="You get back" marked>
          <Amount value={formatUnits(premium.amount, premium.token.decimals)} exact={formatExact(premium.amount, premium.token.decimals)} unit={premium.token.code} figure="serif" />
        </KeyValueItem>
        <KeyValueItem label="Request">{`${KIND_WORD[b.kind]} on ${money({ token: b.underlying, amount: b.underlyingQty })}`}</KeyValueItem>
        <KeyValueItem label={NOTE_TERMS.strike}>
          <Amount value={strikeText(b)} exact={strikeExact(b)} unit={`${b.quote.code} per ${b.underlying.code}`} figure="serif" />
        </KeyValueItem>
        <KeyValueItem label={NOTE_TERMS.deadline}>
          <DateTime value={b.expiry * 1000} />
        </KeyValueItem>
      </KeyValue>
      <CheckLines lines={check.lines} />
      {me && check.blocked && check.problem ? <Issue level="block">{check.problem}</Issue> : null}
    </ActionDialog>
  )
}
