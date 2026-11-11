import type { ReactNode } from 'react'
import { Glyph } from './glyphs/Glyph'
import type { PayoffGlyph } from './glyphs/Glyph'
import { cx } from './internal/cx'
import { KeyValue, KeyValueItem } from './KeyValue'
import { Tag } from './Tag'
import type { TagAppearance } from './Tag'
import styles from './ContractNote.module.css'

export interface NoteTerm {
  label: ReactNode
  value: ReactNode
  /** The user's own key term (their strike, their breakeven): goes under the highlighter. One or two per note. */
  marked?: boolean
  /** A caption under the value (local time under the deadline, a disclosure next to the premium). */
  hint?: ReactNode
}

export interface ContractNoteProps {
  /** The option, offer or bid id as printed: "000184". */
  serial?: string
  /** The ledger the terms were read at, as printed: "58,331,204". */
  ledger?: string
  /** What the number is: "No." (default), "Offer No.", "Bid No.". */
  serialLabel?: string
  /** The payoff shape. Always shown with `kind`, never alone. */
  glyph?: PayoffGlyph
  /** Position and asset in words: "Long put, BOND". */
  kind: ReactNode
  headingLevel?: 2 | 3 | 4
  /** The contract's state name, shown as the tag. */
  state?: string
  stateAppearance?: TagAppearance
  /** Right of the heading: a countdown, a per-unit price. */
  aside?: ReactNode
  /** The ruled list of terms. */
  terms?: ReadonlyArray<NoteTerm>
  /** Anything between the terms and the footer: a payoff figure, a disclosure. */
  children?: ReactNode
  /** The foot of the slip: explorer link, calendar file, actions. */
  footer?: ReactNode
  /** Plays the "printing" entrance once: the slip rises 6 px and settles, the serial line fades in. For a receipt. */
  printing?: boolean
  className?: string
}

/**
 * The signature object: an option as a typeset slip. Perforated left edge, a mono serial line, the payoff glyph
 * and the kind in serif, the terms as a ruled list with the user's key term under the highlighter.
 * Used for offers, positions, bids and receipts.
 */
export function ContractNote({
  serial,
  ledger,
  serialLabel = 'No.',
  glyph,
  kind,
  headingLevel = 3,
  state,
  stateAppearance,
  aside,
  terms,
  children,
  footer,
  printing = false,
  className,
}: ContractNoteProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const hasSerial = serial !== undefined || ledger !== undefined
  return (
    <article className={cx(styles.root, className)} data-printing={printing || undefined}>
      {hasSerial || state ? (
        <div className={styles.running}>
          {hasSerial ? (
            <p className={styles.serial}>
              <span aria-hidden="true">
                {serial !== undefined ? `${serialLabel} ${serial}` : null}
                {serial !== undefined && ledger !== undefined ? ' · ' : null}
                {ledger !== undefined ? `L ${ledger}` : null}
              </span>
              <span className="ui-vh">
                {serial !== undefined ? `${serialLabel} ${serial}` : ''}
                {serial !== undefined && ledger !== undefined ? ', ' : ''}
                {ledger !== undefined ? `read at ledger ${ledger}` : ''}
              </span>
            </p>
          ) : (
            <span />
          )}
          {state ? <Tag state={state} appearance={stateAppearance} /> : null}
        </div>
      ) : null}
      <header className={styles.header}>
        <Heading className={styles.kind}>
          {glyph ? <Glyph name={glyph} size={12} className={styles.glyph} /> : null}
          <span>{kind}</span>
        </Heading>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </header>
      {terms && terms.length > 0 ? (
        <KeyValue className={styles.terms}>
          {terms.map((term, i) => (
            <KeyValueItem key={i} label={term.label} marked={term.marked} hint={term.hint}>
              {term.value}
            </KeyValueItem>
          ))}
        </KeyValue>
      ) : null}
      {children}
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </article>
  )
}

export interface EmptyNoteProps {
  /** One serif sentence: "No positions." */
  title: ReactNode
  /** One line saying when something will appear here. */
  hint?: ReactNode
  /** At most one action. */
  action?: ReactNode
  headingLevel?: 2 | 3 | 4
  className?: string
}

/** The empty state: a blank, dashed slip with one sentence and at most one action. */
export function EmptyNote({ title, hint, action, headingLevel = 3, className }: EmptyNoteProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  return (
    <div className={cx(styles.root, styles.empty, className)}>
      <div className={styles.running}>
        <p className={styles.serial} aria-hidden="true">
          No. ------
        </p>
      </div>
      <div className={styles.emptyBody}>
        <Heading className={styles.emptyTitle}>{title}</Heading>
        {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
        {action ? <div className={styles.emptyAction}>{action}</div> : null}
      </div>
    </div>
  )
}
