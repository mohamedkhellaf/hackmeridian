import type { ReactNode, Ref } from 'react'
import { cx } from './internal/cx'
import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  /** A plain noun: "Markets", "Reserves". */
  title: ReactNode
  /** One line saying what this page is. */
  description?: ReactNode
  /** Under the title: facts about the object (type label, issuer, reference price with its source). */
  meta?: ReactNode
  /** Right side: at most one row of actions or a mode switch. */
  actions?: ReactNode
  /** Above the title: a link back to the parent page. */
  back?: ReactNode
  /** The shell moves focus here after a route change. The heading is focusable by script, not in the tab order. */
  headingRef?: Ref<HTMLHeadingElement>
  /** 1 on a page. A specimen or an embedded header takes the level of its place, so the page keeps one `h1`. */
  headingLevel?: 1 | 2 | 3 | 4
  className?: string
}

/** The head of a page: one `h1`, at most one line under it and one row of actions. No hero, no eyebrow. */
export function PageHeader({ title, description, meta, actions, back, headingRef, headingLevel = 1, className }: PageHeaderProps) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4'
  return (
    <header className={cx(styles.root, className)}>
      {back ? <div className={styles.back}>{back}</div> : null}
      <div className={styles.row}>
        <div className={styles.main}>
          <Heading className={styles.title} ref={headingRef} tabIndex={-1}>
            {title}
          </Heading>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </header>
  )
}

export interface SkipLinkProps {
  /** The id of the main landmark, with the hash: "#main". */
  href?: string
  children?: ReactNode
}

/** The first focusable element of the page. Hidden until focused. */
export function SkipLink({ href = '#main', children = 'Skip to content' }: SkipLinkProps) {
  return (
    <a className={styles.skip} href={href}>
      {children}
    </a>
  )
}
