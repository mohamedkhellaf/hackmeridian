// The closing block of the guided flow (E10): the deal in one sentence, the action, and the way to post terms of
// one's own. From 1200 px the asset page renders it as the order rail's idle content; below that the guided
// page renders it under the outcome cards, with a sticky action bar for when it is scrolled out of view.
import { Link as RouterLink, useLocation } from '@tanstack/react-router'
import { useEffect, useLayoutEffect } from 'react'
import { formatExact, formatUnits, serialOf } from '../../../core/format'
import { Amount, Button, Link } from '../../../ui'
import { useWallet } from '../../../wallet'
import { ACTION, ACTION_REGION, BAR_FIGURE, CANNOT_PAY, GET_FUNDS, NEED_QTY_ACTION, OWN_SHORT, VIEW } from './copy'
import type { GuidedModel, OwnItem } from './useGuidedModel'
import { useGuidedModel } from './useGuidedModel'
import { registerRailClosing } from './railClosing'
import styles from './Closing.module.css'

export interface GuidedClosingProps {
  /** The underlying contract id of the asset page. */
  assetId: string
  /** `rail`: the order rail's idle content (the default, for the asset page). `page`: under the outcome cards. */
  placement?: 'rail' | 'page'
}

/**
 * Reads the guided terms from the URL and the data hooks itself, so it can live outside the guided form.
 */
export function GuidedClosing({ assetId, placement = 'rail' }: GuidedClosingProps) {
  const state = useGuidedModel(assetId)
  const rail = placement === 'rail'
  useLayoutEffect(() => (rail ? registerRailClosing() : undefined), [rail])
  if (state.status !== 'ready') return null
  return <ClosingBlock model={state.model} placement={placement} />
}

/** The same block from a model already read (the guided page renders it with its own model). */
export function ClosingBlock({ model, placement }: { model: GuidedModel; placement: 'rail' | 'page' }) {
  const wallet = useWallet()
  const location = useLocation()
  const { me, mine, primary, primaryLabel, ownTerms, side, summary, shortfall, quote } = model
  const money = (units: bigint) => formatUnits(units, quote.decimals)
  // The funds strip links back here, so the order is one press away once the wallet is funded.
  const from = `${location.pathname}${location.searchStr}`
  return (
    <section className={styles.root} data-placement={placement} aria-label={ACTION_REGION} data-testid="guided-closing">
      {/* What the wallet already has here comes first, with the way to it; the sentence and the action under it
          are then about another order, and say so. A second order is never the block's primary action. */}
      {me !== null && mine ? (
        <p className={styles.own} data-testid="guided-closing-own">
          {OWN_SHORT[mine.kind](serialOf(mine.id))} <OwnLink item={mine} />
        </p>
      ) : null}
      {summary ? (
        <p className={styles.summary} data-testid="guided-summary">
          {summary}
        </p>
      ) : null}
      {shortfall ? (
        <p className={styles.short}>
          {CANNOT_PAY(money(shortfall.have), money(shortfall.need), quote.code)}{' '}
          <Link render={<RouterLink to="/markets" search={{ funds: '1', from }} />}>{GET_FUNDS}</Link>
        </p>
      ) : null}
      <div className={styles.buttons}>
        {me === null ? (
          <Button variant="primary" onClick={() => void wallet.connect()}>
            {ACTION.connect}
          </Button>
        ) : (
          <Button variant={mine ? 'secondary' : 'primary'} disabled={primary === null} disabledReason={NEED_QTY_ACTION} onClick={() => primary && model.open(primary.ticket, primary.step)}>
            {primaryLabel}
          </Button>
        )}
        {me !== null && ownTerms ? (
          <Button variant="quiet" onClick={() => model.open(ownTerms, 'terms')}>
            {side === 'buy' ? ACTION.ownPriceRequest : ACTION.ownPriceOffer}
          </Button>
        ) : null}
      </div>
    </section>
  )
}

/** Where the wallet's own position, offer or request at these terms can be seen (and cancelled): a quiet link. */
export function OwnLink({ item }: { item: OwnItem }) {
  if (item.kind === 'request') return <Link render={<RouterLink to="/requests" />}>{VIEW.request}</Link>
  return <Link render={<RouterLink to="/portfolio/$id" params={{ id: item.id.toString() }} />}>{item.kind === 'offer' ? VIEW.offer : VIEW.position}</Link>
}

/**
 * While the bar is on screen, toasts and keyboard focus must clear it (WCAG 2.4.11): its height is published on
 * the root as --page-bar-h, from which the shell derives the scroll padding and the toast offset, and taken back
 * when it goes.
 */
function usePublishedBar(): void {
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--page-bar-h', 'var(--s-56)')
    return () => {
      root.removeProperty('--page-bar-h')
    }
  }, [])
}

/**
 * The sticky action bar below 1200 px (E10): the figure and the action in one 56 px line, at the bottom edge
 * from 768 px and above the tab bar on phones. It is in the flow at the end of the guided page, so the page
 * never hides content under it; `hidden` keeps its room while the closing block itself is in view.
 */
export function ActionBar({ model, hidden }: { model: GuidedModel; hidden: boolean }) {
  const wallet = useWallet()
  usePublishedBar()
  const { me, primary, primaryLabel, exact, side, premium, quote } = model
  const figureLabel = exact ? (side === 'buy' ? BAR_FIGURE.pay : BAR_FIGURE.paid) : side === 'buy' ? BAR_FIGURE.escrow : BAR_FIGURE.ask
  return (
    <div className={styles.bar} data-hidden={hidden || undefined} data-testid="guided-action-bar">
      <p className={styles.barFigure}>
        {premium !== null ? (
          <>
            <span className={styles.barLabel}>{figureLabel}</span> <Amount value={formatUnits(premium, quote.decimals)} exact={formatExact(premium, quote.decimals)} unit={quote.code} figure="serif" />
          </>
        ) : null}
      </p>
      {me === null ? (
        <Button variant="primary" size="sm" onClick={() => void wallet.connect()}>
          {ACTION.connect}
        </Button>
      ) : (
        <Button variant="primary" size="sm" disabled={primary === null} disabledReason={NEED_QTY_ACTION} onClick={() => primary && model.open(primary.ticket, primary.step)}>
          {primaryLabel}
        </Button>
      )}
    </div>
  )
}
