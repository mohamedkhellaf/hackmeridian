import { useChildMatches } from '@tanstack/react-router'
import { MarginPage } from '../features/margin'

/**
 * The component of `/margin`, loaded lazily by the manifest together with the Margin feature. One `MarginPage`
 * stays mounted across the five screens (the entry warning, the simulation and the acting account live in it);
 * the child route only says which screen is shown.
 */
export function MarginRoute() {
  const screen = useChildMatches({ select: (matches) => matches[0]?.staticData.screen }) ?? 'account'
  return <MarginPage screen={screen} />
}
