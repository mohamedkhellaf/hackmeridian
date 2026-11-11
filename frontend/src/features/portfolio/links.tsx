// Internal links of the feature: the ui kit's Link and ButtonLink around the router's Link, so every link to a
// position or to Markets is written once and preloads its page on hover or focus.
import { Link as RouterLink } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { PositionSearch } from '../../app/search'
import { ButtonLink, Link } from '../../ui'
import type { ButtonLinkProps, LinkProps } from '../../ui'

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

export function PortfolioLink({ children, ...rest }: Omit<LinkProps, 'render' | 'href'>) {
  return (
    <Link {...rest} render={<RouterLink to="/portfolio" />}>
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
