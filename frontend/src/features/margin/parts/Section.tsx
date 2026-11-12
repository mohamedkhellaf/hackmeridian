import { useId } from 'react'
import type { ReactNode } from 'react'
import css from './Section.module.css'

export interface SectionProps {
  title: string
  /** Right of the heading: a count, an explanation trigger. */
  aside?: ReactNode
  /** One line under the heading. */
  note?: ReactNode
  children: ReactNode
  id?: string
}

/** A titled block of a Margin screen: a serif heading on a rule, then a table or a figure. Not a card. */
export function Section({ title, aside, note, children, id }: SectionProps) {
  const headingId = useId()
  return (
    <section className={css.root} aria-labelledby={headingId} id={id}>
      <header className={css.header}>
        <h2 className={css.title} id={headingId}>
          {title}
        </h2>
        {aside ? <div className={css.aside}>{aside}</div> : null}
      </header>
      {note ? <p className={css.note}>{note}</p> : null}
      {children}
    </section>
  )
}

/** A caption under a table or a figure. */
export function Footnote({ children }: { children: ReactNode }) {
  return <p className={css.footnote}>{children}</p>
}
