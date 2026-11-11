// The receipt: the contract note "prints" with its serial line, the transaction, what to do next and by when,
// the deadline as a calendar entry, and the way on.
import { Link as RouterLink, useRouterState } from '@tanstack/react-router'
import { ICS_MIME_TYPE, buildDeadlineIcs, deadlineIcsFileName, googleCalendarUrl } from '../../core/calendar'
import type { DeadlineEvent } from '../../core/calendar'
import { explorerTx } from '../../core/explorer'
import { groupDigits } from '../../core/format'
import type { TxState } from '../../core/tx/machine'
import { useOptionsClient } from '../../data'
import { Button, ButtonLink, ContractNote, IconCalendarAdd, Link, TxLink } from '../../ui'
import type { NoteTerm, PayoffGlyph } from '../../ui'
import { Actions } from './Actions'
import { useFrame } from './frame'
import styles from './ReceiptStep.module.css'

export interface ReceiptLink {
  label: string
  /** A route path of the app: `/portfolio/$id`, `/requests`. */
  to: string
  params?: Record<string, string>
  search?: Record<string, string>
}

export interface ReceiptView {
  /** The heading: "Put bought". */
  title: string
  /** The id printed on the serial line, when the outcome carries one. */
  serial?: string
  serialLabel?: string
  glyph: PayoffGlyph
  /** "Long put, BOND". */
  kind: string
  terms: NoteTerm[]
  /** The contract's state name after the transaction: Active, Offered, Open, Listed. */
  state: string
  /** Who acts next and by when. */
  reminder: string
  /** The deadline as a calendar entry, for the modes where the user must act before it. */
  calendar: DeadlineEvent | null
  link: ReceiptLink | null
  /** Starts the next order of the same kind from the same terms (a written offer, a posted request). */
  another?: { label: string; onClick: () => void }
}

/** The path a receipt link goes to, to leave it out when the ticket was opened from that very page. */
const pathOf = (link: ReceiptLink): string => link.to.replace(/\$(\w+)/g, (_, name: string) => link.params?.[name] ?? '')

/** Hands the .ics text to the browser as a download. Nothing leaves the page. */
function downloadIcs(event: DeadlineEvent): void {
  const url = URL.createObjectURL(new Blob([buildDeadlineIcs(event)], { type: ICS_MIME_TYPE }))
  const a = document.createElement('a')
  a.href = url
  a.download = deadlineIcsFileName(event.expiryTs)
  document.body.append(a)
  a.click()
  a.remove()
  // The click has been dispatched; the object URL is released on the next task.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function ReceiptStep({ view, state }: { view: ReceiptView; state: TxState }) {
  const frame = useFrame()
  const { isMock } = useOptionsClient()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const ledger = state.ledger !== null ? groupDigits(String(state.ledger)) : undefined
  const link = view.link && pathOf(view.link) !== pathname ? view.link : null
  return (
    <>
      <ContractNote
        printing
        headingLevel={3}
        serial={view.serial}
        serialLabel={view.serialLabel}
        ledger={ledger}
        glyph={view.glyph}
        kind={view.kind}
        terms={view.terms}
        state={view.state}
        className={styles.note}
      />
      {state.hash ? (
        <p className={styles.tx} data-testid="receipt-tx">
          <span>Transaction</span>
          <TxLink hash={state.hash} explorerUrl={isMock ? undefined : explorerTx(state.hash)} copy />
          <span>{ledger ? `confirmed in ledger ${ledger}` : 'confirmed'}</span>
        </p>
      ) : null}
      <p className={styles.reminder}>{view.reminder}</p>
      {view.calendar ? (
        <div className={styles.calendar}>
          <Button variant="secondary" fullWidth iconStart={<IconCalendarAdd />} onClick={() => downloadIcs(view.calendar!)}>
            Add the deadline to your calendar
          </Button>
          <p className={styles.calendarAlt}>
            Downloads a calendar file with reminders 48 hours and 2 hours before.{' '}
            <Link external href={googleCalendarUrl(view.calendar)}>
              Open in Google Calendar instead
            </Link>
          </p>
        </div>
      ) : null}
      <Actions>
        {view.another ? (
          <>
            {link ? (
              <ButtonLink variant="quiet" render={<RouterLink to={link.to as never} params={link.params as never} search={link.search as never} />}>
                {link.label}
              </ButtonLink>
            ) : null}
            <Button variant="quiet" onClick={frame.close}>
              Done
            </Button>
            <Button variant="primary" fullWidth className={styles.primary} onClick={view.another.onClick}>
              {view.another.label}
            </Button>
          </>
        ) : link ? (
          <>
            <ButtonLink variant="primary" fullWidth className={styles.primary} render={<RouterLink to={link.to as never} params={link.params as never} search={link.search as never} />}>
              {link.label}
            </ButtonLink>
            <Button variant="quiet" onClick={frame.close}>
              Done
            </Button>
          </>
        ) : (
          <Button variant="primary" fullWidth className={styles.primary} onClick={frame.close}>
            Done
          </Button>
        )}
      </Actions>
    </>
  )
}
