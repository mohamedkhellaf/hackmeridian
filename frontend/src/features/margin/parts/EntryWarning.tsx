import { useState } from 'react'
import type { RefObject } from 'react'
import { MARGIN_WARNING_BULLETS, MARGIN_WARNING_CONSENT, MARGIN_WARNING_TITLE } from '../../../core/disclosures'
import { Button, Checkbox, Dialog } from '../../../ui'
import css from './EntryWarning.module.css'

export interface EntryWarningProps {
  open: boolean
  /** The box is ticked and Continue was pressed. */
  onContinue: () => void
  /** Cancel, Escape or the close button: the user leaves the Margin section. */
  onCancel: () => void
  /** Where focus lands after Continue: the page heading, as after any change of page. */
  finalFocus?: RefObject<HTMLElement | null>
}

/**
 * The default-risk warning shown once per browser tab before a Margin screen of the contract build can be used
 * (a fixture build signs nothing and does not ask). The three sentences are required disclosures; Continue
 * stays unavailable until "I understand" is ticked.
 */
export function EntryWarning({ open, onContinue, onCancel, finalFocus }: EntryWarningProps) {
  const [understood, setUnderstood] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      title={MARGIN_WARNING_TITLE}
      size="md"
      dismissible={false}
      initialFocus="first-control"
      finalFocus={finalFocus}
      closeLabel="Cancel and go back to Markets"
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!understood} disabledReason="Tick the box to continue." onClick={onContinue}>
            Continue
          </Button>
        </>
      }
    >
      <ul className={css.list}>
        {MARGIN_WARNING_BULLETS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Checkbox checked={understood} onCheckedChange={setUnderstood}>
        {MARGIN_WARNING_CONSENT}
      </Checkbox>
    </Dialog>
  )
}
