// What the ticket shows before it has a subject: reading it, failing to read it, or finding it gone.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button, Callout, EmptyNote, Skeleton } from '../../ui'
import { Actions } from './Actions'
import { useFrame } from './frame'
import styles from './states.module.css'

/** Reports a plain title to the container for a state that is not a flow yet. */
function useTitle(title: string): void {
  const { report } = useFrame()
  useEffect(() => {
    report({ title, step: 'terms', series: null })
  }, [report, title])
}

function CloseAction() {
  const frame = useFrame()
  return (
    <Actions>
      <Button variant="secondary" fullWidth onClick={frame.close}>
        Close
      </Button>
    </Actions>
  )
}

/** First read of the subject: the shape of a term sheet, hidden from assistive technology. */
export function FlowLoading({ title }: { title: string }) {
  useTitle(title)
  return (
    <div className={styles.loading} aria-busy="true" data-testid="ticket-loading">
      <span className="ui-vh">Reading the terms from the contract.</span>
      <Skeleton variant="rows" lines={6} />
      <Skeleton variant="block" height="2.25rem" />
    </div>
  )
}

/** The read failed. Nothing was sent; the user can try the read again. */
export function FlowError({ title, what, message, onRetry }: { title: string; what: string; message?: string | null; onRetry: () => void }) {
  useTitle(title)
  return (
    <>
      <Callout
        variant="danger"
        label="Not loaded"
        actions={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        {`${what} could not be read from the contract. Nothing was sent.`}
        {message ? ` ${message}` : ''}
      </Callout>
      <CloseAction />
    </>
  )
}

/** The subject does not exist (any more): one sentence and one way out. */
export function FlowGone({ title, sentence, hint, action }: { title: string; sentence: string; hint?: string; action?: ReactNode }) {
  useTitle(title)
  return (
    <>
      <EmptyNote title={sentence} hint={hint} action={action} headingLevel={3} />
      <CloseAction />
    </>
  )
}
