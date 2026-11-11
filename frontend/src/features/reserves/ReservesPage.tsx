import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Button, ButtonLink, Callout, EmptyNote, PageHeader, Skeleton, announce } from '../../ui'
import { ContractsAndRoles } from './ContractsAndRoles'
import {
  EMPTY_ACTION,
  EMPTY_HINT,
  EMPTY_TITLE,
  ERROR_FALLBACK,
  ERROR_TITLE,
  FIGURE_HEADING,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  PARTIAL_HELD_TEXT,
  PARTIAL_HELD_TITLE,
  PARTIAL_SPLIT_TEXT,
  PARTIAL_SPLIT_TITLE,
  RETRY,
  STALE_TITLE,
  errorReason,
  hiddenEmptyNote,
  refreshedAnnouncement,
  staleText,
} from './copy'
import { readTimeText, shortRows, summaryLine } from './model'
import { Limits } from './Limits'
import { ReadAt } from './ReadAt'
import { ReadingNotes } from './ReadingNotes'
import { ReserveFigure } from './ReserveFigure'
import { ReserveTable } from './ReserveTable'
import { ShortfallCallout } from './ShortfallCallout'
import { useReserves } from './useReserves'
import css from './ReservesPage.module.css'

/** The shape of the page while the first read runs. */
function LoadingReserves() {
  return (
    <div className={css.reserves} aria-busy="true" data-testid="reserves-loading">
      <span className="ui-vh">Reading reserves</span>
      <div className={css.layout}>
        <div className={css.figure}>
          <Skeleton variant="block" height="15rem" />
        </div>
        <div className={css.notes}>
          <Skeleton variant="text" lines={7} />
        </div>
        <div className={css.table}>
          <Skeleton variant="rows" lines={4} />
        </div>
      </div>
    </div>
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
    const text = `${ERROR_TITLE}. ${view.error ?? ERROR_FALLBACK}`
    if (spokenError.current !== text) {
      spokenError.current = text
      announce(text, 'assertive')
    }
  }, [status, view.error])

  const onRefresh = () => {
    void refresh().then((at) => {
      if (at !== null) announce(refreshedAnnouncement(readTimeText(at)))
    })
  }

  const retry = (
    <Button variant="secondary" size="sm" loading={view.refreshing} onClick={onRefresh}>
      {RETRY}
    </Button>
  )

  return (
    <div className={css.page}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={status === 'ready' ? <ReadAt readAt={view.readAt} ledger={view.ledger} refreshing={view.refreshing} onRefresh={onRefresh} /> : undefined}
      />

      {status === 'loading' ? <LoadingReserves /> : null}

      {status === 'error' ? (
        <Callout
          variant="danger"
          title={ERROR_TITLE}
          actions={retry}
        >
          <p>{ERROR_FALLBACK}</p>
          {view.error ? <p>{errorReason(view.error)}</p> : null}
        </Callout>
      ) : null}

      {status === 'ready' ? (
        <div className={css.reserves}>
          <ShortfallCallout rows={short} />
          {view.stale && view.readAt !== null ? (
            <Callout variant="warning" title={STALE_TITLE} actions={retry}>
              <p>{staleText(readTimeText(view.readAt))}</p>
            </Callout>
          ) : null}
          {view.heldMissing ? (
            <Callout variant="warning" title={PARTIAL_HELD_TITLE} actions={retry}>
              <p>{PARTIAL_HELD_TEXT}</p>
            </Callout>
          ) : null}
          {view.splitMissing ? (
            <Callout variant="warning" title={PARTIAL_SPLIT_TITLE} actions={retry}>
              <p>{PARTIAL_SPLIT_TEXT}</p>
            </Callout>
          ) : null}

          <section className={css.section} aria-labelledby="reserves-figure">
            <div className={css.sectionHead}>
              <h2 id="reserves-figure">{FIGURE_HEADING}</h2>
              {nothingLocked ? null : (
                <p className={css.summary} data-testid="reserves-summary">
                  {summaryLine(rows)}
                </p>
              )}
            </div>
            <div className={css.layout}>
              <div className={css.figure}>
                {nothingLocked ? (
                  <EmptyNote
                    title={EMPTY_TITLE}
                    hint={EMPTY_HINT}
                    action={
                      <ButtonLink variant="secondary" render={<RouterLink to="/markets" />}>
                        {EMPTY_ACTION}
                      </ButtonLink>
                    }
                  />
                ) : (
                  <ReserveFigure rows={rows} />
                )}
              </div>
              <div className={css.notes}>
                <ReadingNotes />
              </div>
              <div className={css.table}>
                <ReserveTable rows={rows} />
                {view.hiddenEmpty > 0 ? <p className={css.hidden}>{hiddenEmptyNote(view.hiddenEmpty)}</p> : null}
              </div>
              <div className={css.limits}>
                <Limits />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <ContractsAndRoles />
    </div>
  )
}
