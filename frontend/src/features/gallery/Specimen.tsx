import type { ReactNode } from 'react'
import styles from './Gallery.module.css'

export interface SectionProps {
  id: string
  title: string
  /** When to use what is shown, in a sentence or two. */
  children: ReactNode
  lead?: ReactNode
}

/** One chapter of the gallery. */
export function Section({ id, title, lead, children }: SectionProps) {
  return (
    <section className={styles.section} id={id} aria-labelledby={`${id}-title`}>
      <header className={styles.sectionHead}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          {title}
        </h2>
        {lead ? <p className={styles.sectionLead}>{lead}</p> : null}
      </header>
      {children}
    </section>
  )
}

export interface SpecimenProps {
  /** The component or token group shown. */
  title: string
  /** The rule for it. */
  note?: ReactNode
  /** How the examples are laid out. */
  layout?: 'row' | 'stack' | 'grid' | 'split'
  /** Shows the examples on a sheet instead of the page. */
  surface?: boolean
  children: ReactNode
}

/** A titled plate holding the examples of one component. */
export function Specimen({ title, note, layout = 'row', surface = false, children }: SpecimenProps) {
  return (
    <div className={styles.specimen}>
      <div className={styles.specimenHead}>
        <h3 className={styles.specimenTitle}>{title}</h3>
        {note ? <p className={styles.specimenNote}>{note}</p> : null}
      </div>
      <div className={styles.plate} data-layout={layout} data-surface={surface || undefined}>
        {children}
      </div>
    </div>
  )
}

/** A captioned example inside a plate. */
export function Example({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={styles.example} data-wide={wide || undefined}>
      <div className={styles.exampleBody}>{children}</div>
      <p className={styles.exampleLabel}>{label}</p>
    </div>
  )
}
