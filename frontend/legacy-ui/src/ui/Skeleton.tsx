import type { ReactNode } from 'react'
import { Button } from './Button'
import { Banner, PageHeader } from './Surfaces'
import './skeleton.css'

/** Placeholder table with the same row heights and columns as a real `.ui-table`; shown until the first load finishes. */
export function TableSkeleton({ columns = 6, rows = 5, className }: { columns?: number; rows?: number; className?: string }) {
  return (
    <div className={['ui-table-wrap', 'ui-skel-wrap', className].filter(Boolean).join(' ')} aria-hidden="true">
      <table className="ui-table">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, c) => (
              <th key={c}>
                <span className="ui-skel" style={{ width: c === 0 ? 48 : 64 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  <span className="ui-skel" style={{ width: c === 0 ? 56 : 40 + ((r * 7 + c * 13) % 5) * 10 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * First-load stand-in for a view: the page title, no counts, and skeleton content in place of the real one.
 * If the first load failed it shows one error line with Retry instead.
 */
export function ViewSkeleton({
  title,
  error,
  onRetry,
  children,
}: {
  title: string
  error?: string | null
  onRetry?: () => void
  children?: ReactNode
}) {
  return (
    <div className="ui-view-skel" role="status" aria-busy={error ? undefined : 'true'} aria-label={error ? undefined : `Loading ${title}`}>
      <PageHeader title={title} />
      {error ? (
        <Banner tone="danger">
          <span className="ui-skel-err">
            Could not load data: {error}
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            )}
          </span>
        </Banner>
      ) : (
        (children ?? <TableSkeleton />)
      )}
    </div>
  )
}
