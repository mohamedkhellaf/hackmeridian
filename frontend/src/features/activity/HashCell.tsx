import { NO_VALUE } from '../../core/format'
import { TxLink } from '../../ui'
import { NO_HASH_SHORT, NO_HASH_YET } from './copy'
import type { ActivityRow } from './model'

/** The hash with its explorer link and a copy button; a word when there is none. */
export function HashCell({ row }: { row: Pick<ActivityRow, 'hash' | 'hashUrl' | 'tone'> }) {
  if (row.hash) return <TxLink hash={row.hash} explorerUrl={row.hashUrl ?? undefined} copy />
  if (row.tone === 'working') return <span className="ui-muted">{NO_HASH_YET}</span>
  return (
    <>
      <span aria-hidden="true">{NO_VALUE}</span>
      <span className="ui-vh">{NO_HASH_SHORT}</span>
    </>
  )
}
