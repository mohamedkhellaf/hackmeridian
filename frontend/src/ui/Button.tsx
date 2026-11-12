import { Button as BaseButton } from '@base-ui/react/button'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { useEffect, useId, useState } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from 'react'
import { cx } from './internal/cx'
import { Spinner } from './Spinner'
import { Tooltip } from './Tooltip'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'md' | 'sm'

interface ButtonLook {
  /** `primary` is ink and there is one per view. `secondary` is outlined, `quiet` has no border, `danger` is for destructive actions. */
  variant?: ButtonVariant
  /** `md` is 36 px, `sm` is 28 px (table rows). */
  size?: ButtonSize
  iconStart?: ReactNode
  iconEnd?: ReactNode
  fullWidth?: boolean
}

export interface ButtonProps extends ButtonLook, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /**
   * `danger` on a `quiet` button sets it in the danger ink without a border: a destructive action in a dense
   * row, where a column of outlined danger buttons would shout. The confirmation it opens uses `variant="danger"`.
   */
  tone?: 'default' | 'danger'
  /** Shows a spinner, sets `aria-busy` and blocks activation while keeping focus on the button. */
  loading?: boolean
  /**
   * Why the button is disabled. Read by screen readers (the button stays focusable), shown under the button on
   * hover or focus, and on a tap on touch screens, which have no hover.
   */
  disabledReason?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * The action button. Submit buttons must say `type="submit"`.
 * For navigation use `ButtonLink`, which keeps link semantics.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  iconStart,
  iconEnd,
  fullWidth = false,
  loading = false,
  disabled = false,
  disabledReason,
  tone = 'default',
  className,
  children,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  const reasonId = useId()
  const blocked = disabled || loading
  const reason = disabled && disabledReason ? disabledReason : undefined
  const [reasonOpen, setReasonOpen] = useState(false)
  const [tapped, setTapped] = useState(false)

  // A reason opened by a tap closes by itself, or on the next press anywhere else.
  useEffect(() => {
    if (!tapped) return
    const close = () => {
      setTapped(false)
      setReasonOpen(false)
    }
    const timer = window.setTimeout(close, 5000)
    const away = () => close()
    const frame = window.requestAnimationFrame(() => document.addEventListener('pointerdown', away, { once: true }))
    return () => {
      window.clearTimeout(timer)
      window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', away)
    }
  }, [tapped])

  const button = (
    <BaseButton
      {...rest}
      ref={ref}
      type={type}
      disabled={blocked}
      focusableWhenDisabled={loading || reason !== undefined}
      aria-busy={loading || undefined}
      aria-describedby={cx(rest['aria-describedby'], reason ? reasonId : undefined) || undefined}
      className={cx(styles.root, className)}
      data-variant={variant}
      data-tone={tone === 'danger' ? 'danger' : undefined}
      data-size={size}
      data-full-width={fullWidth || undefined}
      data-loading={loading || undefined}
      onPointerUp={(event) => {
        rest.onPointerUp?.(event)
        if (reason && event.pointerType !== 'mouse') {
          setReasonOpen(true)
          setTapped(true)
        }
      }}
    >
      {loading && iconStart ? (
        <span className={cx(styles.icon, styles.spinnerSlot)}>
          <Spinner />
        </span>
      ) : iconStart ? (
        <span className={styles.icon}>{iconStart}</span>
      ) : null}
      <span className={styles.label} data-covered={loading && !iconStart ? true : undefined}>
        {children}
      </span>
      {loading && !iconStart ? (
        <span className={styles.spinnerOver}>
          <Spinner />
        </span>
      ) : null}
      {iconEnd ? <span className={styles.icon}>{iconEnd}</span> : null}
    </BaseButton>
  )

  // One tree whether or not there is a reason: the <button> is never remounted, so a focused button keeps its
  // focus when it becomes disabled with a reason, and again when the reason goes.
  return (
    <>
      <Tooltip
        stable
        content={reason}
        side="bottom"
        open={reasonOpen}
        onOpenChange={(next) => {
          if (!next && tapped) return
          setReasonOpen(next)
        }}
      >
        {button}
      </Tooltip>
      <span id={reasonId} hidden>
        {reason}
      </span>
    </>
  )
}

export interface ButtonLinkProps extends ButtonLook, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  /** Replace the anchor, for example with a router link: `render={<RouterLink to="/markets" />}`. */
  render?: ReactElement<Record<string, unknown>>
  className?: string
}

/** A link that looks like a button. It stays a link: Enter follows it, and it can be opened in a new tab. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  iconStart,
  iconEnd,
  fullWidth = false,
  render,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        className: cx(styles.root, className),
        children: (
          <>
            {iconStart ? <span className={styles.icon}>{iconStart}</span> : null}
            <span className={styles.label}>{children}</span>
            {iconEnd ? <span className={styles.icon}>{iconEnd}</span> : null}
          </>
        ),
      },
      { 'data-variant': variant, 'data-size': size, 'data-full-width': fullWidth || undefined } as Record<string, unknown>,
      rest,
    ),
  })
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** Names the action ("Copy maker address"). It is the accessible name and the tooltip. */
  label: string
  icon: ReactNode
  variant?: 'quiet' | 'secondary'
  size?: ButtonSize
  /** Set to false where a tooltip would cover what the user is reading. */
  tooltip?: boolean
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/** An icon-only button. Only where the icon replaces a word in a tight row: copy, open, close, more. */
export function IconButton({
  label,
  icon,
  variant = 'quiet',
  size = 'md',
  tooltip = true,
  className,
  type = 'button',
  ref,
  ...rest
}: IconButtonProps) {
  const button = (
    <BaseButton
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(styles.root, styles.iconOnly, className)}
      data-variant={variant}
      data-size={size}
    >
      <span className={styles.icon}>{icon}</span>
    </BaseButton>
  )
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button
}
