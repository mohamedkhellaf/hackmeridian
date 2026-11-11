// The three containers of the one order ticket (brief D13): an inline panel in the asset page's rail from
// 1200 px, a right drawer from 768 to 1199 px, and on phones a full page with a 64 px action bar. The flow
// inside is the same in all three; it sends its title up and its actions to the container's bar.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { announce, Button, Drawer, EmptyNote, IconButton, IconClose, Segmented, StepTrail, useIsPhone, useIsWide } from '../../ui'
import { BuyFlow } from './BuyFlow'
import { LOADING_TITLE, STEP_LABEL, STEPS } from './copy'
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
  a.series?.kind === b.series?.kind &&
  a.series?.strike === b.series?.strike &&
  a.series?.expiry === b.series?.expiry

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

  const current = reported !== null && reported.key === key ? reported : null
  const seriesOfCurrent = current?.series ?? null
  // Tied to the series it was said about: another strike or expiry starts over.
  const emptyKey = `${key}|${seriesOfCurrent?.kind ?? ''}|${seriesOfCurrent?.strike ?? ''}|${seriesOfCurrent?.expiry ?? ''}`
  const emptyBuy = noOfferFor === emptyKey
  const title = emptyBuy ? 'Buy an option' : (current?.title ?? LOADING_TITLE[intent.mode])
  const step: StepName = emptyBuy ? 'terms' : (current?.step ?? 'terms')

  const report = useCallback((r: FlowReport) => setReported((prev) => (sameReport(prev, { ...r, key }) ? prev : { ...r, key })), [key])
  // Focus goes to the title without a jump. In the rail the title can still be out of sight: the rail scrolls by
  // itself when the ticket is taller than the window, and at the very end of a long page it rides up with the
  // page. So the title is then brought into view by the smallest scroll that shows it.
  const focusTitle = useCallback(() => {
    const el = titleRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    if (container === 'rail') el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [container])

  // In the rail nothing announces a ticket that opens beside the page: move focus to its heading and say what it
  // is. A switch between Buy, Write and Request made from the ticket's own tabs keeps focus where it is.
  const fromTabs = useRef(false)
  const openedKey = useRef<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (container !== 'rail' || openedKey.current === key) return
    const first = openedKey.current === null
    openedKey.current = key
    if (fromTabs.current) {
      fromTabs.current = false
      return
    }
    // The first ticket of a page load is part of the page (a link opened it): no focus is taken from the page.
    const active = document.activeElement
    if (first && active === document.body) return
    if (active instanceof HTMLElement && !sectionRef.current?.contains(active)) opener.current = active
    focusTitle()
    announce(`Order ticket: ${LOADING_TITLE[intent.mode]}`)
  }, [container, key, focusTitle, intent.mode])

  // Closing the rail ticket removes whatever had focus inside it: hand focus back to what opened it, if it is
  // still there (the drawer does the same by itself).
  const closeRail = useCallback(() => {
    const back = opener.current
    onClose()
    requestAnimationFrame(() => {
      if (back?.isConnected && (document.activeElement === null || document.activeElement === document.body)) back.focus()
    })
  }, [onClose])
  const close = container === 'rail' ? closeRail : onClose
  const frame = useMemo<FrameValue>(() => ({ container, actionsEl, report, focusTitle, close }), [container, actionsEl, report, focusTitle, close])

  const tab = tabOf(intent)
  const series = current?.series ?? null
  const showTabs = onIntentChange !== undefined && tab !== null && step === 'terms' && (series !== null || emptyBuy)
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

  const at = STEPS.indexOf(step)
  const trail = STEPS.map((name, i) => ({ label: STEP_LABEL[name], status: i < at ? ('done' as const) : i === at ? ('current' as const) : ('upcoming' as const) }))

  const body = (
    <FrameContext.Provider value={frame}>
      <div className={styles.lead}>
        {showTabs ? <Segmented label="What the ticket does" fullWidth size="sm" value={emptyBuy ? 'buy' : (tab ?? 'buy')} onValueChange={selectTab} options={TABS} /> : null}
        <StepTrail label="Steps of the ticket" steps={trail} />
      </div>
      {emptyBuy ? (
          <EmptyNote
            headingLevel={3}
            title="No open offer on this series."
            hint="Nobody sells these terms right now. A request escrows your premium and waits for a seller."
            action={
              <Button variant="secondary" onClick={() => selectTab('bid')}>
                Post a request
              </Button>
            }
          />
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
        onKeyDown={(e) => {
          // Escape clears the ticket, unless a popover inside it is open or a transaction is being signed.
          if (e.key !== 'Escape' || e.defaultPrevented || step === 'sign') return
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
        if (!next) onClose()
      }}
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
      <div className={styles.overlayBody} data-testid="ticket" data-container={container}>
        {body}
      </div>
    </Drawer>
  )
}

function FlowFor({ intent, startAt, onIntentChange }: { intent: TicketIntent; startAt?: 'terms' | 'review'; onIntentChange?: (next: TicketIntent) => void }) {
  switch (intent.mode) {
    case 'buy':
      return <BuyFlow intent={intent} startAt={startAt} />
    case 'buy-resale':
      return <ResaleFlow intent={intent} startAt={startAt} />
    case 'fill':
      return <FillFlow intent={intent} startAt={startAt} />
    case 'list':
      return <ListFlow intent={intent} startAt={startAt} />
    case 'write':
    case 'bid':
      return <OrderFlow intent={intent} startAt={startAt} onIntentChange={onIntentChange} />
  }
}
