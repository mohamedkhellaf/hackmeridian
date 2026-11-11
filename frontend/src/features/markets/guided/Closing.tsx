// The closing block of the guided flow (E10): the deal in one sentence, the action, and the way to post terms of
// one's own. From 1200 px the asset page renders it as the order rail's idle content; below that the guided
// page renders it under the outcome cards, with a sticky action bar for when it is scrolled out of view.
import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useLayoutEffect } from 'react'
import { formatUnits } from '../../../core/format'
import { Button, ButtonLink, Link } from '../../../ui'
import { useWallet } from '../../../wallet'
import { ACTION, ACTION_REGION, BAR_FIGURE, CANNOT_PAY, GET_FUNDS, NEED_QTY_ACTION, VIEW } from './copy'
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
  const { me, mine, primary, primaryLabel, ownTerms, side, summary, shortfall, quote } = model
  const money = (units: bigint) => formatUnits(units, quote.decimals)
  const orderButton = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} disabled={primary === null} disabledReason={NEED_QTY_ACTION} onClick={() => primary && model.open(primary.ticket, primary.step)}>
      {primaryLabel}
    </Button>
  )
  return (
    <section className={styles.root} data-placement={placement} aria-label={ACTION_REGION} data-testid="guided-closing">
      {summary ? (
        <p className={styles.summary} data-testid="guided-summary">
          {summary}
        </p>
      ) : null}
      {shortfall ? (
        <p className={styles.short}>
          {CANNOT_PAY(money(shortfall.have), money(shortfall.need), quote.code)}{' '}
          <Link render={<RouterLink to="/markets" search={{ funds: '1' }} />}>{GET_FUNDS}</Link>
        </p>
      ) : null}
      <div className={styles.buttons}>
        {me === null ? (
          <Button variant="primary" onClick={() => void wallet.connect()}>
            {ACTION.connect}
          </Button>
        ) : mine ? (
          <>
            <OwnLink item={mine} />
            {orderButton('secondary')}
          </>
        ) : (
          orderButton('primary')
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

/** Where the wallet's own position, offer or request at these terms can be seen (and cancelled). */
export function OwnLink({ item, quiet = false }: { item: OwnItem; quiet?: boolean }) {
  if (item.kind === 'request') {
    const label = VIEW.request
    return quiet ? (
      <Link render={<RouterLink to="/requests" />}>{label}</Link>
    ) : (
      <ButtonLink variant="primary" render={<RouterLink to="/requests" />}>
        {label}
      </ButtonLink>
    )
  }
  const label = item.kind === 'offer' ? VIEW.offer : VIEW.position
  const to = <RouterLink to="/portfolio/$id" params={{ id: item.id.toString() }} />
  return quiet ? (
    <Link render={to}>{label}</Link>
  ) : (
    <ButtonLink variant="primary" render={to}>
      {label}
    </ButtonLink>
  )
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
            <span className={styles.barLabel}>{figureLabel}</span>{' '}
            <span className={styles.barAmount}>
              {formatUnits(premium, quote.decimals)} <span className={styles.barUnit}>{quote.code}</span>
            </span>
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
