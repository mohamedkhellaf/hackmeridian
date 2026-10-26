import type { Ask, CollateralHealth, CollateralLine, NewOffer, OptionOffer, SupportedAssets, TxResult } from './types'

// The UI only talks to this interface. MockOptionsClient and SorobanOptionsClient implement it
// (docs/contract-abi.md); createOptionsClient() in index.ts picks one.
export interface OptionsClient {
  readonly isMock: boolean
  supportedAssets(): Promise<SupportedAssets>
  listOptions(): Promise<OptionOffer[]>
  getOption(id: bigint): Promise<OptionOffer>
  // Per-token split derived from the option list (offered / active / pendingReclaim / unclaimed).
  openCollateral(): Promise<CollateralLine[]>
  // On-chain check: contract open_collateral(token) vs the contract's SAC balance.
  collateralHealth(): Promise<CollateralHealth[]>
  isEligible(token: string, who: string): Promise<boolean>
  // Open (Offered) offers by this writer; null when the contract has no per-writer cap (before v1.3).
  writerOpenCount(writer: string): Promise<number | null>
  createOffer(offer: NewOffer, writer: string): Promise<TxResult & { id: bigint }>
  buy(id: bigint, buyer: string): Promise<TxResult>
  exercise(id: bigint, holder: string): Promise<TxResult>
  reclaim(id: bigint, writer: string): Promise<TxResult>
  cancelOffer(id: bigint, writer: string): Promise<TxResult>
  // Writer pulls the proceeds of an exercised option; exercised -> settled.
  claimDelivery(id: bigint, writer: string): Promise<TxResult>
  // Resale (contract v1.4). listAsks returns null when the contract has no resale functions (before v1.4).
  listAsks(): Promise<Ask[] | null>
  getAsk(id: bigint): Promise<bigint | null>
  // Holder lists an Active, unexpired option for `askTotal` quote units (overwrites an existing ask).
  listForSale(id: bigint, holder: string, askTotal: bigint): Promise<TxResult>
  cancelSale(id: bigint, holder: string): Promise<TxResult>
  // Buyer pays ask_total in the option's quote token to the current holder and becomes the holder, atomically.
  buyResale(id: bigint, buyer: string): Promise<TxResult>
}
