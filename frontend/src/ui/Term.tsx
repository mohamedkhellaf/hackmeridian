import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import { Popover } from './Popover'
import styles from './Term.module.css'

export interface TermProps {
  /** The word as it stands in the label or the sentence: "Premium", "Breakeven". */
  children: ReactNode
  /** One sentence from the glossary (the same text Learn shows), never a new explanation. */
  definition: ReactNode
  className?: string
}

/**
 * A term of the trade explained where it is met: the word itself is the button (a dotted underline, no icon, one
 * tab stop) and a press opens its one glossary sentence. It replaces a caption that defined its label.
 */
export function Term({ children, definition, className }: TermProps) {
  return (
    <Popover
      side="bottom"
      align="start"
      trigger={
        <button type="button" className={cx(styles.root, className)}>
          {children}
        </button>
      }
    >
      <p className={styles.definition}>{definition}</p>
    </Popover>
  )
}
