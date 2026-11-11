// The reference price model (brief D12).
//
// The Covered contract reads no price. A reference price exists only so the interface can say whether a strike is
// above or below something, and it is always shown with its label and note. It is never called a market price,
// an oracle price or a live price, and it never reaches a transaction.

/**
 * - `demo`: mock mode. A fixed figure chosen for the demo data.
 * - `fixed`: live mode today. The rate of the Testnet faucet's standing offers; it does not move.
 * - `desk`: the target state (a team-run desk on the Testnet DEX). No provider exists yet.
 * - `none`: nothing to show. The user can still set an assumed price.
 */
export type ReferenceKind = 'demo' | 'fixed' | 'desk' | 'none'

export interface ReferencePrice {
  kind: ReferenceKind
  /** Quote units for one whole unit of underlying. Null when there is no reference. */
  perUnit: bigint | null
  /** Short label shown with the figure: `Demo price`, `Testnet faucet price`. */
  label: string
  /** One line on where the figure comes from and what it is not. */
  note: string
  /** Unix seconds of the observation. Null for a figure that has no age (demo, fixed, none). */
  asOf: number | null
  /** Where the figure can be checked, in plain words. */
  source?: string
}

export const REFERENCE_LABEL: Record<ReferenceKind, string> = {
  demo: 'Demo price',
  fixed: 'Testnet faucet price',
  desk: 'Testnet desk price',
  none: 'No reference price',
}

export const REFERENCE_NOTE: Record<ReferenceKind, string> = {
  demo: 'Chosen by the team for this demo. Not a market.',
  fixed: "Fixed by the team's faucet. Not a market.",
  desk: "Set by the team's standing offers on the Stellar Testnet DEX. No real funds.",
  none: 'Set an assumed price to see what an option would pay.',
}
