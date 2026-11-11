import { IconDeclined, IconExpired, IconFailed, IconSuccess, IconUnknown, Spinner } from '../../ui'
import type { ActivityRow } from './model'
import css from './StateWord.module.css'

/** The state of a transaction as a glyph and its word. The word carries the meaning; the ink only agrees. */
export function StateWord({ row }: { row: Pick<ActivityRow, 'phase' | 'state' | 'tone'> }) {
  return (
    <span className={css.root} data-tone={row.tone} data-testid="tx-state">
      <span className={css.glyph}>
        {row.tone === 'working' ? (
          <Spinner />
        ) : row.tone === 'confirmed' ? (
          <IconSuccess />
        ) : row.tone === 'failed' ? (
          <IconFailed />
        ) : row.tone === 'unknown' ? (
          <IconUnknown />
        ) : row.phase === 'expired' ? (
          <IconExpired />
        ) : (
          <IconDeclined />
        )}
      </span>
      <span>{row.state}</span>
    </span>
  )
}
