import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Shows a spinner, sets aria-busy and disables the button. Keep the label text meaningful. */
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  loading,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const cls = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, fullWidth && 'ui-btn--full', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
