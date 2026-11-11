// Copy of the Margin section that is not a required disclosure. The banner, the warning title, its three
// bullets and its consent label live in core/disclosures.ts and are imported from there, never retyped.
//
// Wording limits (AGENTS.md, brief section 0): a Margin position is never called guaranteed, insured, safe,
// fully backed or fully collateralized; a price is "the publisher price", never a market or oracle price.
import { MARGIN_PAYOUT_RISK, MARGIN_PUBLISHER_LINE } from '../../core/disclosures'
import type { MarginScreen } from './screen'

export interface ScreenCopy {
  /** The nav label. */
  nav: string
  /** The page heading. */
  title: string
  /** One line saying what the page is. */
  description: string
}

export const SCREENS: Record<MarginScreen, ScreenCopy> = {
  account: {
    nav: 'Account',
    title: 'Margin account',
    description: 'The cash you post against the calls you wrote, and how far it stands from liquidation.',
  },
  trade: {
    nav: 'Trade',
    title: 'Margin trade',
    description: 'Uncovered calls, settled in cash. The writer posts partial margin, not the full underlying.',
  },
  positions: {
    nav: 'Positions',
    title: 'Margin positions',
    description: 'Calls bought on margin. Exercise early, or settle and claim after expiry.',
  },
  liquidations: {
    nav: 'Liquidations',
    title: 'Liquidations',
    description: 'A writer below the liquidation level can be taken over, by the vault or by another writer.',
  },
  vault: {
    nav: 'Vault',
    title: 'Vault',
    description: 'The pre-funded backstop. It pays holders after the writer margin, as far as it reaches.',
  },
}

export const SCREEN_ORDER: readonly MarginScreen[] = ['account', 'trade', 'positions', 'liquidations', 'vault']

export const SCREEN_PATH = {
  account: '/margin',
  trade: '/margin/trade',
  positions: '/margin/positions',
  liquidations: '/margin/liquidations',
  vault: '/margin/vault',
} as const satisfies Record<MarginScreen, string>

/**
 * The payout risk, said on every Margin screen (AGENTS.md, "StellSec Pro UI", Copy). The contract banner of
 * core/disclosures.ts opens with this sentence; on fixtures it is printed under the "Simulated" banner.
 * AGENTS.md words it "Testnet only. Partial margin: ...". The first two words are left out on the owner's
 * direction of 11 Nov 2026 recorded in core/disclosures.ts (no "Testnet only" taglines in banners).
 */
export const PAYOUT_RISK_LINE = MARGIN_PAYOUT_RISK

/**
 * Under the oracle figures. The first sentence is the wording AGENTS.md asks for on every Margin screen; the
 * contract banner already carries it, so the strip prints it only under the "Simulated" banner, which does not.
 */
export const PUBLISHER_LINE = MARGIN_PUBLISHER_LINE
export const PUBLISHER_NOTE = 'A demo feed run by the team, not a market.'

/** Said wherever a dash stands for a figure. */
export const NO_VALUE_NOTE = 'A dash means the source has no value at this moment. Nothing is computed in the page.'

/** The fixture client replays the script: what was typed is not what moves. */
export const REPLAY_NOTE = 'Each action replays the next matching step of the recorded scenario. Amounts you type are not used: the script decides.'

/** Why a write is unavailable without a wallet (Testnet-contract builds). */
export const CONNECT_TO_ACT = 'Connect a wallet to deposit, trade or claim.'

export const AMOUNT_ERROR = 'Enter an amount above zero, with at most 7 decimals.'
export const LOTS_ERROR = 'Enter a whole number of lots above zero.'

/** The order of payment, said next to the waterfall. The third line is the holder risk in plain words. */
export const PAYOUT_ORDER: readonly { source: string; rule: string }[] = [
  { source: 'Writer margin', rule: 'Paid first, from the cash the writer has in the contract.' },
  { source: 'Vault', rule: 'Then the vault, pro rata within the series at settlement.' },
  { source: 'Deficit', rule: 'Whatever is left unpaid. It cuts your payout.' },
]

export const BUY_CONSENT = 'I understand my payout can be reduced.'

export const COVERAGE_CAPTION =
  'Hypothetical. It uses the writer cash and the vault value as they are now, and assumes the whole vault backs this writer. Both can change before settlement.'

/** The five reasons the contract refuses an early exercise, by error code (core/pro/errors.ts has the words). */
export const EARLY_EXERCISE_REFUSALS: readonly number[] = [226, 207, 223, 225, 224]

export const AFTER_EXPIRY_NOTE =
  'After expiry nothing settles by itself. Three calls, in order: settle the writer book, settle the series against the vault, then the holder claims. Anyone can make the first two.'

export const LP_LOCK_NOTE = 'LP capital cannot be withdrawn in this version. A deposit stays in the vault.'
