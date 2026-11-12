// Guided mode of the asset page (brief 4.3): one of four outcomes in plain words. The page reads top to bottom
// as a decision (E11): what you want, your three terms and what the contract holds for them, what you would hold
// at a lower and a higher price, then the one action (in the order rail from 1200 px), and below it, for whoever
// wants them, the figure at any price and who acts and by when.
//
// State is the URL: intent, qty, strike, expiry (and premium on the fallback path). Anything the URL does not
// say falls back to a default computed from what is funded. Every figure comes from core/ and data/ hooks,
// through the model of useGuidedModel, which the closing block in the rail reads as well.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { deadlineUrgency, formatCountdown, formatLocal, formatUnits, formatUtcDay, formatUtcTime, isoUtc } from '../../../core/format'
import { expiryDayKey, plainDecimal } from '../../../core/series'
import { definitionOf } from '../../../core/glossary'
import { cellKey } from '../../../core/market/selection'
import { distancePct } from '../../../core/reference'
import { shortBy } from '../../../core/units'
import { Button, Callout, ContractNote, EmptyNote, Skeleton, Term, Timeline, announce, useIsWide } from '../../../ui'
import type { ChoiceChip } from '../../../ui'
import { Available } from './Available'
import { ActionBar, ClosingBlock } from './Closing'
import { useClosingInRail } from './railClosing'
import {
  ANNOUNCE,
  ASSUMED_NOTE,
  AT_REFERENCE,
  DEADLINE_NEAR,
  DETAIL_HEADING,
  DISTANCE_FULL,
  EXPIRY_CHIPS_LABEL,
  FUNDED_KEY,
  FUNDED_WORD,
  HAVE,
  HOLD,
  LOADING_LABEL,
  LOAD_ERROR_BODY,
  LOAD_ERROR_TITLE,
  LOCKS,
  LOTS,
  MAX_AFFORD,
  MAX_HOLDING,
  MAX_LOT,
  NEED_PREMIUM,
  NEED_QTY,
  NEEDS_LATER,
  NOT_LISTED,
  NO_GRID,
  NO_GRID_HINT,
  NO_GRID_OTHERS,
  OFF_GRID,
  OUTCOME_HEADING,
  OVER_HOLDING,
  OWN_PREMIUM_NOTE,
  RETRY,
  SHORT_ASSET,
  SHORT_QUOTE,
  STRIKE_CHIPS_LABEL,
  TIME_LEFT,
  UNTIL_LABEL,
  WHEN,
  WHEN_HEADING,
  WHEN_NEED_QTY,
  YOUR_TIME,
  QTY_EMPTY,
  qtyNotExact,
  timelineSteps,
} from './copy'
import { IntentPicker } from './IntentPicker'
import { OutcomeCardsBlock, OutcomeDetail } from './Outcome'
import { useOutcome } from './useOutcome'
import { Terms } from './Terms'
import { publishShownSeries } from './shownSeries'
import { distanceWords, inputAmount, normalizeDecimal } from './terms'
import { ticketOpen, useGuidedSearch } from './useGuidedSearch'
import { useGuidedIntent, useGuidedModel } from './useGuidedModel'
import type { GuidedModel } from './useGuidedModel'
import styles from './GuidedMode.module.css'

