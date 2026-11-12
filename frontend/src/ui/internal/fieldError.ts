import type { ReactNode } from 'react'

/** Whether an `error` prop holds something to show. */
export function isFieldError(error: ReactNode): boolean {
  return error !== undefined && error !== null && error !== false && error !== ''
}
