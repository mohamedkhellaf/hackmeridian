// The welcome on the Markets index: one line of welcome, one sentence, two buttons, in the page flow between the
// page header and the first section. It never opens anything by itself and never takes focus. Once the visitor
// answers it (or starts the guide from Settings), it becomes one line saying where the guide lives, until they
// leave Markets; after that it is never shown again in this browser.
import { useEffect, useRef, useState } from 'react'
import { GUIDE_COPY, GUIDE_RETURN_ATTRIBUTE, canOfferTour } from '../../../core/guide'
import { useGuide } from '../../../data'
import { Button, useIsPhone } from '../../../ui'
import styles from './GuideSlip.module.css'

export interface GuideSlipProps {
  /** The "Get test funds" strip is showing. It has this place and is tied to a task, so it wins. */
  displaced: boolean
  /** A connected wallet's balances are still loading: too early to say which of the two belongs here. */
  pending: boolean
}

type Phase = 'none' | 'offered' | 'parked' | 'gone'

export function GuideSlip({ displaced, pending }: GuideSlipProps) {
  const { seen, persistent, run, start, decline } = useGuide()
  const phone = useIsPhone()
  const line = useRef<HTMLParagraphElement>(null)
  const [phase, setPhase] = useState<Phase>('none')
  const [declined, setDeclined] = useState(false)

  const open = canOfferTour({ seen, persistent })
  // Offered once nothing is stored and the page knows the funds strip is not coming. Answered in this tab (a
  // button here, or a tour that is running), it parks as one line; answered in another tab, it just goes.
  let next = phase
  if (phase === 'none' && open && !pending && !displaced) next = 'offered'
  else if (phase === 'offered' && !open) next = declined || run !== null ? 'parked' : 'gone'
  if (next !== phase) setPhase(next)

  // "Not now" took the button that had focus away: focus goes to the line, which is then read.
  useEffect(() => {
    if (phase === 'parked' && declined) line.current?.focus()
  }, [phase, declined])

  if (displaced || next === 'none' || next === 'gone') return null

  if (next === 'parked') {
    return (
      <div className={styles.root} data-state="parked">
        <p ref={line} tabIndex={-1} className={styles.line} {...{ [GUIDE_RETURN_ATTRIBUTE]: '' }}>
          {phone ? GUIDE_COPY.staysPhone : GUIDE_COPY.stays}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.root} data-state="offered">
      <div className={styles.text}>
        <h2 className={styles.title}>{GUIDE_COPY.welcomeTitle}</h2>
        <p className={styles.body}>{GUIDE_COPY.welcomeBody}</p>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => start('tour', 'slip')}>
          {GUIDE_COPY.start}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            setDeclined(true)
            decline()
          }}
        >
          {GUIDE_COPY.decline}
        </Button>
      </div>
    </div>
  )
}
