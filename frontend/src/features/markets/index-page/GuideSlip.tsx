// The welcome on the Markets index: one line of welcome, one sentence, two buttons, in the page flow between the
// page header and the first section. It never opens anything by itself and never takes focus. Once the visitor
// answers it, or a tour starts from anywhere, it goes, and it is never shown again in this browser. Where the
// guide lives afterwards is said once, in the last note of a tour.
import { useState } from 'react'
import type { RefObject } from 'react'
import { GUIDE_COPY, canOfferTour } from '../../../core/guide'
import { useGuide } from '../../../data'
import { Button } from '../../../ui'
import styles from './GuideSlip.module.css'

export interface GuideSlipProps {
  /** The "Get test funds" strip is showing. It has this place and is tied to a task, so it wins. */
  displaced: boolean
  /** A connected wallet's balances are still loading: too early to say which of the two belongs here. */
  pending: boolean
  /** Takes focus after "Not now", which took away the button that had it: the heading of the first section. */
  after: RefObject<HTMLElement | null>
}

type Phase = 'none' | 'offered' | 'gone'

export function GuideSlip({ displaced, pending, after }: GuideSlipProps) {
  const { seen, persistent, run, start, decline } = useGuide()
  const [phase, setPhase] = useState<Phase>('none')

  const open = canOfferTour({ seen, persistent })
  // Offered once nothing is stored and the page knows the funds strip is not coming. Answered here or in another
  // tab, or overtaken by a tour started from Settings, it goes.
  let next = phase
  if (phase === 'none' && open && !pending && !displaced && run === null) next = 'offered'
  else if (phase === 'offered' && (!open || run !== null)) next = 'gone'
  if (next !== phase) setPhase(next)

  if (displaced || next !== 'offered') return null

  return (
    <div className={styles.root}>
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
            // Before the welcome goes, so focus never falls to the page: the heading is then read.
            after.current?.focus({ preventScroll: true })
            decline()
          }}
        >
          {GUIDE_COPY.decline}
        </Button>
      </div>
    </div>
  )
}
