import { CollateralPanel } from '../maker/CollateralPanel'
import type { CollateralHealth, CollateralLine } from '../options/types'
import { PageHeader } from '../ui'

export interface ReservesViewProps {
  collateral: CollateralLine[]
  health: CollateralHealth[]
  contractId?: string
}

export function ReservesView({ collateral, health, contractId }: ReservesViewProps) {
  return (
    <>
      <PageHeader
        title="Reserves"
        subtitle="What the options contract owes, compared with what it actually holds. Both numbers are read from the chain."
      />
      <CollateralPanel lines={collateral} health={health} contractId={contractId} />
    </>
  )
}
