// When the Portfolio list was last left, so that a position opened from it can go back to it in history (which
// keeps the list's tab, switch and scroll) instead of loading it afresh.
let listLeftAt: number | null = null

/** The Portfolio list calls this when it unmounts. */
export const markListLeft = (): void => {
  listLeftAt = Date.now()
}

/** True once, on the page mounted right after the list was left. */
export function cameFromList(): boolean {
  const left = listLeftAt
  listLeftAt = null
  return left !== null && Date.now() - left < 2_000
}
