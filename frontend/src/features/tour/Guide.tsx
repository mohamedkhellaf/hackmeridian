// The runner of the welcome guide. It reads the request in `useGuide().run` and shows the notes for the page the
// visitor is on, one at a time, each beside its control. It never navigates, never dims or blocks the page, never
// advances by itself, and it ends on any press outside the note, which still does what it was for.
import { useLocation } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GuideAnchor } from '../../core/guide'
import { useGuide, useMe, useTxBusy } from '../../data'
import type { GuideRun } from '../../data'
import { Button, Coachmark, VisuallyHidden, announce, useIsPhone } from '../../ui'
import type { CoachmarkCloseReason } from '../../ui'
import { BACK, CLOSE_LABEL, CLOSING_LINE, CLOSING_LINE_PHONE, COUNT_SUBJECT, DONE, GUIDE_CLOSED, NEXT, countText, soloAnnouncement, stepAnnouncement } from './copy'
import { findAnchor, inViewport, overlayOpen, restoreFocus, reveal } from './dom'
import { notesFor, present, reconcile, spoken } from './engine'
import { NOTES } from './notes'
import styles from './Guide.module.css'

/** How long a tour waits for a menu to close and a control to show up before it gives up without a trace. */
const START_WINDOW_MS = 3000

type EndReason = CoachmarkCloseReason | 'done' | 'route' | 'lost'

/** What is on screen for one run. Kept after the note closes, so its words are still there while it fades. */
interface Show {
  run: GuideRun
  /** The note on the mode switch, opened by itself: no count, no Next, and it never takes focus. */
  solo: boolean
  id: GuideAnchor
  /** The notes whose control is on screen, in order: the "of n" of the count. */
  ids: readonly GuideAnchor[]
  target: Element
  /** The phone tab bar, when the note is docked above it. */
  dock: Element | null
  /** Rises with every change of note: restarts the fade. */
  turn: number
}

const sameIds = (a: readonly GuideAnchor[], b: readonly GuideAnchor[]): boolean => a.length === b.length && a.every((id, i) => id === b[i])

