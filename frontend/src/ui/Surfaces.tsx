import { useId } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

/** Bordered surface. `header` renders a title row (title left, `actions` right) above the body. */
export function Card({
  title,
  subtitle,
  actions,
  flush,
  className,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Remove body padding (use when the body is a full-bleed `.ui-table`). */
  flush?: boolean
}) {
  return (
    <section className={['ui-card', className].filter(Boolean).join(' ')} {...rest}>
      {(title || actions) && (
        <header className="ui-card-header">
          <div className="ui-card-heading">
            {title && <h2 className="ui-card-title">{title}</h2>}
            {subtitle && <p className="ui-card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="ui-card-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'ui-card-body ui-card-body--flush' : 'ui-card-body'}>{children}</div>
    </section>
  )
}

/** Page title block used at the top of every view. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ui-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="ui-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </div>
  )
}

/** KPI strip: a bordered grid of `Stat`s separated by 1px rules. Collapses to one column on phones. */
export function StatGrid({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  return (
    <div className={`ui-stat-grid ui-stat-grid--${columns}`}>
      {children}
    </div>
  )
}

/** One KPI. Exposed as a labelled group so tests and screen readers can address it by its label. */
export function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <div className="ui-stat" role="group" aria-labelledby={id}>
      <span className="ui-label" id={id}>
        {label}
      </span>
      <span className="ui-stat-value">{children}</span>
      {hint && <span className="ui-stat-hint">{hint}</span>}
    </div>
  )
}

export type BannerTone = 'warn' | 'ok' | 'danger' | 'info'

/** Inline banner. danger uses role=alert, others role=note. Text carries the meaning, colour is secondary. */
export function Banner({
  tone = 'info',
  children,
  className,
  title,
}: {
  tone?: BannerTone
  children: ReactNode
  className?: string
  title?: ReactNode
}) {
  return (
    <div className={['ui-banner', `ui-banner--${tone}`, className].filter(Boolean).join(' ')} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon name={tone === 'ok' ? 'check' : 'alert'} size={15} className="ui-banner-icon" />
      <div className="ui-banner-body">
        {title && <strong className="ui-banner-title">{title}</strong>}
        {children}
      </div>
    </div>
  )
}
