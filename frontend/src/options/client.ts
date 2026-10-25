import type { CollateralLine, NewOffer, OptionOffer, SupportedAssets, TxResult } from './types'

// The UI only talks to this interface. The mock implements it today; the
// generated Soroban bindings will implement it once Dev 2 publishes the ABI.
// Method names follow AGENTS.md and are illustrative until the compiled ABI lands.
export interface OptionsClient {
  readonly isMock: boolean
  supportedAssets(): Promise<SupportedAssets>
  listOptions(): Promise<OptionOffer[]>
  getOption(id: bigint): Promise<OptionOffer>
  openCollateral(): Promise<CollateralLine[]>
  createOffer(offer: NewOffer, writer: string): Promise<TxResult & { id: bigint }>
  buy(id: bigint, buyer: string): Promise<TxResult>
  exercise(id: bigint, holder: string): Promise<TxResult>
  reclaim(id: bigint, writer: string): Promise<TxResult>
  cancelOffer(id: bigint, writer: string): Promise<TxResult>
}
