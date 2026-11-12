import type { ReactNode } from 'react'
import css from './Section.module.css'

export interface SectionProps {
  /** The anchor of the section, also the base of its heading id. */
  id: string
  heading: string
  /** One or two sentences under the heading. */
  lead?: ReactNode
  /**
   * `split`: the heading stays in the left margin while the content runs beside it, as in a prospectus.
   * `stack`: the heading sits on top and the content takes the full width (figures, wide ledgers).
   */
  layout?: 'split' | 'stack'
  children: ReactNode
}

/** One section of the landing: a ruled top edge, a serif heading, the content. */
export function Section({ id, heading, lead, layout = 'split', children }: SectionProps) {
  const headingId = `${id}-heading`
  return (
    <section id={id} className={css.section} data-layout={layout} aria-labelledby={headingId}>
      <div className={css.inner}>
        <header className={css.head}>
          <h2 id={headingId} className={css.heading}>
            {heading}
          </h2>
          {lead ? <p className={css.lead}>{lead}</p> : null}
        </header>
        <div className={css.body}>{children}</div>
      </div>
    </section>
  )
}
