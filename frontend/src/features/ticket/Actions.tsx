import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFrame } from './frame'

/** The actions of the current step, rendered into the action bar of the container the ticket is shown in. */
export function Actions({ children }: { children: ReactNode }) {
  const { actionsEl } = useFrame()
  return actionsEl ? createPortal(children, actionsEl) : null
}
