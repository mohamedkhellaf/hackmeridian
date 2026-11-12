// The recorded options this page tells its story with. Every figure below is a real Stellar Testnet transaction
// of 26 October 2026, listed in docs/contract-testnet-evidence.md ("v1.3.1 deployment") and re-read from Horizon
// on 11 November 2026: ledger, close time, `fee_charged` and the token movements of each transaction.
//
// They ran on the v1.3.1 deployment of the covered contract, an earlier version of the one the app uses today
// (v1.5 keeps these functions unchanged). The page says so wherever it shows them. Nothing here is an open offer.
import { QUOTE_ASSETS, REFERENCE_ASSETS } from '../../core/assets'
import type { OptionKind, TokenInfo } from '../../core/options/types'

/** The maker and the holder of the recorded runs (disposable Testnet identities, public keys only). */
export const RECORDED_MAKER = 'GDNPA7N3WIUJLR6TJ2Z2EO3MXFWWZPN4D6P2L4YHSX3M4PZVTKMWDJCI'
export const RECORDED_HOLDER = 'GAXXQZK5RJRZZH3QDMVWFBRWL45CWHZZZXI4PQSAVPAWKILQJYHBJAR5'

const testnetToken = (code: string): TokenInfo => {
  const asset = REFERENCE_ASSETS.testnet.find((a) => a.code === code)
  if (!asset) throw new Error(`no Testnet reference asset ${code}`)
  return { contractId: asset.contractId, code: asset.code, decimals: asset.decimals, issuer: asset.issuer }
}

const USDX: TokenInfo = {
  contractId: QUOTE_ASSETS.testnet.contractId,
  code: QUOTE_ASSETS.testnet.code,
  decimals: QUOTE_ASSETS.testnet.decimals,
  issuer: QUOTE_ASSETS.testnet.issuer,
}

export interface RecordedTx {
  hash: string
  ledger: number
  /** Ledger close time, unix seconds (UTC). */
  closedAt: number
  /** `fee_charged` of the transaction, in stroops (1 XLM = 10,000,000 stroops). */
  feeStroops: bigint
}

export interface RecordedOption {
  id: bigint
  kind: OptionKind
  underlying: TokenInfo
  quote: TokenInfo
  underlyingQty: bigint
  totalStrike: bigint
  totalPremium: bigint
  /** Unix seconds. */
  expiry: number
  writer: string
  holder: string
}

const utc = (iso: string): number => Date.parse(iso) / 1000

/**
 * Option No. 8: a put on 5.00 EQTY at 10.00 USDx per unit for a premium of 1.00 USDx, written, bought, exercised
 * and claimed within four ledgers. The terms are the arguments of its `create_offer` call.
 */
export const RECORDED_PUT: RecordedOption = {
  id: 8n,
  kind: 'put',
  underlying: testnetToken('EQTY'),
  quote: USDX,
  underlyingQty: 50_000_000n,
  totalStrike: 500_000_000n,
  totalPremium: 10_000_000n,
  expiry: 1_792_979_773,
  writer: RECORDED_MAKER,
  holder: RECORDED_HOLDER,
}

export const RECORDED_PUT_TX = {
  write: { hash: '261583446ee575fd29dc2b1a9b43eb08da0701fff78996f74e025a19c5714147', ledger: 5_390_519, closedAt: utc('2026-10-26T00:56:22Z'), feeStroops: 309_366n },
  buy: { hash: 'ac3ce920f7cc3558d0327df7850390f2107c40c57c81aa7f1d81c7c58b23d718', ledger: 5_390_521, closedAt: utc('2026-10-26T00:56:32Z'), feeStroops: 31_976n },
  exercise: { hash: 'f2ad8d0e70ba15e5b487bd41b9d888a27fc8ba0d5551debe1fd4581560a210a5', ledger: 5_390_522, closedAt: utc('2026-10-26T00:56:37Z'), feeStroops: 79_873n },
  claim: { hash: 'd7f84cdfba2d61a896e86fcd645c9d7b76b8dd4bdb54f2a0303f9642c568d1fe', ledger: 5_390_524, closedAt: utc('2026-10-26T00:56:47Z'), feeStroops: 10_223n },
} as const satisfies Record<string, RecordedTx>

/**
 * Option No. 4 of the same run: a covered call on 3.00 RWA at 10.00 USDx per unit for a premium of 0.50 USDx.
 * Amounts are the token movements of its four transactions (3.00 RWA locked, 0.50 USDx paid, 30.00 USDx for
 * 3.00 RWA at exercise). The page never shows its deadline, so the expiry is not recorded here.
 */
export const RECORDED_CALL = {
  id: 4n,
  kind: 'call' as const,
  underlying: testnetToken('RWA'),
  quote: USDX,
  underlyingQty: 30_000_000n,
  totalStrike: 300_000_000n,
  totalPremium: 5_000_000n,
  writer: RECORDED_MAKER,
  holder: RECORDED_HOLDER,
}

/** Option No. 1 of the same run was never exercised: after its deadline the maker took the 50.00 USDx back. */
export const RECORDED_RECLAIM_TX: RecordedTx = {
  hash: 'dcc8b4bd07fc18720e76baaa44a14709216abe08bf34d0525aab549879e4e98a',
  ledger: 5_390_485,
  closedAt: utc('2026-10-26T00:53:32Z'),
  feeStroops: 13_363n,
}

/** Other transactions the Proof table links to (README "Evidence"; each re-read as successful on Horizon). */
export const EVIDENCE_TX = {
  /** v1.5 deployed. */
  deploy: 'b3c8fdd1a609e688f2b76b92e9dc9ce3f867062129a09fcc6092e667c7c7808e',
  /** The issuer authorizes the contract to hold EQTY, an asset listed at runtime. */
  authorize: '891473865d9330d7881b9208e02388166afe8e7cf13344853180ae5547de0512',
  /** The issuer claws collateral back from the contract. */
  clawback: 'f45330bed06985a957993ab49a8e81d1a276dc7e8444498fa5a57eaf5b5dcbeb',
  /** The issuer repays what it clawed back. */
  repay: 'c6ef06926cb5d47366ac16a89da0e9b87151c61e85aafe80a62ca4feae66432a',
  /** A holder's resale listing is bought by another eligible account. */
  resale: 'a5c5a3d2d80e510bfcebe9f9781b82bdc3313121feffaf30fa642d8556e69949',
  /** A maker fills a buyer's funded request. */
  fillBid: 'ce841e7eea37bc98821eb34360259aef5d32227b6a879e0f1b64c3f6ac9c35b3',
} as const

/**
 * `#[test]` functions in contracts/options, counted on 11 November 2026 with
 * `grep -c '#\[test\]'`: src/test.rs (unit), tests/invariants.rs (invariants checked against a reference model;
 * two of them run random sequences of calls with proptest) and tests/negative.rs (calls that must be refused).
 * CI runs them with `cargo test` (.github/workflows/ci.yml).
 */
export { CONTRACT_TESTS, CONTRACT_TEST_TOTAL } from '../../core/deployments'

/** The current covered contract on Testnet (v1.5), for links when the build itself has no contract id. */
export const COVERED_CONTRACT = 'CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6'
