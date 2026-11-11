import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { IconClose, IconDanger, IconInfo, IconSuccess, IconWarning } from './icons'
import { dismissToast, getToasts, subscribeToasts } from './toastStore'
import type { ToastRecord, ToastTone } from './toastStore'
import styles from './Toast.module.css'

const TONE_ICON: Record<ToastTone, ReactNode> = {
  neutral: <IconInfo size={20} />,
  success: <IconSuccess size={20} />,
  warning: <IconWarning size={20} />,
  danger: <IconDanger size={20} />,
}

export interface ToastRegionProps {
  /** Names the landmark. */
  label?: string
}

/**
 * Where transient notices appear: bottom right on desktop, above the tab bar on phones (set `--toast-bottom` on
 * a parent to clear the bar). Mount once in the shell. The region has no live role of its own: the text of each
 * toast is sent through `announce()`, so `LiveRegions` must be mounted too. Timers pause while the pointer or
 * focus is inside.
 */
export function ToastRegion({ label = 'Notices' }: ToastRegionProps) {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  const [paused, setPaused] = useState(false)
  return (
    <section
      className={styles.region}
      aria-label={label}
      data-empty={toasts.length === 0 || undefined}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ol className={styles.list} role="list">
        {toasts.map((record) => (
          <ToastItem key={record.id} record={record} paused={paused} />
        ))}
      </ol>
    </section>
  )
}

function ToastItem({ record, paused }: { record: ToastRecord; paused: boolean }) {
  const remaining = useRef(record.duration)
  useEffect(() => {
    if (paused || remaining.current === null) return
    const started = Date.now()
    const timer = setTimeout(() => dismissToast(record.id), remaining.current)
    return () => {
      clearTimeout(timer)
      if (remaining.current !== null) remaining.current = Math.max(1000, remaining.current - (Date.now() - started))
    }
  }, [paused, record.id])

  return (
    <li className={styles.toast} data-tone={record.tone}>
      <span className={styles.icon}>{TONE_ICON[record.tone]}</span>
      <div className={styles.text}>
        <p className={styles.title}>{record.title}</p>
        {record.description ? <p className={styles.description}>{record.description}</p> : null}
        {record.action ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              record.action?.onClick()
              dismissToast(record.id)
            }}
          >
            {record.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" className={styles.close} aria-label={`Dismiss: ${record.title}`} onClick={() => dismissToast(record.id)}>
        <IconClose />
      </button>
    </li>
  )
}
