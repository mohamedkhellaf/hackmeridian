import { useState } from 'react'
import type { ReactNode } from 'react'
import { Marker } from '../../ui'
import css from './Changed.module.css'

/**
 * A figure that changed since the last read cross-fades in and flashes the marker once (brief 5.3), so a
 * Refresh that moves a balance is seen. `value` is the exact figure (its integer units); the first value shown
 * never flashes. Under reduced motion the flash and the fade resolve at once.
 */
export function Changed({ value, children }: { value: string | undefined; children: ReactNode }) {
  const [seen, setSeen] = useState(value)
  const [changed, setChanged] = useState<string | null>(null)
  if (value !== seen) {
    setSeen(value)
    setChanged(seen !== undefined && value !== undefined ? value : null)
  }
  if (changed === null || changed !== value) return <>{children}</>
  return (
    <Marker flash key={changed} className={css.mark}>
      <span className={css.fade} data-changed="">
        {children}
      </span>
    </Marker>
  )
}
