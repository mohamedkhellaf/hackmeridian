// Copy of the Margin section that is not a required disclosure. The banner sentences, the warning title, its
// three bullets and its consent label live in core/disclosures.ts and are imported from there, never retyped.
//
// Wording limits (AGENTS.md, brief section 0): a Margin position is never called guaranteed, insured, safe,
// fully backed or fully collateralized; a price is "the publisher price", never a market or oracle price. The
// instant a series ends is "the deadline", as in Covered (ruling F11); contract and refusal names keep "expired".
import type { MarginScreen } from './screen'

export interface ScreenCopy {
  /** The nav label, and the page heading (the section name is already in the top bar and the sentences). */
  nav: string
  title: string
}

// No line under the title: the required Margin sentences are the one paragraph there (rulings E22, F11).
export const SCREENS: Record<MarginScreen, ScreenCopy> = {
  account: { nav: 'Account', title: 'Account' },
  trade: { nav: 'Trade', title: 'Trade' },
  positions: { nav: 'Positions', title: 'Positions' },
  liquidations: { nav: 'Liquidations', title: 'Liquidations' },
  vault: { nav: 'Vault', title: 'Vault' },
}

export const SCREEN_ORDER: readonly MarginScreen[] = ['account', 'trade', 'positions', 'liquidations', 'vault']

export const SCREEN_PATH = {
  account: '/margin',
  trade: '/margin/trade',
  positions: '/margin/positions',
  liquidations: '/margin/liquidations',
  vault: '/margin/vault',
} as const satisfies Record<MarginScreen, string>

export const AMOUNT_ERROR = 'Enter an amount above zero, with at most 7 decimals.'
export const LOTS_ERROR = 'Enter a whole number of lots above zero.'

/** The order of payment, said next to the waterfall. The third line is the holder risk in plain words. */
export const PAYOUT_ORDER: readonly { source: string; rule: string }[] = [
  { source: 'Writer margin', rule: 'Paid first, from the cash the writer has in the contract.' },
  { source: 'Vault', rule: 'Then the vault, pro rata within the series at settlement.' },
  { source: 'Deficit', rule: 'Whatever is left unpaid. It cuts your payout.' },
]

/** Printed directly above the Buy action. The wallet signature is the consent; this says what is agreed to. */
export const BUY_PAYOUT_LINE = 'Your payout can be reduced: writer margin first, then the vault, then a deficit.'

/** The five reasons the contract refuses an early exercise, by error code (core/pro/errors.ts has the words). */
export const EARLY_EXERCISE_REFUSALS: readonly number[] = [226, 207, 223, 225, 224]

/** Beside an Exercise early button that the model expects to be refused: the reason in a few words. */
export const REFUSAL_SHORT: Record<number, string> = {
  226: 'Owned by the vault: settles at the deadline.',
  207: 'The snapshot is too old for early exercise.',
  223: 'Out of the money at the latest snapshot.',
  225: 'A settlement price is pending.',
  224: 'The writer must be taken over first.',
}

/** The three calls after the deadline, in order. */
export const AFTER_EXPIRY_STEPS = {
  books: 'Settle the writer books',
  series: 'Settle the series against the vault',
  claims: 'Holders claim',
  anyone: 'Anyone can make the first two calls.',
} as const

export const LP_LOCK_NOTE = 'LP capital cannot be withdrawn in this version. A deposit stays in the vault.'
