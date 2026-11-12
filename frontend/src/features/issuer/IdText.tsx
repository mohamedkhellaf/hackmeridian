import styles from './IdText.module.css'

/** A shortened account or contract id as it appears inside a sentence: `GAE6…ARFS`. */
const SHORT_ID = /([GC][A-Z2-7]{3}…[A-Z2-7]{4})/

/**
 * A sentence that names an account by its shortened id ("Freeze GAE6…ARFS for BOND"). The id never breaks
 * across two lines: a line that ends in "GAE6…" reads as a different account.
 */
export function IdText({ text }: { text: string }) {
  const parts = text.split(SHORT_ID)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={styles.id}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}
