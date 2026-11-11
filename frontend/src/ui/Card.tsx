import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Card.module.css'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** A heading for the sheet. */
  title?: ReactNode
  headingLevel?: 2 | 3 | 4
  /** Right side of the header: one action, a tag, a read-at line. */
  actions?: ReactNode
  /** `surface` is a sheet on the page. `sunken` is a well (a fenced block). `plain` has a rule and no fill. */
  tone?: 'surface' | 'sunken' | 'plain'
  padding?: 'none' | 'sm' | 'md'
  as?: 'section' | 'div' | 'article' | 'aside'
}

/**
 * A sheet for one discrete object: a review, a form, a fact block. No shadow in the page: the tone step and a
 * hairline do the separating. Lists of things are tables, not grids of cards; do not nest cards.
 */
export function Card({
  title,
  headingLevel = 3,
  actions,
  tone = 'surface',
  padding = 'md',
  as: Element = 'section',
  className,
  children,
  ...rest
}: CardProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  return (
    <Element {...rest} className={cx(styles.root, className)} data-tone={tone} data-padding={padding}>
      {title || actions ? (
        <header className={styles.header}>
          {title ? <Heading className={styles.title}>{title}</Heading> : <span />}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </Element>
  )
}