export function GuidedMode({ assetId }: { assetId: string }) {
  const { intent, setIntent } = useGuidedIntent()
  const state = useGuidedModel(assetId)

  // An open ticket's side and kind decide the intent (terms.ts intentOf): the URL is made to say so, so the
  // intent stays when the ticket closes. A replace, as the ticket's own changes are.
  const { search, patch } = useGuidedSearch()
  const urlIntent = search.intent
  const open = ticketOpen(search)
  useEffect(() => {
    if (open && urlIntent !== intent) patch({ intent }, { replace: true })
  }, [open, urlIntent, intent, patch])

  let body
  if (state.status === 'error') {
    body = (
      <Callout variant="danger" title={LOAD_ERROR_TITLE} actions={<Button onClick={state.retry}>{RETRY}</Button>}>
        {LOAD_ERROR_BODY}
      </Callout>
    )
  } else if (state.status === 'loading') {
    body = <Loading />
  } else if (state.status === 'not-listed') {
    body = <EmptyNote title={NOT_LISTED} headingLevel={2} />
  } else if (state.status === 'no-grid') {
    body = <EmptyNote title={NO_GRID} hint={state.others > 0 ? NO_GRID_OTHERS(state.others) : NO_GRID_HINT} headingLevel={2} />
  } else {
    body = <Flow key={`${assetId}:${intent}`} model={state.model} />
  }

  return (
    <div className={styles.root} data-testid="guided-mode">
      <IntentPicker value={intent} onChange={setIntent} />
      {body}
    </div>
  )
}

/** The frame of the note and the figure, so the page keeps its shape when the data arrives. */
function Loading() {
  return (
    <div className={styles.loading} aria-busy="true">
      <span className="ui-vh">{LOADING_LABEL}</span>
      <div className={styles.loadingNote}>
        <Skeleton width="40%" />
        <Skeleton lines={2} />
        <div className={styles.loadingFigures}>
          <Skeleton variant="block" height="var(--control-h)" />
          <Skeleton variant="block" height="var(--control-h)" />
          <Skeleton variant="block" height="var(--control-h)" />
        </div>
        <Skeleton variant="block" height="var(--touch)" />
        <Skeleton variant="block" height="var(--touch)" />
        <Skeleton variant="rows" lines={4} />
      </div>
      <Skeleton variant="block" height="var(--loading-chart-h)" />
    </div>
  )
}

