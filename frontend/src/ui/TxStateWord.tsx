import { IconDeclined, IconExpired, IconFailed, IconSuccess, IconUnknown } from './icons'
import { cx } from './internal/cx'
import { Spinner } from './Spinner'
import { TX_STATE_LABEL, TX_STATE_TONE } from './txStates'
import type { TxState } from './txStates'
import styles from './TxStateWord.module.css'

export interface TxStateWordProps {
  /** The state; it picks the glyph, the ink and, unless `word` is given, the word. */
  state: TxState
  /** Replaces the state's own word ("Confirmed") with a more specific one ("Delivery claimed"). */
  word?: string
  className?: string
}

/**
 * The state of a transaction as a glyph and its word, the same in every list (Activity, the issuer's recent
 * actions). The word carries the meaning; the glyph and the ink only agree with it.
 */
export function TxStateWord({ state, word, className }: TxStateWordProps) {
  const tone = TX_STATE_TONE[state]
  return (
    <span className={cx(styles.root, className)} data-tone={tone} data-testid="tx-state">
      <span className={styles.glyph}>
        {tone === 'working' ? (
          <Spinner />
        ) : tone === 'confirmed' ? (
          <IconSuccess />
        ) : tone === 'failed' ? (
          <IconFailed />
        ) : tone === 'unknown' ? (
          <IconUnknown />
        ) : state === 'expired' ? (
          <IconExpired />
        ) : (
          <IconDeclined />
        )}
      </span>
      <span>{word ?? TX_STATE_LABEL[state]}</span>
    </span>
  )
}
