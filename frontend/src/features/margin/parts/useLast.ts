import { useState } from 'react'

/**
 * The last value that was not null. A dialog opened for a row keeps showing that row while it closes, after
 * the caller has already cleared its selection.
 */
export function useLast<T>(value: T | null): T | null {
  const [last, setLast] = useState<T | null>(value)
  if (value !== null && value !== last) setLast(value)
  return value ?? last
}