function Flow({ model }: { model: GuidedModel }) {
  const { intent, copy, asset, quote, reference, refPrice, nowSec, strike, expiry, side, info, qty, typedQty, strikeTotal, words, exact } = model
  const kind = info.optionKind
  const wide = useIsWide()
  const inRail = useClosingInRail()

  // ---- the series on screen, for the switch to the chain
  const strikeParam = plainDecimal(strike, quote.decimals)
  const expiryParam = expiryDayKey(expiry)
  useEffect(() => publishShownSeries(asset.contractId, { kind, strike: strikeParam, expiry: expiryParam }), [asset.contractId, kind, strikeParam, expiryParam])

  // ---- one order on the page (F4): a write or request ticket that a link opened without terms takes the terms
  // this page shows, never the ticket's own defaults. Once per opening, so a field the user empties in the ticket
  // is not filled again.
  const { search, patch } = useGuidedSearch()
  const formSide = search.side === 'write' || search.side === 'bid' ? search.side : null
  const seeded = useRef<string | null>(null)
  const qtyText = qty !== null ? normalizeDecimal(model.qtyDraft.text) : undefined
  useEffect(() => {
    if (formSide === null) {
      seeded.current = null
      return
    }
    if (seeded.current === formSide) return
    seeded.current = formSide
    const next = { kind, strike: search.strike ?? strikeParam, expiry: search.expiry ?? expiryParam, qty: search.qty ?? qtyText }
    if (next.strike === search.strike && next.expiry === search.expiry && next.qty === search.qty && search.kind === kind) return
    patch(next, { replace: true })
  }, [formSide, search.strike, search.expiry, search.qty, search.kind, kind, strikeParam, expiryParam, qtyText, patch])

  const money = (units: bigint) => formatUnits(units, quote.decimals)
  const units = (amount: bigint) => formatUnits(amount, asset.decimals)
  const referenceLabel = reference.label.toLowerCase()
  const referenceText = refPrice !== null ? money(refPrice) : null

  // ---- a price or a date the link named that is not on the list: the URL is set to what is shown, and that is
  // said once above the chips
  const [notice, setNotice] = useState<string | null>(null)
  const { dropped, pin, ticketIsOpen } = model
  useEffect(() => {
    if (dropped.strike === null && dropped.expiry === null) return
    const parts: string[] = []
    if (dropped.strike !== null) parts.push(OFF_GRID.strike(money(dropped.strike), money(strike), quote.code))
    if (dropped.expiry !== null) parts.push(OFF_GRID.expiry(formatUtcDay(dropped.expiry), formatUtcDay(expiry)))
    setNotice(parts.join(' '))
    // Terms of the user's own typed in an open ticket ("Custom terms") stay with the ticket: closing it under the
    // user would lose them. Once it is closed, the URL names the terms shown, so the dropped ones are said once.
    if (ticketIsOpen) return
    pin({ premium: model.premiumUrl }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped.strike, dropped.expiry, ticketIsOpen])

  // ---- the quantity field: balances, lots, and what the quantity means
  const { held, cash, max, lots } = model
  const qtyAside = info.starts === 'asset' ? (held !== null ? HOLD(units(held), asset.code) : undefined) : cash !== null ? HAVE(money(cash), quote.code) : undefined
  let qtyHint: string | undefined
  let qtyError: string | undefined
  if (typedQty === null) qtyError = QTY_EMPTY
  else if (strikeTotal === null) qtyError = qtyNotExact(asset.code)
  else if (intent === 'floor') {
    if (held !== null && typedQty > held) qtyHint = OVER_HOLDING(units(held), asset.code)
  } else if (intent === 'earn-hold') {
    if (held !== null && typedQty > held) qtyError = SHORT_ASSET(units(held), units(typedQty), units(shortBy(held, typedQty)), asset.code)
  } else if (intent === 'earn-buy') {
    if (cash !== null && strikeTotal > cash) qtyError = SHORT_QUOTE(money(cash), money(strikeTotal), money(shortBy(cash, strikeTotal)), quote.code)
    else qtyHint = LOCKS(money(strikeTotal), quote.code)
  } else {
    qtyHint = NEEDS_LATER(money(strikeTotal), quote.code)
  }
  // Offers are sold and requests filled whole: the lots at this price and date are said under the field, when
  // the quantity is the default taken from one of them or matches none.
  const lotsLine = lots.length > 0 && (!model.qtyDraft.edited || typedQty === null || !lots.includes(typedQty)) ? LOTS[side](formatLots(lots.map(units)), asset.code) : undefined

  // ---- chips
  const fundedWord = FUNDED_WORD[side]
  const isFunded = (e: number, k: bigint) => model.funded.has(cellKey({ expiry: e, kind, strikePerUnit: k }))
  const chipName = (parts: ReadonlyArray<string | undefined>): string => parts.filter((part) => part !== undefined && part !== '').join(', ')
  const strikeChips: ChoiceChip[] = model.view.ladder.map((k) => {
    const distance = distanceWords(distancePct(k, reference))
    const on = isFunded(expiry, k)
    const detailName = distance ? (distance.side !== 'at' ? `${distance.short} the ${referenceLabel}` : distance.short) : undefined
    return { value: k.toString(), label: money(k), marked: on, name: chipName([`${money(k)} ${quote.code}`, detailName, on ? fundedWord.yes : fundedWord.no]) }
  })
  const expiryChips: ChoiceChip[] = model.view.expiries.map((e) => {
    const on = isFunded(e, strike)
    const left = TIME_LEFT(formatCountdown(e - nowSec))
    return { value: e.toString(), label: formatUtcDay(e), marked: on, name: chipName([formatUtcDay(e), left, on ? fundedWord.yes : fundedWord.no]) }
  })
  const anyMarked = strikeChips.some((c) => c.marked) || expiryChips.some((c) => c.marked)
  const strikeDistance = distanceWords(distancePct(strike, reference))
  const strikeHint =
    strikeDistance && referenceText ? (strikeDistance.side === 'at' ? AT_REFERENCE(referenceLabel, referenceText) : DISTANCE_FULL(strikeDistance.short, referenceLabel, referenceText)) : undefined

  const urgency = deadlineUrgency(expiry - nowSec)
  const near = urgency === 'within48h' || urgency === 'within2h' || urgency === 'within15min' ? DEADLINE_NEAR[urgency] : null

  // ---- what is available, read out when a change of terms changes it (the block is far from the chips)
  const found = model.match ? (exact ? `${exact.key}:${exact.totalPremium}` : 'none') : null
  const lastFound = useRef<string | null>(null)
  useEffect(() => {
    if (found === null) return
    const first = lastFound.current === null
    const changed = lastFound.current !== found
    lastFound.current = found
    if (first || !changed) return
    if (!exact) announce(ANNOUNCE.nothing)
    else announce((exact.source === 'bid' ? ANNOUNCE.request : exact.source === 'resale' ? ANNOUNCE.listing : ANNOUNCE.offer)(formatUnits(exact.totalPremium, quote.decimals), quote.code))
  }, [found, exact, quote.decimals, quote.code])
  // A failed refresh is said on the block's heading line and read out once; nothing on the page moves.
  useEffect(() => {
    if (model.refreshFailed) announce(ANNOUNCE.stale)
  }, [model.refreshFailed])

  // ---- "Use these terms": the button is gone afterwards, so focus goes to the block's heading, in view
  const availableHeading = useRef<HTMLHeadingElement | null>(null)
  const useTerms = (t: { qty: bigint; strike: bigint; expiry: number }) => {
    model.useTerms(t)
    announce(ANNOUNCE.terms(units(t.qty), asset.code, money(t.strike), quote.code, formatUtcDay(t.expiry)))
    requestAnimationFrame(() => {
      const el = availableHeading.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    })
  }

  // ---- the outcome: drawn only with a premium (the order's, the user's own, or the lowest offer's, labelled)
  const figurePremium = model.premium ?? model.assumed?.total ?? null
  const outcome = useOutcome(
    qty !== null && strikeTotal !== null && figurePremium !== null
      ? {
          intent,
          qty,
          strikeTotal,
          premium: figurePremium,
          asset,
          quote,
          words,
          reference: refPrice !== null && referenceText ? { perUnit: refPrice, label: reference.label, text: referenceText } : null,
          seriesKey: `${strike}:${expiry}`,
        }
      : null,
  )
  const premiumNote =
    model.premiumSource === 'own' && words.premium
      ? OWN_PREMIUM_NOTE(words.premium, quote.code)
      : model.premiumSource === 'assumed' && model.assumed
        ? ASSUMED_NOTE(money(model.assumed.perUnit), quote.code)
        : null

  // ---- the closing block: in the rail from 1200 px when the asset page puts it there, else here; never while a
  // ticket is open. Below 1200 px a sticky bar carries the action while the block is out of view.
  const closingInPage = !inRail && !model.ticketIsOpen
  const closingRef = useRef<HTMLDivElement | null>(null)
  const closingVisible = useInView(closingRef, closingInPage)
  const hasAction = qty !== null && model.mine === null && (model.me === null || model.primary !== null)
  const showBar = !wide && !model.ticketIsOpen && hasAction

  const steps = timelineSteps(intent, exact ? 'take' : 'own', words)

  return (
    <>
      <ContractNote className={styles.note} plain glyph={copy.glyph} kind={copy.heading(asset.code)} headingLevel={2} aside={copy.contract}>
        <p className={styles.lead}>{copy.lead(asset.code, quote.code)}</p>
        <Terms
          qty={{
            label: copy.qtyLabel,
            text: model.qtyDraft.text,
            unit: asset.code,
            decimals: asset.decimals,
            onChange: model.typeQty,
            onMax: max !== null ? () => model.typeQty(inputAmount(max.qty, asset.decimals)) : undefined,
            maxLabel:
              max !== null
                ? max.byLot
                  ? MAX_LOT(units(max.qty), asset.code)
                  : info.starts === 'asset'
                    ? MAX_HOLDING(units(max.qty), asset.code)
                    : MAX_AFFORD(units(max.qty), asset.code)
                : undefined,
            aside: qtyAside,
            hint: joinHints(qtyError ? undefined : lotsLine, qtyHint),
            error: qtyError,
          }}
          strike={{
            label: copy.strikeLabel,
            figure: money(strike),
            unit: quote.code,
            hint: strikeHint,
            chipsLabel: STRIKE_CHIPS_LABEL[intent],
            chips: strikeChips,
            value: strike.toString(),
            onChange: (value) => {
              setNotice(null)
              pin({ strike: BigInt(value) })
            },
          }}
          expiry={{
            label: UNTIL_LABEL,
            day: formatUtcDay(expiry),
            time: formatUtcTime(expiry),
            iso: isoUtc(expiry),
            hint: `${TIME_LEFT(formatCountdown(expiry - nowSec))}. ${YOUR_TIME(formatLocal(expiry))}.`,
            chipsLabel: EXPIRY_CHIPS_LABEL,
            chips: expiryChips,
            value: expiry.toString(),
            onChange: (value) => {
              setNotice(null)
              pin({ expiry: Number(value) })
            },
          }}
          fundedKey={anyMarked ? FUNDED_KEY[side] : null}
          notice={notice}
        />
        {near ? (
          <Callout variant="warning" title={near.title} className={styles.near}>
            {near.body}
          </Callout>
        ) : null}
        <Available model={model} headingRef={availableHeading} onUse={useTerms} />
      </ContractNote>

      <section className={styles.section} aria-labelledby="guided-outcome">
        <h2 id="guided-outcome" className={styles.heading}>
          {OUTCOME_HEADING}
        </h2>
        {outcome ? (
          <>
            {premiumNote ? <p className={styles.premiumNote}>{premiumNote}</p> : null}
            <OutcomeCardsBlock view={outcome} />
          </>
        ) : (
          <EmptyNote title={qty === null ? NEED_QTY : NEED_PREMIUM} headingLevel={3} />
        )}
      </section>

      {closingInPage ? (
        <div ref={closingRef}>
          <ClosingBlock model={model} placement="page" />
        </div>
      ) : null}

      {outcome ? (
        <section className={styles.section} aria-labelledby="guided-detail">
          <h2 id="guided-detail" className={styles.heading}>
            {DETAIL_HEADING}
          </h2>
          <OutcomeDetail view={outcome} kind={kind} side={side} />
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="guided-when">
        <h2 id="guided-when" className={styles.heading}>
          {WHEN_HEADING}
        </h2>
        {qty === null ? (
          <p className={styles.whenNeed}>{WHEN_NEED_QTY}</p>
        ) : (
          <Timeline
            label={WHEN_HEADING}
            items={[
              { time: WHEN.now, title: steps.now.title, description: steps.now.body },
              { time: WHEN.until, title: steps.until.title, description: withExercise(steps.until.body) },
              { time: WHEN.at(formatUtcDay(expiry), formatUtcTime(expiry)), title: steps.at.title, description: steps.at.body },
              { time: WHEN.after, title: steps.after.title, description: steps.after.body },
            ]}
          />
        )}
      </section>

      {showBar ? <ActionBar model={model} hidden={closingInPage && closingVisible} /> : null}
    </>
  )
}

/** The step's first "exercise" as the glossary term: one press for its sentence, where the word is met. */
function withExercise(text: string): ReactNode {
  const found = /\bexercise\b/.exec(text)
  if (!found) return text
  return (
    <>
      {text.slice(0, found.index)}
      <Term definition={definitionOf('exercise')}>{found[0]}</Term>
      {text.slice(found.index + found[0].length)}
    </>
  )
}

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })
const formatLots = (lots: string[]) => listFormat.format(lots)

const joinHints = (...hints: ReadonlyArray<string | undefined>): string | undefined => {
  const present = hints.filter((h): h is string => h !== undefined && h !== '')
  return present.length > 0 ? present.join(' ') : undefined
}

/** True while the element is at least partly in the viewport. */
function useInView(ref: { current: Element | null }, enabled: boolean): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') {
      setVisible(false)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, enabled])
  return visible
}
