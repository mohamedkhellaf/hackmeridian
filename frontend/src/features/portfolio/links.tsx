// Internal links of the feature: the ui kit's Link and ButtonLink around the router's Link, so every link to a
// position or to Markets is written once and preloads its page on hover or focus.
import { Link as RouterLink, useCanGoBack, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { AssetSearch, PositionSearch } from '../../app/search'
import { assetParam } from '../../core/assets'
import type { TokenInfo } from '../../core/options/types'
import { ButtonLink, IconChevronLeft, Link } from '../../ui'
import type { ButtonLinkProps, LinkProps } from '../../ui'
import { cameFromList } from './listReturn'
import css from './links.module.css'

type Do = PositionSearch['do']

const searchOf = (action: Do | undefined): PositionSearch => (action ? { do: action } : {})

export interface PositionLinkProps extends Omit<LinkProps, 'render' | 'href' | 'id'> {
  /** The option id. */
  id: bigint
  /** Opens this action on the position page. */
  action?: Do
  children: ReactNode
}

/** A text link to `/portfolio/$id`. */
export function PositionLink({ id, action, children, ...rest }: PositionLinkProps) {
  return (
    <Link {...rest} render={<RouterLink to="/portfolio/$id" params={{ id: id.toString() }} search={searchOf(action)} />}>
      {children}
    </Link>
  )
}

export interface PositionButtonLinkProps extends Omit<ButtonLinkProps, 'render' | 'href' | 'id'> {
  id: bigint
  action?: Do
  children: ReactNode
}

/** The same link in the shape of a button. */
export function PositionButtonLink({ id, action, children, ...rest }: PositionButtonLinkProps) {
  return (
    <ButtonLink {...rest} render={<RouterLink to="/portfolio/$id" params={{ id: id.toString() }} search={searchOf(action)} />}>
      {children}
    </ButtonLink>
  )
}

export function MarketsButtonLink({ children, ...rest }: Omit<ButtonLinkProps, 'render' | 'href'>) {
  return (
    <ButtonLink {...rest} render={<RouterLink to="/markets" />}>
      {children}
    </ButtonLink>
  )
}

/** The Holding tab of the list, keeping the "Show closed" switch as it is. */
export function HoldingTabLink({ children, ...rest }: Omit<LinkProps, 'render' | 'href'>) {
  return (
    <Link {...rest} render={<RouterLink to="/portfolio" search={(prev: { closed?: '1' }) => ({ tab: 'holding' as const, closed: prev.closed })} replace />}>
      {children}
    </Link>
  )
}

export function RequestsLink({ children, ...rest }: Omit<LinkProps, 'render' | 'href'>) {
  return (
    <Link {...rest} render={<RouterLink to="/requests" search={{ mine: '1' }} />}>
      {children}
    </Link>
  )
}

export function ActivityLink({ children, ...rest }: Omit<LinkProps, 'render' | 'href'>) {
  return (
    <Link {...rest} render={<RouterLink to="/activity" />}>
      {children}
    </Link>
  )
}

export function ReservesLink({ children, ...rest }: Omit<LinkProps, 'render' | 'href'>) {
  return (
    <Link {...rest} render={<RouterLink to="/reserves" />}>
      {children}
    </Link>
  )
}

export interface MarketsLinkProps extends Omit<LinkProps, 'render' | 'href'> {
  asset: Pick<TokenInfo, 'code' | 'contractId'>
  /** The series, offer or listing to open on the asset page. */
  search?: AssetSearch
}

/** A link to an asset page, opened on a series, an offer or a resale listing when `search` says so. */
export function MarketsLink({ asset, search, children, ...rest }: MarketsLinkProps) {
  return (
    <Link {...rest} render={<RouterLink to="/markets/$asset" params={{ asset: assetParam(asset) }} search={search ?? {}} />}>
      {children}
    </Link>
  )
}

// ------------------------------------------------------------------------------------------- back to the list

/**
 * "Portfolio" above a position. Opened from the list it goes back in history, which restores the list's tab,
 * switch and scroll; from a deep link it is a plain link to the list.
 */
export function BackToPortfolio({ label }: { label: string }) {
  const router = useRouter()
  // The history index of the list, when this page was opened from it: actions on the page push entries of their
  // own (?do=...), so going back means going back to that index, not one step.
  const [listIndex] = useState(() => (cameFromList() ? router.history.location.state.__TSR_index - 1 : null))
  const canGoBack = useCanGoBack()
  return (
    <Link
      tone="quiet"
      className={css.back}
      render={<RouterLink to="/portfolio" />}
      onClick={(event) => {
        if (listIndex === null || !canGoBack || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        const steps = router.history.location.state.__TSR_index - listIndex
        if (steps < 1) return
        event.preventDefault()
        router.history.go(-steps)
      }}
    >
      <IconChevronLeft size={14} />
      {label}
    </Link>
  )
}
