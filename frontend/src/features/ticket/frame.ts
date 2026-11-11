// What a flow needs from the container it is shown in. The same flow runs in the rail, the drawer and the phone
// page: it reports its title and step upwards, and sends its actions to the container's action bar.
import { createContext, useContext } from 'react'
import type { OptionKind } from '../../core/options/types'
import type { StepName } from './copy'

/** `rail`: inline beside the page, from 1200 px. `drawer`: from the right, 768 to 1199 px. `page`: phones. */
export type Container = 'rail' | 'drawer' | 'page'

/** The series a ticket is about, for switching between Buy, Write and Bid without losing the terms. */
export interface SeriesRef {
  assetId: string
  kind: OptionKind
  /** Strike for one whole unit, as a plain decimal. */
  strike?: string
  /** Unix seconds. */
  expiry?: number
}

export interface FlowReport {
  title: string
  step: StepName
  series: SeriesRef | null
  /** The cheapest open offer of the series that the wallet could buy: null when there is none, undefined while unknown. */
  bestOfferId?: bigint | null
}

export interface FrameValue {
  container: Container
  /** Where the flow's actions are rendered: the action bar of the container. */
  actionsEl: HTMLElement | null
  report: (report: FlowReport) => void
  /** Moves focus to the ticket's heading (after a step change, and to the receipt). */
  focusTitle: () => void
  close: () => void
}

export const FrameContext = createContext<FrameValue | null>(null)

export function useFrame(): FrameValue {
  const frame = useContext(FrameContext)
  if (!frame) throw new Error('A ticket flow must be rendered inside TicketHost')
  return frame
}
