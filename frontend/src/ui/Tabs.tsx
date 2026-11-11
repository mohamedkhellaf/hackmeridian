import { mergeProps } from '@base-ui/react/merge-props'
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { useRender } from '@base-ui/react/use-render'
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react'
import { Badge } from './Badge'
import { cx } from './internal/cx'
import styles from './Tabs.module.css'

export interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

/**
 * Tabs swap panels inside one page (Holding, Written, Orders). Arrow keys move between tabs, Enter or Space
 * activates, the panel follows in the tab order. For links between pages use `NavTabs`.
 */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <BaseTabs.Root className={cx(styles.root, className)} value={value} onValueChange={(next) => onValueChange(String(next))}>
      {children}
    </BaseTabs.Root>
  )
}

export interface TabListProps {
  /** Names the set of tabs ("Positions"). */
  label: string
  children: ReactNode
  className?: string
}

export function TabList({ label, children, className }: TabListProps) {
  return (
    <BaseTabs.List className={cx(styles.list, className)} aria-label={label} activateOnFocus={false}>
      {children}
      <BaseTabs.Indicator className={styles.indicator} />
    </BaseTabs.List>
  )
}

export interface TabProps {
  value: string
  children: ReactNode
  /** A count after the label, with its meaning for screen readers ("3 open"). */
  count?: number
  countLabel?: string
  disabled?: boolean
}

export function Tab({ value, children, count, countLabel, disabled }: TabProps) {
  return (
    <BaseTabs.Tab className={styles.tab} value={value} disabled={disabled}>
      <span>{children}</span>
      {count !== undefined ? <Badge count={count} label={countLabel} tone="quiet" /> : null}
    </BaseTabs.Tab>
  )
}

export interface TabPanelProps {
  value: string
  children: ReactNode
  /** Keeps the panel in the DOM while hidden, to preserve form state. */
  keepMounted?: boolean
  className?: string
}

export function TabPanel({ value, children, keepMounted = false, className }: TabPanelProps) {
  return (
    <BaseTabs.Panel className={cx(styles.panel, className)} value={value} keepMounted={keepMounted}>
      {children}
    </BaseTabs.Panel>
  )
}

export interface NavTabsProps {
  /** Names the navigation ("Margin sections"). */
  label: string
  children: ReactNode
  className?: string
}

/** Links between pages or sub-pages, styled like tabs. They are links: Tab moves through them, Enter follows. */
export function NavTabs({ label, children, className }: NavTabsProps) {
  return (
    <nav className={cx(styles.root, className)} aria-label={label}>
      <ul className={styles.list} role="list">
        {children}
      </ul>
    </nav>
  )
}

export interface NavTabProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  /** The page being shown. Sets `aria-current="page"`. */
  current?: boolean
  count?: number
  countLabel?: string
  /** Replace the anchor with a router link: `render={<RouterLink to="/margin/vault" />}`. */
  render?: ReactElement<Record<string, unknown>>
}

export function NavTab({ current = false, count, countLabel, render, children, ...rest }: NavTabProps) {
  const link = useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        className: styles.tab,
        'aria-current': current ? 'page' : undefined,
        children: (
          <>
            <span>{children}</span>
            {count !== undefined ? <Badge count={count} label={countLabel} tone="quiet" /> : null}
          </>
        ),
      },
      { 'data-active': current ? '' : undefined } as Record<string, unknown>,
      rest,
    ),
  })
  return <li className={styles.navItem}>{link}</li>
}
