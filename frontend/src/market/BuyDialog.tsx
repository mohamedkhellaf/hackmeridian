import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { OptionsClient } from '../options/client'
import type { CollateralHealth, OptionOffer } from '../options/types'
import type { TxOutcome } from '../state/useStrata'
import { Dialog } from '../ui'
import { BuyTicket } from './BuyTicket'
import { setTicketOpen, useNarrow, useTicketSlot } from './ticketSlot'
import './market.css'

/**
 * Buy flow for one offer. On Markets at desktop width it renders into the sticky ticket column (the slot);
 * everywhere else (Protect, phones) it is a Dialog, a bottom sheet on phones.
 */
export function BuyDialog({
  offer,
  client,
  me,
  health = [],
  onConfirm,
  onCancel,
  onOutcomeShown,
}: {
  offer: OptionOffer
  client: OptionsClient
  me: string | null
  /** Reserved vs held per token; a token with held < reserved shows the clawback shortfall warning. */
  health?: CollateralHealth[]
  /** Runs the purchase; resolves with the outcome (the hook keeps this component mounted). */
  onConfirm: () => Promise<TxOutcome | null>
  onCancel: () => void
  /** Called when the confirmed step is shown, so the app can drop the duplicate toast. */
  onOutcomeShown?: () => void
}) {
  const narrow = useNarrow()
  const hosted = useTicketSlot()
  const slot = narrow ? null : hosted
  const submitting = useRef(false)
  const title = `Buy ${offer.underlying.code} ${offer.kind}`
  const close = () => {
    if (!submitting.current) onCancel()
  }

  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!slot) return
    setTicketOpen(true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      setTicketOpen(false)
    }
  }, [slot])

  const ticket = (inline: boolean) => (
    <BuyTicket
      key={offer.id.toString()}
      offer={offer}
      client={client}
      me={me}
      health={health}
      onConfirm={onConfirm}
      onClose={close}
      onOutcomeShown={onOutcomeShown}
      submittingRef={submitting}
      inline={inline}
    />
  )

  if (slot)
    return createPortal(
      <section className="tk" role="dialog" aria-modal="false" aria-label={title}>
        <h2 className="tk-title">{title}</h2>
        {ticket(true)}
      </section>,
      slot,
    )

  return (
    <Dialog title={title} width={520} onClose={close}>
      {ticket(false)}
    </Dialog>
  )
}
