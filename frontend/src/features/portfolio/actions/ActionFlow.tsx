// One place that turns "this action on this option" into the right dialog, for the list and for the position
// page. The state lives in ./useActionFlow.
import { Suspense, lazy } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { OptionOffer } from '../../../core/options/types'
import { ExerciseDialog } from './ExerciseDialog'
import { CancelListingDialog, CancelOfferDialog, ClaimDialog, ReclaimDialog } from './SimpleDialogs'
import type { Flow } from './useActionFlow'

// The order ticket is only needed once "Sell" is opened: its code loads then, not with the portfolio.
const TicketHost = lazy(() => import('../../ticket').then((m) => ({ default: m.TicketHost })))

export interface ActionFlowProps {
  flow: Flow | null
  open: boolean
  onClose: () => void
  /** A link shown under a receipt, for example "View position" on the list. */
  receiptAction?: (option: OptionOffer) => ReactNode
  finalFocus?: RefObject<HTMLElement | null>
}

export function ActionFlow({ flow, open, onClose, receiptAction, finalFocus }: ActionFlowProps) {
  if (!flow) return null
  const { option: o, listing, action } = flow
  const link = receiptAction?.(o)
  switch (action) {
    case 'exercise':
      return <ExerciseDialog key={flow.seq} open={open} onClose={onClose} option={o} receiptAction={link} finalFocus={finalFocus} />
    case 'claim':
      return <ClaimDialog key={flow.seq} open={open} onClose={onClose} option={o} receiptAction={link} finalFocus={finalFocus} />
    case 'reclaim':
      return <ReclaimDialog key={flow.seq} open={open} onClose={onClose} option={o} receiptAction={link} finalFocus={finalFocus} />
    case 'cancel':
      return <CancelOfferDialog key={flow.seq} open={open} onClose={onClose} option={o} receiptAction={link} finalFocus={finalFocus} />
    case 'unlist':
      return listing ? <CancelListingDialog key={flow.seq} open={open} onClose={onClose} option={o} ask={{ token: o.quote, amount: listing.askTotal }} receiptAction={link} finalFocus={finalFocus} /> : null
    case 'sell':
      // Listing and re-pricing belong to the order ticket: same review, sign and receipt as every other trade.
      return (
        <Suspense fallback={null}>
          <TicketHost key={flow.seq} intent={open ? { mode: 'list', optionId: o.id } : null} onClose={onClose} placement="overlay" />
        </Suspense>
      )
  }
}
