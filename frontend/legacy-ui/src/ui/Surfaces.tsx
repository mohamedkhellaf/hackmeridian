import { useId } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'

/** Flat bordered box for one discrete object (a form, an order review). Optional title row with actions at right. */
export function Card({
  title,
  actions,
  flush,
  className,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode
  actions?: ReactNode
  /** Remove body padding (use when the body is a full-bleed `.ui-table`). */
  flush?: boolean
}) {
  return (
    <section className={['ui-card', flush && 'ui-card--flush', className].filter(Boolean).join(' ')} {...rest}>
      {(title || actions) && (
        <header className="ui-card-header">
          {title && <h2 className="ui-card-title">{title}</h2>}
          {actions && <div className="ui-card-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'ui-card-body ui-card-body--flush' : 'ui-card-body'}>{children}</div>
    </section>
  )
}

/** Page title: h1 left, actions right. First child of every view. */
export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ui-page-header">
      <h1>{title}</h1>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </div>
  )
}

/** A row of `Stat`s with one hairline under it. One column on phones. */
export function StatGrid({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  return <div className={`ui-stat-grid ui-stat-grid--${columns}`}>{children}</div>
}

/** Label above value. A `role="group"` named by its label, so tests and screen readers can address it. */
export function Stat({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="ui-stat" role="group" aria-labelledby={id}>
      <span className="ui-label" id={id}>
        {label}
      </span>
      <span className="ui-stat-value">{children}</span>
    </div>
  )
}

export type BannerTone = 'warn' | 'danger' | 'neutral'

/** One-line notice with a 2px left border in the tone colour. danger is role=alert, others role=note. */
export function Banner({ tone = 'neutral', children, className }: { tone?: BannerTone; children: ReactNode; className?: string }) {
  return (
    <div className={['ui-banner', `ui-banner--${tone}`, className].filter(Boolean).join(' ')} role={tone === 'danger' ? 'alert' : 'note'}>
      {children}
    </div>
  )
}
