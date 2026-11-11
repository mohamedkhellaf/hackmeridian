import type { ReactNode } from 'react'
import { IconDanger, IconInfo, IconWarning } from './icons'
import { cx } from './internal/cx'
import styles from './Callout.module.css'

export type CalloutVariant = 'info' | 'warning' | 'danger'

const WORD: Record<CalloutVariant, string> = { info: 'Note', warning: 'Warning', danger: 'Problem' }

export interface CalloutProps {
  /** `info` explains, `warning` asks for attention before acting, `danger` reports something broken or blocking. */
  variant?: CalloutVariant
  /** The word next to the icon. Each variant has one, so the meaning never rests on colour. */
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
      </span>
      <div className={styles.content}>
        <p className={styles.head}>
          <span className={styles.word}>{label ?? WORD[variant]}</span>
          {title ? <span className={styles.title}>{title}</span> : null}
        </p>
        {children ? <div className={styles.body}>{children}</div> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>
  )
}
