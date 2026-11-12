import { memo, useEffect, useState } from 'react'
import {
  countdownTickMs,
  formatCountdown,
  formatCountdownWords,
  formatLocalTime,
  formatUtcDateTime,
  toDate,
  toIsoUtc,
} from './format'
import type { DateInput, UtcFormat } from './format'
import { useClockOffset } from './clockOffset'
import { IconClock } from './icons'
import { cx } from './internal/cx'
import styles from './DateTime.module.css'

export interface DateTimeProps {
  /** A Date, epoch milliseconds or an ISO string. */
  value: DateInput
  /** `full` is `13 Nov 2026, 08:00 UTC`. `table` is `13 Nov 08:00` (the column header says UTC). `date` is `13 Nov 2026`. */
  format?: UtcFormat
  /** Where the viewer's local time goes: under the UTC form, after it, or nowhere (dense tables). */
  local?: 'below' | 'inline' | 'none'
  className?: string
}

/**
 * A point in time. UTC is canonical because the contract compares against ledger close time and both sides of a
 * trade must read the same string; the viewer's local time is secondary.
 */
export const DateTime = memo(function DateTime({ value, format = 'full', local = 'none', className }: DateTimeProps) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return null
  return (
    <time className={cx(styles.root, className)} dateTime={toIsoUtc(date)} data-local={local}>
      <span className={styles.utc}>{formatUtcDateTime(date, format)}</span>
      {local !== 'none' ? <span className={styles.local}>{formatLocalTime(date)}</span> : null}
    </time>
  )
})

export interface CountdownProps {
  /** The deadline, in epoch milliseconds. */
  to: number
  /**
   * The current time in epoch milliseconds. When left out the component ticks on the device clock corrected by
   * the ledger offset of the nearest `ClockProvider`: deadlines are decided by the ledger, not by this device.
   */
  now?: number
  /** Below this much time left the countdown takes the warning tone and a clock glyph. */
  warnBelowMs?: number
  /** Shown once the deadline has passed. */
  expiredLabel?: string
  /** Start of the accessible name ("Time left"). */
  label?: string
  className?: string
}

/** Time left as `2 d 4 h`. It is a timer, not a live region: threshold crossings are announced by the caller. */
export function Countdown({
  to,
  now,
  warnBelowMs,
  expiredLabel = 'Expired',
  label = 'Time left',
  className,
}: CountdownProps) {
  const [clock, setClock] = useState(() => Date.now())
  const offset = useClockOffset()
  const current = now ?? clock + offset
  const left = to - current

  useEffect(() => {
    if (now !== undefined || left <= 0) return
    const timer = setTimeout(() => setClock(Date.now()), countdownTickMs(left))
    return () => clearTimeout(timer)
  }, [now, left])

  // A sleeping tab or a device that wakes up has a stale clock until the next tick, which can be a minute away:
  // read the time again as soon as the page is looked at.
  useEffect(() => {
    if (now !== undefined) return
    const reread = () => {
      if (document.visibilityState === 'visible') setClock(Date.now())
    }
    document.addEventListener('visibilitychange', reread)
    window.addEventListener('focus', reread)
    return () => {
      document.removeEventListener('visibilitychange', reread)
      window.removeEventListener('focus', reread)
    }
  }, [now])

  if (left <= 0) {
    return (
      <span className={cx(styles.countdown, className)} role="timer" data-state="expired">
        {expiredLabel}
      </span>
    )
  }
  const warn = warnBelowMs !== undefined && left < warnBelowMs
  return (
    <span
      className={cx(styles.countdown, className)}
      role="timer"
      aria-label={`${label}: ${formatCountdownWords(left)}`}
      data-state={warn ? 'warn' : 'running'}
    >
      {warn ? <IconClock size={14} /> : null}
      <span aria-hidden="true">{formatCountdown(left)}</span>
    </span>
  )
}
