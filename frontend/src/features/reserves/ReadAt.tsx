import { Button, IconRefresh } from '../../ui'
import { MOCK_READ, REFRESH } from './copy'
import { ledgerText, readTimeIso, readTimeText } from './model'
import css from './ReadAt.module.css'

export interface ReadAtProps {
  /** When the figures were read, in milliseconds since the epoch. Null before the first read. */
  readAt: number | null
  /** The ledger of that read. Null on mock data. */
  ledger: number | null
  /** The figures come from the in-page mock market, not from a contract. */
  isMock: boolean
  refreshing: boolean
  onRefresh: () => void
}

/**
 * Where the figures come from and when: `Read at ledger 58,331,204, 14:02:11 UTC`, or `Mock data, 14:02:11 UTC`
 * in a build without a contract. Then the button that reads again.
 */
export function ReadAt({ readAt, ledger, isMock, refreshing, onRefresh }: ReadAtProps) {
  return (
    <div className={css.root}>
      {readAt !== null ? (
        <p className={css.line} data-testid="read-at">
          {isMock ? (
            `${MOCK_READ}, `
          ) : ledger !== null ? (
            <>
              Read at ledger <span className={css.figure}>{ledgerText(ledger)}</span>,{' '}
            </>
          ) : (
            'Read at '
          )}
          <time className={css.figure} dateTime={readTimeIso(readAt)}>
            {readTimeText(readAt)}
          </time>
        </p>
      ) : null}
      <Button size="sm" variant="secondary" iconStart={<IconRefresh />} loading={refreshing} onClick={onRefresh}>
        {REFRESH}
      </Button>
    </div>
  )
}
