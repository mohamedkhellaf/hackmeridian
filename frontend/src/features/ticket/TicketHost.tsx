// The three containers of the one order ticket (brief D13): an inline panel in the asset page's rail from
// 1200 px, a right drawer from 768 to 1199 px, and on phones a full page with a 64 px action bar. The flow
// inside is the same in all three; it sends its title up and its actions to the container's bar. The heading
// names the step: there is no step trail.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { JSX, ReactNode, RefObject } from 'react'
import { announce, Button, Drawer, IconButton, IconClose, Segmented, useIsPhone, useIsWide } from '../../ui'
import { BuyFlow } from './BuyFlow'
import { LOADING_TITLE, NO_OFFER, ticketTitle } from './copy'
import type { StepName } from './copy'
import { FillFlow } from './FillFlow'
import { FrameContext } from './frame'
import type { Container, FlowReport, FrameValue } from './frame'
import { intentKey } from './intent'
import type { TicketIntent } from './intent'
import { ListFlow } from './ListFlow'
import { OrderFlow } from './OrderFlow'
import { ResaleFlow } from './ResaleFlow'

import styles from './TicketHost.module.css'

type Tab = 'buy' | 'write' | 'bid'

const TABS: { value: Tab; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'write', label: 'Write' },
  { value: 'bid', label: 'Request' },
]

const tabOf = (intent: TicketIntent): Tab | null => (intent.mode === 'buy' || intent.mode === 'buy-resale' ? 'buy' : intent.mode === 'write' || intent.mode === 'bid' ? intent.mode : null)

interface Reported extends FlowReport {
  key: string
}

const sameReport = (a: Reported | null, b: Reported): boolean =>
  a !== null &&
  a.key === b.key &&
  a.title === b.title &&
  a.step === b.step &&
  a.bestOfferId === b.bestOfferId &&
  a.series?.assetId === b.series?.assetId &&
  a.series?.code === b.series?.code &&
  a.series?.kind === b.series?.kind &&
  a.series?.strike === b.series?.strike &&
  a.series?.expiry === b.series?.expiry

// Whether the last input was the keyboard: a heading focused by the ticket shows its ring only then.
let keyboardLast = false
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (keyboardLast = true), true)
  window.addEventListener('pointerdown', () => (keyboardLast = false), true)
}

/** Where focus goes when the ticket closes and what opened it is gone (a bought row): the series heading, else the page heading. */
function fallbackFocus(): HTMLElement | null {
  const heading = document.querySelector<HTMLElement>('[data-series-heading]') ?? document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1')
  if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  return heading
}

export function TicketHost(props: {
  intent: TicketIntent | null
  onClose: () => void
  onIntentChange?: (next: TicketIntent) => void
  placement: 'rail' | 'overlay'
  startAt?: 'terms' | 'review'
  idle?: ReactNode
}): JSX.Element {
  const { intent, placement, idle } = props
  const wide = useIsWide()
  const phone = useIsPhone()
  const container: Container = placement === 'rail' && wide ? 'rail' : phone ? 'page' : 'drawer'

  // An overlay keeps showing the ticket it had while it slides out.
  const [last, setLast] = useState<TicketIntent | null>(intent)
  if (intent !== null && intent !== last) setLast(intent)

  if (container === 'rail') {
    if (intent === null) return <>{idle ?? null}</>
    return <Ticket {...props} intent={intent} container="rail" open />
  }
  const shown = intent ?? last
  if (shown === null) return <></>
  return <Ticket {...props} intent={shown} container={container} open={intent !== null} />
}

