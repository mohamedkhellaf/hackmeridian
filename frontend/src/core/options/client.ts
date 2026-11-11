import type { Bid, NewBid } from '../requests/types'
import type { TokenBalance } from '../stellar/tokens'
import type { TxCheck, TxOptions } from '../tx/types'
import type { Ask, CollateralHealth, CollateralLine, NewOffer, OptionOffer, SupportedAssets, TokenInfo, TxResult } from './types'

// The UI only talks to this interface. MockOptionsClient and SorobanOptionsClient implement it
// (docs/contract-abi.md); createOptionsClient() in createClient.ts picks one.
//
// Writes. Every write takes an optional last argument `{ onStage }` and reports checking, signing, submitting and
// pending (with the hash) while it runs. It resolves once a ledger has included the transaction and rejects with
// a `TxError` (core/tx/errors.ts) whose `kind` says where it stopped: declined, refused, failed, unknown, expired.
// Feed both into the machine in core/tx/machine.ts (`runMachine`).
export interface OptionsClient {
  readonly isMock: boolean
  supportedAssets(): Promise<SupportedAssets>
  listOptions(): Promise<OptionOffer[]>
  getOption(id: bigint): Promise<OptionOffer>
  // Per-token split derived from the option list and the requests (offered / active / pendingReclaim / unclaimed / escrowed).
  openCollateral(): Promise<CollateralLine[]>
  // On-chain check: contract open_collateral(token) vs the contract's SAC balance.
  collateralHealth(): Promise<CollateralHealth[]>
  isEligible(token: string, who: string): Promise<boolean>
  // Open (Offered) offers by this writer; null when the contract has no per-writer cap (before v1.3).
  writerOpenCount(writer: string): Promise<number | null>
  /**
   * Balances of `who` for the given tokens (default: the quote token and every listed underlying). Never signs.
   * Live: SAC balances plus trustline state. Mock: the demo ledger, which moves with every mock trade.
   */
  balances(who: string, tokens?: TokenInfo[]): Promise<TokenBalance[]>
  /**
   * Looks up a transaction whose outcome was unknown. `maxTime` is its time bound (from the `pending` stage or
   * the `TxError`): the answer is `expired` only once a ledger has closed after it.
   */
  checkTx(hash: string, maxTime: number | null): Promise<TxCheck>

  createOffer(offer: NewOffer, writer: string, opts?: TxOptions): Promise<TxResult & { id: bigint }>
  buy(id: bigint, buyer: string, opts?: TxOptions): Promise<TxResult>
  exercise(id: bigint, holder: string, opts?: TxOptions): Promise<TxResult>
  reclaim(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult>
  cancelOffer(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult>
  // Writer pulls the proceeds of an exercised option, put or call; exercised -> settled.
  claimDelivery(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult>
  // Resale (contract v1.4). listAsks returns null when the contract has no resale functions (before v1.4).
  listAsks(): Promise<Ask[] | null>
  getAsk(id: bigint): Promise<bigint | null>
  // Holder lists an Active, unexpired option for `askTotal` quote units (overwrites an existing ask).
  listForSale(id: bigint, holder: string, askTotal: bigint, opts?: TxOptions): Promise<TxResult>
  cancelSale(id: bigint, holder: string, opts?: TxOptions): Promise<TxResult>
  // Buyer pays ask_total in the option's quote token to the current holder and becomes the holder, atomically.
  // `maxTotal` is the ask the buyer saw; a higher on-chain ask fails with PriceMoved (121).
  buyResale(id: bigint, buyer: string, maxTotal: bigint, opts?: TxOptions): Promise<TxResult>
  // Buyer requests (contract v1.5 bids). listBids returns null when the contract has no bids (before v1.5).
  listBids(): Promise<Bid[] | null>
  getBid(id: bigint): Promise<Bid>
  // Open requests by this buyer; null before v1.5.
  buyerOpenCount(buyer: string): Promise<number | null>
  // Buyer escrows `totalPremium` (quote token) in the contract; refunded on cancel or expiry.
  createBid(bid: NewBid, buyer: string, opts?: TxOptions): Promise<TxResult & { id: bigint }>
  cancelBid(id: bigint, buyer: string, opts?: TxOptions): Promise<TxResult>
  // Writer locks the collateral and receives the escrowed premium; the option is Active with holder = buyer.
  fillBid(id: bigint, writer: string, opts?: TxOptions): Promise<TxResult & { optionId: bigint }>
}
