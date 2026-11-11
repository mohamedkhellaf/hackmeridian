// The Testnet deployments, as recorded in AGENTS.md "Deployed contracts" (repository root) on 26 Oct 2026.
// Plain data: ids are copied character for character and checked in deployments.test.ts (shape, checksum, and
// agreement with core/assets, whose ids are derived from code and issuer with the SDK in its own test).
//
// The contracts expose neither their wasm hash nor, for Margin, their roles through the clients this app uses,
// so the record is the source. A build that points at another contract id gets no hash from here: the page
// says so and links the explorer instead.
import { QUOTE_ASSETS, REFERENCE_ASSETS } from './assets'
import type { AssetFlags } from './assetfacts/assetFacts'

export const RECORDED_ON = '26 Oct 2026'

/** The account that deployed both contracts (`strata-deployer`). It keeps no power over either. */
export const DEPLOYER = 'GBVPEL6MT4IZ4XL5J7TTMB3GND7TPRS54KOJTUFCUOVFVFPZKE5HDA73'

export interface ContractRecord {
  contractId: string
  version: string
  /** sha256 of the deployed wasm, hex. */
  wasmHash: string
  /** Hash of the deploy transaction, hex. */
  deployTx: string
  deployer: string
}

/** options v1.5 (funded bids). */
export const COVERED_CONTRACT: ContractRecord = {
  contractId: 'CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6',
  version: 'v1.5',
  wasmHash: '64ab726516d9dff13921dacb197f786dca1aa64f6ae62f33f10f902fcea62de8',
  deployTx: 'b3c8fdd1a609e688f2b76b92e9dc9ce3f867062129a09fcc6092e667c7c7808e',
  deployer: DEPLOYER,
}

export interface MarginRecord extends ContractRecord {
  /** Lists series. */
  admin: string
  /** Publishes risk snapshots and the settlement price. Team-operated, not an oracle. */
  publisher: string
}

/** pro v0.3.2 (experimental). */
export const MARGIN_CONTRACT: MarginRecord = {
  contractId: 'CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN',
  version: 'v0.3.2',
  wasmHash: '074a4ed4d7eb3e52011edaad8297f2cd95083decad2a9d37aa74c1e9a8837071',
  deployTx: '69d331680b3994d0f42b765a46bb9ae333cca638f717fbff3efc431dfd255c51',
  deployer: DEPLOYER,
  admin: 'GBMOPIHIXTPORA3HFGBKQKTZLJWTUYALVSN3QXH647UQFJIOQ3KSZO44',
  publisher: 'GDY257DGQREP4NLM2DF2YUS5M2VHRW3JNDK2YYHZP55SMW3FMAUHZUVN',
}

export interface TokenRecord {
  code: string
  role: 'quote' | 'underlying'
  contractId: string
  issuer: string
  /** Issuer flags as recorded. A live build reads them again from the network. */
  flags: Pick<AssetFlags, 'authRequired' | 'authRevocable' | 'clawback'>
  /** A fact about this token worth a line of its own. */
  note?: 'not-immutable' | 'listed-later'
}

/**
 * RWA, BOND and EQTY share one issuer account, and authorization flags are set on the account, so the three
 * read the same. AUTH_REQUIRED was cleared on that account on 26 Oct 2026 (new trustlines are authorized
 * automatically); revocable and clawback stay on. Checked against Horizon on 11 Nov 2026: all three read
 * "not required, revocable, clawback".
 */
const TEAM_ISSUER_FLAGS: TokenRecord['flags'] = { authRequired: false, authRevocable: true, clawback: true }

const quote = QUOTE_ASSETS.testnet

/** The quote token first, then the underlyings in list order. Ids come from core/assets (one source). */
export const TOKEN_RECORDS: readonly TokenRecord[] = [
  { code: quote.code, role: 'quote', contractId: quote.contractId, issuer: quote.issuer, flags: { authRequired: false, authRevocable: false, clawback: false }, note: 'not-immutable' },
  ...REFERENCE_ASSETS.testnet.map(
    (a): TokenRecord => ({
      code: a.code,
      role: 'underlying',
      contractId: a.contractId,
      issuer: a.issuer,
      flags: TEAM_ISSUER_FLAGS,
      // EQTY was not in the constructor: it was listed with list_asset.
      note: a.code === 'EQTY' ? 'listed-later' : undefined,
    }),
  ),
]

export const findTokenRecord = (contractId: string): TokenRecord | null => TOKEN_RECORDS.find((t) => t.contractId === contractId) ?? null

/** The record for a configured contract id, or null when the build points somewhere this app has no record for. */
export const coveredRecordFor = (contractId: string | undefined): ContractRecord | null => (contractId === COVERED_CONTRACT.contractId ? COVERED_CONTRACT : null)
export const marginRecordFor = (contractId: string | undefined): MarginRecord | null => (contractId === MARGIN_CONTRACT.contractId ? MARGIN_CONTRACT : null)
