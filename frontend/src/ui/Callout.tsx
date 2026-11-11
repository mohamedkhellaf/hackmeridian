import type { ReactNode } from 'react'
import { IconDanger, IconInfo, IconWarning } from './icons'
import { cx } from './internal/cx'
import styles from './Callout.module.css'

export type CalloutVariant = 'info' | 'warning' | 'danger'

const WORD: Record<CalloutVariant, string> = { info: 'Note', warning: 'Warning', danger: 'Problem' }

export interface CalloutProps {
  /** `info` explains, `warning` asks for attention before acting, `danger` reports something broken or blocking. */
  variant?: CalloutVariant
  /**
   * A short word shown in place of a title. Shown only when there is no `title`. Each variant's own word
   * ("Note", "Warning", "Problem") is always given to screen readers, so the meaning never rests on colour or icon.
   */
  label?: string
  /** A short heading in ink. */
  title?: ReactNode
  children?: ReactNode
  /** One or two actions under the text. */
  actions?: ReactNode
  /**
   * Only for a message that appears in response to something and must interrupt (a failed submit, a lost
   * connection). It becomes `role="alert"`. Standing disclosures and banners are not alerts.
   */
  alert?: boolean
  className?: string
}

/** A message set apart from the flow. Not for marketing, reassurance or decoration. */
export function Callout({ variant = 'info', label, title, children, actions, alert = false, className }: CalloutProps) {
  const Icon = variant === 'danger' ? IconDanger : variant === 'warning' ? IconWarning : IconInfo
  return (
    <div className={cx(styles.root, className)} data-variant={variant} role={alert ? 'alert' : undefined}>
      <span className={styles.icon}>
        <Icon size={20} />
        <span className="ui-vh">{`${WORD[variant]}: `}</span>
      </span>
      <div className={styles.content}>
        {title || label ? (
          <p className={styles.head}>
            <span className={styles.title}>{title || label}</span>
          </p>
        ) : null}
        {children ? <div className={styles.body}>{children}</div> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>
  )
}