function Ticket(props: { intent: TicketIntent; container: Container; open: boolean; onClose: () => void; onIntentChange?: (next: TicketIntent) => void; startAt?: 'terms' | 'review' }) {
  const { intent, container, open, onClose, onIntentChange, startAt } = props
  const key = intentKey(intent)
  const titleId = useId()
  const titleRef = useRef<HTMLElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null)
  const [reported, setReported] = useState<Reported | null>(null)
  // "Buy" was chosen for a series nobody sells: the ticket says so instead of opening a dead end.
  const [noOfferFor, setNoOfferFor] = useState<string | null>(null)
  // Closed by the user (the close button, Escape, Done, the drawer's own dismissal): true at once, before the
  // route has dropped the intent, so an attempt still reading from the contract does not go on to the wallet.
  const closedFor = useRef<string | null>(null)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
    // Opened again (a drawer keeps its ticket mounted while closed): attempts may go on again.
    if (open) closedFor.current = null
  }, [open, key])

  const current = reported !== null && reported.key === key ? reported : null
  const seriesOfCurrent = current?.series ?? null
  // Tied to the series it was said about: another strike or expiry starts over.
  const emptyKey = `${key}|${seriesOfCurrent?.kind ?? ''}|${seriesOfCurrent?.strike ?? ''}|${seriesOfCurrent?.expiry ?? ''}`
  const emptyBuy = noOfferFor === emptyKey
  const title = emptyBuy ? (seriesOfCurrent?.code ? ticketTitle('buy', seriesOfCurrent.kind, seriesOfCurrent.code) : LOADING_TITLE.buy) : (current?.title ?? LOADING_TITLE[intent.mode])
  const step: StepName = emptyBuy ? 'terms' : (current?.step ?? 'terms')

  const report = useCallback((r: FlowReport) => setReported((prev) => (sameReport(prev, { ...r, key }) ? prev : { ...r, key })), [key])

  // Focus goes to the title without a jump. In the rail the title can still be out of sight (a ticket opened at
  // the end of a long page rides up with the page, or grows after it opens): then, and only then, the smallest
  // scroll brings it into view. A title already on screen never moves the page.
  const revealTitle = useCallback(() => {
    const el = titleRef.current
    if (!el || container !== 'rail') return
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [container])
  const focusTitle = useCallback(() => {
    const el = titleRef.current
    if (!el) return
    el.focus({ preventScroll: true, focusVisible: keyboardLast } as FocusOptions)
    revealTitle()
  }, [revealTitle])

  // For a moment after a step changes, the ticket may still grow (a read lands): check the title again then.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || container !== 'rail' || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => revealTitle())
    observer.observe(section)
    const stop = window.setTimeout(() => observer.disconnect(), 800)
    return () => {
      window.clearTimeout(stop)
      observer.disconnect()
    }
  }, [container, step, revealTitle])

  // In the rail nothing announces a ticket that opens beside the page: move focus to its heading and say what it
  // is. A switch between Buy, Write and Request made from the ticket's own tabs keeps focus where it is.
  const fromTabs = useRef(false)
  const openedKey = useRef<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (openedKey.current === key) return
    const first = openedKey.current === null
    openedKey.current = key
    const active = document.activeElement
    if (first && active instanceof HTMLElement && active !== document.body && !sectionRef.current?.contains(active)) opener.current = active
    if (container !== 'rail') return
    if (fromTabs.current) {
      fromTabs.current = false
      return
    }
    // The first ticket of a page load is part of the page (a link opened it): no focus is taken from the page.
    if (first && active === document.body) return
    if (active instanceof HTMLElement && !sectionRef.current?.contains(active)) opener.current = active
    focusTitle()
    announce(`Order ticket: ${LOADING_TITLE[intent.mode]}`)
  }, [container, key, focusTitle, intent.mode])

  // Closing the ticket removes whatever had focus inside it: hand focus back to what opened it, if it is still
  // there (a row of an offer just bought is not), else to the heading of the series or of the page.
  const closeRail = useCallback(() => {
    const back = opener.current
    closedFor.current = key
    onClose()
    requestAnimationFrame(() => {
      if (document.activeElement !== null && document.activeElement !== document.body) return
      const target = back?.isConnected ? back : fallbackFocus()
      target?.focus({ preventScroll: true })
    })
  }, [onClose, key])
  const closeOverlay = useCallback(() => {
    closedFor.current = key
    onClose()
  }, [onClose, key])
  const close = container === 'rail' ? closeRail : closeOverlay
  const isOpen = useCallback(() => openRef.current && closedFor.current !== key, [key])
  const frame = useMemo<FrameValue>(() => ({ container, actionsEl, report, focusTitle, close, isOpen }), [container, actionsEl, report, focusTitle, close, isOpen])
  // The drawer returns focus to what opened it, or to the same fallback when that is gone.
  const finalFocus = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        const back = opener.current
        return back?.isConnected ? back : fallbackFocus()
      },
    }),
    [],
  )

  const tab = tabOf(intent)
  const series = current?.series ?? null
  // Buy opens on its review (there is nothing to set), so the tabs stay there too.
  const tabStep = step === 'terms' || (step === 'review' && tab === 'buy')
  const showTabs = onIntentChange !== undefined && tab !== null && tabStep && (series !== null || emptyBuy)
  const selectTab = (next: Tab) => {
    if (!onIntentChange || !series) return
    const shownTab = emptyBuy ? 'buy' : tab
    if (next === shownTab) return
    fromTabs.current = true
    if (next === 'buy') {
      if (intent.mode === 'buy' || intent.mode === 'buy-resale') return setNoOfferFor(null)
      if (current?.bestOfferId != null) onIntentChange({ mode: 'buy', offerId: current.bestOfferId })
      else setNoOfferFor(emptyKey)
      return
    }
    setNoOfferFor(null)
    if (intent.mode !== next) onIntentChange({ mode: next, assetId: series.assetId, kind: series.kind, strike: series.strike, expiry: series.expiry })
  }

  const body = (
    <FrameContext.Provider value={frame}>
      {showTabs ? <Segmented label="What the ticket does" fullWidth size="sm" value={emptyBuy ? 'buy' : (tab ?? 'buy')} onValueChange={selectTab} options={TABS} /> : null}
      {emptyBuy ? (
        <div className={styles.noOffer}>
          <p className={styles.noOfferText}>{NO_OFFER}</p>
          <div>
            <Button variant="secondary" onClick={() => selectTab('bid')}>
              Post a request
            </Button>
          </div>
        </div>
      ) : null}
      <div hidden={emptyBuy} className={styles.flowSlot}>
        <FlowFor key={key} intent={intent} startAt={startAt} onIntentChange={onIntentChange} />
      </div>
    </FrameContext.Provider>
  )

  if (container === 'rail') {
    return (
      <section
        ref={sectionRef}
        className={styles.rail}
        aria-labelledby={titleId}
        data-testid="ticket"
        data-container="rail"
        data-step={step}
        onKeyDown={(e) => {
          // Escape clears the ticket, unless a popover inside it is open. Closing is allowed at every step: before
          // the wallet is asked it cancels the attempt; after, the transaction goes on and Activity records it.
          if (e.key !== 'Escape' || e.defaultPrevented) return
          if (sectionRef.current?.querySelector('[data-popup-open]')) return
          close()
        }}
      >
        <header className={styles.railHead}>
          <h2
            id={titleId}
            className={styles.railTitle}
            tabIndex={-1}
            ref={(el) => {
              titleRef.current = el
            }}
          >
            {title}
          </h2>
          <IconButton label="Close ticket" icon={<IconClose />} size="sm" onClick={close} className={styles.railClose} />
        </header>
        <div className={styles.railBody}>{body}</div>
        <div className={styles.actions} ref={setActionsEl} data-emptybuy={emptyBuy || undefined} />
      </section>
    )
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) closeOverlay()
      }}
      finalFocus={finalFocus}
      title={
        <span
          className={styles.overlayTitle}
          tabIndex={-1}
          ref={(el) => {
            titleRef.current = el
          }}
        >
          {title}
        </span>
      }
      closeLabel="Close ticket"
      presentation="page"
      footer={<div className={styles.actions} ref={setActionsEl} data-container={container} data-emptybuy={emptyBuy || undefined} />}
    >
      {/* As a page (phones) the kit never lets a swipe close it, so typed terms are not thrown away. */}
      <div className={styles.overlayBody} data-testid="ticket" data-container={container}>
        {body}
      </div>
    </Drawer>
  )
}

function FlowFor({ intent, startAt, onIntentChange }: { intent: TicketIntent; startAt?: 'terms' | 'review'; onIntentChange?: (next: TicketIntent) => void }) {
  switch (intent.mode) {
    case 'buy':
      return <BuyFlow intent={intent} onIntentChange={onIntentChange} />
    case 'buy-resale':
      return <ResaleFlow intent={intent} />
    case 'fill':
      return <FillFlow intent={intent} />
    case 'list':
      return <ListFlow intent={intent} startAt={startAt} />
    case 'write':
    case 'bid':
      return <OrderFlow intent={intent} startAt={startAt} onIntentChange={onIntentChange} />
  }
}
