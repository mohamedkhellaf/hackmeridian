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
  /** The option, offer or request id as printed: "000184". */
  serial?: string
  /**
   * A ledger number printed beside the serial ("L 58,331,204"), read out as "latest ledger": the ledger of the
   * read when the caller has it, otherwise the latest ledger the app knows.
   */
  ledger?: string
  /** What the number is: "No." (default), "Offer No.", "Request No.". */
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
  /**
   * A card that is a form or an example, not a contract object: no perforated edge and no serial line (`serial`
   * and `ledger` are ignored; the state tag, if any, sits right of the heading).
   */
  plain?: boolean
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
  plain = false,
  className,
}: ContractNoteProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const hasSerial = !plain && (serial !== undefined || ledger !== undefined)
  const tag = state ? <Tag state={state} appearance={stateAppearance} /> : null
  return (
    <article className={cx(styles.root, className)} data-printing={printing || undefined} data-plain={plain || undefined}>
      {!plain && (hasSerial || state) ? (
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
                {ledger !== undefined ? `latest ledger ${ledger}` : ''}
              </span>
            </p>
          ) : (
            <span />
          )}
          {tag}
        </div>
      ) : null}
      <header className={styles.header}>
        <Heading className={styles.kind}>
          {glyph ? <Glyph name={glyph} size={12} className={styles.glyph} /> : null}
          <span>{kind}</span>
        </Heading>
        {aside || (plain && tag) ? (
          <div className={styles.aside}>
            {aside}
            {plain ? tag : null}
          </div>
        ) : null}
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
  /** At most one short line saying when something will appear here. */
  hint?: ReactNode
  /** At most one action. */
  action?: ReactNode
  /** Deprecated: still rendered under the sentence until the last caller stops passing it. Add nothing new here. */
  children?: ReactNode
  /** `sm` for a desk screen that stacks several empty tables: less room, a smaller sentence. */
  size?: 'md' | 'sm'
  /**
   * The blank contract note: a solid hairline frame, the perforated edge and the "No. ------" serial line. Only
   * where the missing thing is itself a contract note (the Portfolio with no positions or no wallet, a position
   * number that does not exist). Never in a dialog, for a wrong address, for an empty table or in the ticket rail.
   */
  slip?: boolean
  headingLevel?: 2 | 3 | 4
  className?: string
}

/**
 * The empty state. Plain by default: one serif sentence, at most one short line and one action, no frame.
 * With `slip`, the same words on a blank contract note.
 */
export function EmptyNote({ title, hint, action, children, size = 'md', slip = false, headingLevel = 3, className }: EmptyNoteProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  return (
    <div
      className={cx(slip ? styles.root : undefined, slip ? styles.slip : styles.plainEmpty, className)}
      data-size={size === 'sm' ? 'sm' : undefined}
    >
      {slip && size !== 'sm' ? (
        <div className={styles.running}>
          <p className={styles.serial} aria-hidden="true">
            No. ------
          </p>
        </div>
      ) : null}
      <div className={styles.emptyBody}>
        <Heading className={styles.emptyTitle}>{title}</Heading>
        {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
        {children ? <div className={styles.emptyLines}>{children}</div> : null}
        {action ? <div className={styles.emptyAction}>{action}</div> : null}
      </div>
    </div>
  )
}
