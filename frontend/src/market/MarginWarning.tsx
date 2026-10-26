import { useState } from 'react'
import { Button, Dialog } from '../ui'
import { setMarginAck } from './marginAck'
import './margin-choice.css'

/**
 * The one margin warning, shown from the Sell dialog and on entry to the margin section.
 * Continue stays disabled until "I understand" is ticked; it records the acknowledgement for the session.
 */
export function MarginWarningDialog({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const [understood, setUnderstood] = useState(false)
  return (
    <Dialog
      title="Margin positions carry default risk"
      width={480}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!understood}
            onClick={() => {
              setMarginAck()
              onContinue()
            }}
          >
            Continue
          </Button>
        </>
      }
    >
      <ul className="margin-warn-list">
        <li>Partial margin can be liquidated at the published price.</li>
        <li>Payouts to holders can be reduced, and any deficit is shown.</li>
        <li>The price feed and the settlement price are published by the team, a demo oracle, not a market.</li>
      </ul>
      <label className="margin-warn-check">
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        <span>I understand</span>
      </label>
    </Dialog>
  )
}

export type CollateralChoice = 'full' | 'margin'

const CHOICES: { value: CollateralChoice; title: string; body: string }[] = [
  {
    value: 'full',
    title: 'Full collateral',
    body: 'You lock the full strike or the full underlying. Settlement is physical. Your only risk is issuer action.',
  },
  {
    value: 'margin',
    title: 'Margin',
    body: 'You post partial margin in USDx. Cash settlement at a published price. You can be liquidated, and if the vault runs dry the holder is paid less.',
  },
]

/** Two radio cards above the Sell "post an offer" form. Picking Margin opens the warning. */
export function CollateralChoiceCards({ value, onChange }: { value: CollateralChoice; onChange: (v: CollateralChoice) => void }) {
  return (
    <div role="radiogroup" aria-label="Collateral" className="margin-choice">
      {CHOICES.map((c) => (
        <label key={c.value} className={value === c.value ? 'margin-choice-card is-on' : 'margin-choice-card'}>
          <input type="radio" name="collateral-choice" value={c.value} checked={value === c.value} onChange={() => onChange(c.value)} />
          <span className="margin-choice-text">
            <strong>{c.title}</strong>
            <span>{c.body}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
