// The route contract of this feature (src/app/router.tsx): `/portfolio` and `/portfolio/$id`, with the search
// types of src/app/search.ts. Components read params and search through these two handles only.
import { getRouteApi } from '@tanstack/react-router'

export const portfolioRoute = getRouteApi('/portfolio')
export const positionRoute = getRouteApi('/portfolio/$id')

/** The option id of `/portfolio/$id`, or null when the segment is not a number the contract could have issued. */
export function parseOptionId(raw: string | undefined): bigint | null {
  if (!raw || !/^(0|[1-9]\d{0,19})$/.test(raw)) return null
  const id = BigInt(raw)
  return id <= 0xffff_ffff_ffff_ffffn ? id : null
}
