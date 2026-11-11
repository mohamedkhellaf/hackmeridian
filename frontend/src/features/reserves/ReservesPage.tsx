import { useEffect, useRef } from 'react'
import { Button, Callout, PageHeader, Skeleton, announce, useIsPhone } from '../../ui'
import { ContractsAndRoles } from './ContractsAndRoles'
import {
  EMPTY_TITLE,
  ERROR_DETAIL,
  ERROR_TEXT,
  ERROR_TITLE,
  FIGURE_HEADING,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  PARTIAL_HELD_TEXT,
  PARTIAL_HELD_TITLE,
  PARTIAL_SPLIT_TEXT,
  PARTIAL_SPLIT_TITLE,
  REFRESH,
  STALE_TITLE,
  hiddenEmptyNote,
  refreshedAnnouncement,
  staleText,
} from './copy'
import { readTimeText, shortRows, summaryLine } from './model'
import { ReadAt } from './ReadAt'
import { ReadingNotes, ReadingNotesHeading } from './ReadingNotes'
import { ReserveTable } from './ReserveTable'
import { ShortfallCallout } from './ShortfallCallout'
import { useReserves } from './useReserves'
import css from './ReservesPage.module.css'

const HEADING_ID = 'reserves-figure'

/** The statement's heading: also where focus lands when the page reads again from its error state. */
function StatementHeading() {
  return (
    <h2 id={HEADING_ID} className={css.heading} tabIndex={-1}>
      {FIGURE_HEADING}
    </h2>
  )
}

/**
 * The shape of the statement while the first read runs: the real heading, a summary line, the table's header and
 * its four rows, then the notes under their real heading. On a phone a token row and a note take about twice the
 * height, so the skeleton counts more lines: what follows moves as little as it can when the figures land.
 */
function LoadingReserves() {
  const phone = useIsPhone()
  return (
    <section className={css.section} aria-labelledby={HEADING_ID} aria-busy="true" data-testid="reserves-loading">
      <div className={css.sectionHead}>
        <StatementHeading />
        <span className="ui-vh">Reading reserves</span>
        <Skeleton variant="text" width="min(22rem, 100%)" />
      </div>
      <div className={css.statement}>
        <div className={css.headSpace} />
        <Skeleton variant="rows" lines={phone ? 6 : 4} />
      </div>
      <div className={css.notes}>
        <ReadingNotesHeading />
        <Skeleton variant="text" lines={phone ? 13 : 8} />
      </div>
    </section>
  )
}

/**
 * Reserves: per token, what the Covered contract has locked against the balance it holds, then who can change
 * what in the contracts. Every figure is a public read; nothing here needs a wallet.
 */
export function ReservesPage() {
  const view = useReserves()
  const { status, rows, refresh } = view
  const short = shortRows(rows)
  const nothingLocked = rows.length > 0 && rows.every((r) => r.locked === 0n && (r.held === null || r.held === 0n))

  // A read that fails is said once to screen-reader users; the notice itself is not a live region.
  const spokenError = useRef<string | null>(null)
  useEffect(() => {
    if (status !== 'error') {
      spokenError.current = null
      return
    }
    const text = `${ERROR_TITLE}. ${ERROR_TEXT}`
    if (spokenError.current !== text) {
      spokenError.current = text
      announce(text, 'assertive')
    }
  }, [status])

  // Refresh in the error notice removes the notice, and its button with it, once the read succeeds: focus then
  // goes to the statement's heading rather than falling back to the page.
  const focusStatement = useRef(false)
  useEffect(() => {
    if (status !== 'ready' || !focusStatement.current) return
    focusStatement.current = false
    document.getElementById(HEADING_ID)?.focus()
  }, [status])

  const onRefresh = () => {
    if (status === 'error') focusStatement.current = true
    void refresh().then((at) => {
      if (at !== null) announce(refreshedAnnouncement(readTimeText(at)))
    })
  }

  // One sentence over the rows, unless a notice above already says it (a shortfall, balances that could not be read).
  const summary = nothingLocked ? EMPTY_TITLE : short.length > 0 || view.heldMissing ? null : summaryLine(rows)

  return (
    <div className={css.page}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={status === 'ready' ? <ReadAt readAt={view.readAt} ledger={view.ledger} isMock={view.isMock} refreshing={view.refreshing} onRefresh={onRefresh} /> : undefined}
      />

      {status === 'loading' ? <LoadingReserves /> : null}

      {status === 'error' ? (
        <Callout
          variant="danger"
          title={ERROR_TITLE}
          className={css.error}
          actions={
            <Button variant="secondary" size="sm" loading={view.refreshing} onClick={onRefresh}>
              {REFRESH}
            </Button>
          }
        >
          <p>{ERROR_TEXT}</p>
          {view.error ? (
            <details className={css.details}>
              <summary>{ERROR_DETAIL}</summary>
              <p className={css.message}>{view.error}</p>
            </details>
          ) : null}
        </Callout>
      ) : null}

      {status === 'ready' ? (
        <div className={css.reserves}>
          <ShortfallCallout rows={short} />
          {view.stale && view.readAt !== null ? (
            <Callout variant="warning" title={STALE_TITLE}>
              <p>{staleText(readTimeText(view.readAt))}</p>
            </Callout>
          ) : null}
          {view.heldMissing ? (
            <Callout variant="warning" title={PARTIAL_HELD_TITLE}>
              <p>{PARTIAL_HELD_TEXT}</p>
            </Callout>
          ) : null}
          {view.splitMissing ? (
            <Callout variant="warning" title={PARTIAL_SPLIT_TITLE}>
              <p>{PARTIAL_SPLIT_TEXT}</p>
            </Callout>
          ) : null}

          <section className={css.section} aria-labelledby={HEADING_ID}>
            <div className={css.sectionHead}>
              <StatementHeading />
              {summary ? (
                <p className={css.summary} data-testid="reserves-summary">
                  {summary}
                </p>
              ) : null}
            </div>
            <div className={css.statement}>
              <ReserveTable rows={rows} />
              {view.hiddenEmpty > 0 ? <p className={css.hidden}>{hiddenEmptyNote(view.hiddenEmpty)}</p> : null}
            </div>
            <div className={css.notes}>
              <ReadingNotes isMock={view.isMock} />
            </div>
          </section>
        </div>
      ) : null}

      <ContractsAndRoles />
    </div>
  )
}
