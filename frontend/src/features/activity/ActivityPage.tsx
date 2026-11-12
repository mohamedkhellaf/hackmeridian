import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PRO_ENABLED } from '../../core/config'
import { explorerAccount } from '../../core/explorer'
import { useActivity, useOptionsClient } from '../../data'
import { announce, Button, ButtonLink, EmptyNote, Link, PageHeader, useIsWide } from '../../ui'
import { useWallet } from '../../wallet'
import { ActivityList } from './ActivityList'
import { ActivityTable } from './ActivityTable'
import {
  CLEAR_FINISHED,
  CONNECT,
  EMPTY_ACTION,
  EMPTY_CLEARED,
  EMPTY_TITLE,
  EXPLORER_LINK,
  EXPLORER_RECORD,
  GUEST_TITLE,
  PAGE_DESCRIPTION,
  PAGE_DESCRIPTION_GUEST,
  PAGE_TITLE,
  UNDO,
  cleared,
  clearedLine,
  countLine,
  restored,
} from './copy'
import { activityRows, groupRows, settledCount, zoneLabel } from './model'
import css from './ActivityPage.module.css'

/** Finished entries taken off the list but not yet out of the store: Undo puts them back until the page is left. */
interface PendingClear {
  /** The wallet the entries belong to: another wallet's list shows none of this. */
  owner: string | null
  ids: ReadonlySet<string>
  /** The store's remove, bound to the wallet the entries belong to. */
  remove: (id: string) => void
}

/**
 * Activity: every transaction started from this browser as the connected wallet, with its state in words, its
 * hash and a link to what it concerns. Open ones come first, then the finished ones under a heading per day.
 */
export function ActivityPage() {
  const wallet = useWallet()
  const { me, isMock } = useOptionsClient()
  const activity = useActivity()
  // Six columns need the wide layout: below 1200 px the rows are blocks, or the hash and the link scroll out of view.
  const table = useIsWide()
  const [checking, setChecking] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [clearState, setPending] = useState<PendingClear | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const heading = useRef<HTMLHeadingElement>(null)
  const clearedRef = useRef<HTMLParagraphElement>(null)
  const focusAfterConnect = useRef(false)

  // The cut-off of an unknown outcome is said only while it is ahead: read the clock again now and then, and only
  // while such a cut-off is on screen (no re-render every 15 s for a list that has none).
  const cutOffShown = activity.entries.some((e) => e.phase === 'unknown' && e.hash !== null && e.maxTime !== null)
  useEffect(() => {
    if (!cutOffShown) return
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [cutOffShown])

  const pending = clearState && clearState.owner === me ? clearState : null
  const all = useMemo(() => activityRows(activity.entries, { marginEnabled: PRO_ENABLED, now, checkedAt }), [activity.entries, now, checkedAt])
  const rows = useMemo(() => (pending ? all.filter((r) => !pending.ids.has(r.id)) : all), [all, pending])
  const groups = useMemo(() => groupRows(rows), [rows])
  const settled = settledCount(rows)
  const zone = useMemo(() => zoneLabel(now), [now])

  // A clear becomes final when the page is left, the wallet changes or the tab goes away.
  const pendingRef = useRef<PendingClear | null>(null)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])
  useEffect(() => {
    const commit = () => {
      const p = pendingRef.current
      if (p) for (const id of p.ids) p.remove(id)
      pendingRef.current = null
    }
    window.addEventListener('pagehide', commit)
    return () => {
      window.removeEventListener('pagehide', commit)
      commit()
    }
  }, [me])

  // Connecting from the page removes its own button: focus goes to the page title, as after a route change.
  useEffect(() => {
    if (me && focusAfterConnect.current) {
      focusAfterConnect.current = false
      requestAnimationFrame(() => heading.current?.focus())
    }
  }, [me])

  const onConnect = () => {
    focusAfterConnect.current = true
    void wallet.connect()
  }

  const onCheck = (id: string) => {
    setChecking(id)
    // The runner announces a change; a look that finds nothing is said on the row with its time.
    void activity
      .check(id)
      .then((state) => {
        if (state?.phase === 'unknown') setCheckedAt((current) => new Map(current).set(id, Date.now()))
      })
      .finally(() => setChecking((current) => (current === id ? null : current)))
  }

  const onClear = () => {
    const ids = new Set(rows.filter((r) => r.settled).map((r) => r.id))
    if (ids.size === 0) return
    // A clear still waiting is made final first: one Undo at a time.
    const previous = pendingRef.current
    if (previous) for (const id of previous.ids) previous.remove(id)
    setPending({ owner: me, ids, remove: activity.remove })
    announce(cleared(ids.size))
    // The button goes away with the rows: focus goes to the line that says what happened and holds Undo.
    requestAnimationFrame(() => clearedRef.current?.focus())
  }

  const onUndo = () => {
    if (!pending) return
    announce(restored(pending.ids.size))
    setPending(null)
    requestAnimationFrame(() => heading.current?.focus())
  }

  return (
    <div className={css.page}>
      <PageHeader title={PAGE_TITLE} description={me ? PAGE_DESCRIPTION : PAGE_DESCRIPTION_GUEST} headingRef={heading} />

      {me && !isMock ? (
        <p className={css.explorer}>
          {EXPLORER_RECORD}{' '}
          <Link href={explorerAccount(me)} external>
            {EXPLORER_LINK}
          </Link>
        </p>
      ) : null}

      {!me ? (
        <EmptyNote
          headingLevel={2}
          title={GUEST_TITLE}
          action={
            <Button variant="secondary" onClick={onConnect}>
              {CONNECT}
            </Button>
          }
        />
      ) : rows.length === 0 && !pending ? (
        <EmptyNote
          headingLevel={2}
          title={EMPTY_TITLE}
          action={
            <ButtonLink variant="secondary" render={<RouterLink to="/markets" />}>
              {EMPTY_ACTION}
            </ButtonLink>
          }
        />
      ) : (
        <div className={css.list}>
          <div className={css.toolbar}>
            {rows.length > 0 ? (
              <p className={css.count} data-testid="activity-count">
                {countLine(rows.length, activity.inFlight, activity.unknown)}
              </p>
            ) : (
              <p className={css.count}>{EMPTY_CLEARED}</p>
            )}
            {pending ? (
              <p className={css.cleared} ref={clearedRef} tabIndex={-1} data-testid="activity-cleared">
                <span>{clearedLine(pending.ids.size)}</span>
                <Button variant="quiet" size="sm" className={css.action} onClick={onUndo}>
                  {UNDO}
                </Button>
              </p>
            ) : settled > 0 ? (
              <Button variant="quiet" size="sm" className={css.action} onClick={onClear}>
                {CLEAR_FINISHED}
              </Button>
            ) : null}
          </div>
          {rows.length === 0 ? null : table ? (
            <ActivityTable groups={groups} zone={zone} checking={checking} onCheck={onCheck} />
          ) : (
            <ActivityList groups={groups} zone={zone} checking={checking} onCheck={onCheck} />
          )}
        </div>
      )}
    </div>
  )
}