/** Mounted beside the shell by `src/app/GuideMount`, in a chunk that loads when a guide is first asked for. */
export function GuideHost() {
  const { run, shown, end } = useGuide()
  const connected = useMe() !== null
  const phone = useIsPhone()
  const busy = useTxBusy()
  const pathname = useLocation({ select: (location) => location.pathname })

  const notes = useMemo(() => notesFor(NOTES, { phone, connected }), [phone, connected])
  const [show, setShow] = useState<Show | null>(null)
  const [open, setOpen] = useState(false)
  const mainButton = useRef<HTMLButtonElement | null>(null)
  /** What had focus when the tour began. */
  const returnTo = useRef<Element | null>(null)
  /** The run and the note last said aloud, so one note is announced once. */
  const said = useRef<{ run: GuideRun; turn: number } | null>(null)

  const finish = (reason: EndReason) => {
    if (!show || !open) return
    setOpen(false)
    end(show.run)
    // After a change of page the router moves focus to the new heading and the title is read: nothing to add.
    if (reason === 'route') return
    announce(GUIDE_CLOSED)
    // A press outside leaves focus on what was pressed.
    if (reason === 'outside') return
    // A note that opened by itself never took focus: it gives it back only if the visitor moved into the note.
    const inNote = document.activeElement?.closest('[data-coachmark]') != null
    if (show.solo && !inNote) return
    restoreFocus(returnTo.current)
  }

  // A run that was taken away while its note was open (another one was asked for) closes its note.
  if (open && show !== null && show.run !== run) setOpen(false)

  /** Starts the run that was asked for, if nothing is in its way. A tour that has to wait is asked again by `sync`. */
  const begin = (next: GuideRun): void => {
    if (next.id === 'mode') {
      // The one note that opens by itself: only beside a switch the visitor can see, over nothing, during nothing.
      // Otherwise it is dropped and nothing is recorded, so a later visit to an asset page tries again.
      const target = findAnchor('mode')
      if (busy || overlayOpen() || !target || !inViewport(target)) {
        end(next)
        return
      }
      returnTo.current = document.activeElement
      setShow({ run: next, solo: true, id: 'mode', ids: ['mode'], target, dock: null, turn: 0 })
      setOpen(true)
      return
    }
    // A tour waits for the menu or the sheet it was started from to close, and for a transaction to land.
    if (busy || overlayOpen()) return
    const here = present(notes, (id) => findAnchor(id) !== null)
    const first = here[0]
    const target = first ? findAnchor(first.id) : null
    if (!first || !target) return
    returnTo.current = document.activeElement
    setShow({ run: next, solo: false, id: first.id, ids: here.map((note) => note.id), target, dock: first.dock ? findAnchor('nav') : null, turn: 0 })
    setOpen(true)
  }

  /** Reads the page again: starts a waiting run, or follows a change under the note that is open. */
  const sync = () => {
    if (!run) return
    if (!open || show?.run !== run) {
      begin(run)
      return
    }
    if (show.solo) {
      const target = findAnchor('mode')
      if (!target) finish('lost')
      else if (target !== show.target) setShow({ ...show, target })
      return
    }
    // The control of this note may be gone (the window crossed 768 px, a wallet connected in another tab): the
    // same name on another element takes over, else the next note that has a control, else the previous one.
    const here = present(notes, (id) => findAnchor(id) !== null)
    const id = reconcile(notes, here, show.id)
    const note = here.find((n) => n.id === id)
    const target = id ? findAnchor(id) : null
    if (!id || !note || !target) {
      finish('lost')
      return
    }
    const ids = here.map((n) => n.id)
    const dock = note.dock ? findAnchor('nav') : null
    if (id === show.id && target === show.target && dock === show.dock && sameIds(ids, show.ids)) return
    setShow({ ...show, id, ids, target, dock, turn: id === show.id ? show.turn : show.turn + 1 })
  }

  // The effects below call the newest `sync` and `finish` without being set up again on every render.
  const latest = useRef({ sync, finish })
  useLayoutEffect(() => {
    latest.current = { sync, finish }
  })

  // One observer on the page, plus resize, read at most once per frame. No polling.
  const schedule = useRef<() => void>(() => {})
  useEffect(() => {
    if (!run) return
    let frame = 0
    // The note that opens by itself waits one more frame: the router has then put the new page at its top.
    let wait = run.id === 'mode' ? 2 : 1
    const check = () => {
      frame = 0
      if (--wait > 0) frame = requestAnimationFrame(check)
      else latest.current.sync()
    }
    const ask = () => {
      if (frame === 0) frame = requestAnimationFrame(check)
    }
    const observer = new MutationObserver(ask)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] })
    window.addEventListener('resize', ask)
    schedule.current = ask
    ask()
    return () => {
      schedule.current = () => {}
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', ask)
    }
  }, [run])

  // The layout, the wallet or a transaction changed: read the page again.
  useEffect(() => {
    schedule.current()
  }, [notes, busy])

  // A tour that cannot start (no control on this page, a dialog that stays open) is dropped after a moment.
  // Nothing is recorded.
  const started = open && show !== null && show.run === run
  useEffect(() => {
    if (!run || started) return
    const timer = window.setTimeout(() => end(run), START_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [run, started, end])

  // Leaving the page ends the run, also one that is still waiting to start.
  const startedAt = useRef<{ run: GuideRun; pathname: string } | null>(null)
  useEffect(() => {
    if (!run) return
    if (startedAt.current?.run !== run) startedAt.current = { run, pathname }
    else if (startedAt.current.pathname !== pathname) {
      if (started) latest.current.finish('route')
      else end(run)
    }
  }, [run, pathname, started, end])

  // The note is on screen: remember it, bring its control into view, and say a new note aloud.
  const shownRun = started ? show.run : null
  const shownId = started ? show.id : null
  const shownTarget = started ? show.target : null
  const shownTurn = started ? show.turn : 0
  useEffect(() => {
    if (!shownRun || !shownId) return
    if (shownRun.id === 'tour') shown('tour')
    if (shownId === 'mode') shown('mode')
  }, [shownRun, shownId, shown])
  useEffect(() => {
    // The note that opened by itself never scrolls the page. A frame later, so the page has taken its new shape
    // (the welcome on Markets becomes one line when the tour starts).
    if (!shownRun || !shownTarget || shownRun.id !== 'tour') return
    const frame = requestAnimationFrame(() => reveal(shownTarget))
    return () => cancelAnimationFrame(frame)
  }, [shownRun, shownTarget, shownTurn])

  const note = show ? (notes.find((n) => n.id === show.id) ?? null) : null
  const index = show ? show.ids.indexOf(show.id) : -1
  const total = show ? show.ids.length : 0
  const solo = show?.solo === true
  const last = index === total - 1
  const closing = !solo && last ? (phone ? CLOSING_LINE_PHONE : CLOSING_LINE) : null

  useEffect(() => {
    if (!shownRun || !note || index < 0) return
    if (said.current?.run === shownRun && said.current.turn === shownTurn) return
    said.current = { run: shownRun, turn: shownTurn }
    const words = closing ? `${spoken(note)} ${closing}` : spoken(note)
    // A tour's first note takes focus, so the dialog's name and description are read: nothing to announce.
    if (solo) announce(soloAnnouncement(note.title, words))
    else if (shownTurn > 0) announce(stepAnnouncement(index + 1, total, note.title, words))
  }, [shownRun, shownTurn, note, index, total, solo, closing])

  const onClose = useCallback((reason: CoachmarkCloseReason) => latest.current.finish(reason), [])

  if (!show || !note) return null

  const go = (to: GuideAnchor | undefined) => {
    const next = to ? notes.find((n) => n.id === to) : undefined
    const target = next ? findAnchor(next.id) : null
    // The control left the page since the count was made: read the page again.
    if (!next || !target) sync()
    else setShow({ ...show, id: next.id, target, dock: next.dock ? findAnchor('nav') : null, turn: show.turn + 1 })
  }
  const back = () => {
    // The first note has no Back: focus moves to the main button before Back is taken away.
    if (index === 1) mainButton.current?.focus()
    go(show.ids[index - 1])
  }
  const size = phone ? 'md' : 'sm'

  return (
    <Coachmark
      open={open}
      target={show.target}
      anchor={show.dock}
      counter={
        solo || index < 0 ? undefined : (
          <>
            <VisuallyHidden>{COUNT_SUBJECT} </VisuallyHidden>
            {countText(index + 1, total)}
          </>
        )
      }
      title={note.title}
      foot={closing ?? undefined}
      side={note.side}
      align={note.align}
      closeLabel={CLOSE_LABEL}
      onClose={onClose}
      initialFocus={solo ? false : mainButton}
      finalFocus={false}
      stepKey={show.turn}
      actions={
        <>
          {!solo && index > 0 ? (
            <Button key="back" variant="quiet" size={size} onClick={back}>
              {BACK}
            </Button>
          ) : null}
          <Button key="main" ref={mainButton} variant="secondary" size={size} onClick={solo || last ? () => finish('done') : () => go(show.ids[index + 1])}>
            {solo || last ? DONE : NEXT}
          </Button>
        </>
      }
    >
      {note.terms ? (
        <dl className={styles.terms}>
          {note.terms.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        note.body
      )}
    </Coachmark>
  )
}
