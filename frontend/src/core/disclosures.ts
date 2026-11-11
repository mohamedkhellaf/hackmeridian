// Every required disclosure sentence, in one place (brief section 6.2, AGENTS.md honest-claims rules).
//
// The wording is fixed: each string below was copied from the UI it replaced and is pinned word for word by
// disclosures.test.ts, except the footer notices and the Margin banners, which the owner had rewritten on 11 Nov
// 2026 (see LEGAL_NOTICE), and the payoff caption, which says "deadline" since the director's ruling R7 of the same
// day. The two collateral cards of the old write ticket are gone (ruling E1). Components and tests import from here
// and never retype a sentence. Each sentence has one home in the app; `DISCLOSURE_HOMES` is the register.

// ---------------------------------------------------------------------------------------------- app-wide

/**
 * App footer, every route: the legal notice of a build that reads the Stellar test network.
 *
 * Owner's direction, 11 Nov 2026: no tagline-style disclaimers anywhere in the interface ("Testnet only",
 * "Fictional assets", "No real funds", "Unaudited" as slogans, status rules, chips or banners). The footer carries a
 * conventional legal notice instead, and the network name appears only as a state indicator in the top bar.
 * Disclosures tied to a decision (issuer powers, premium, payoff caption, Margin payout risk) stay, as sentences,
 * where the decision is made. The footer picks its notice with `legalNotice(isMock)`.
 */
export const LEGAL_NOTICE =
  'This software is provided as is, without warranty of any kind. It runs on the Stellar test network, and the tokens it handles are test assets with no monetary value. Nothing here is an offer to sell, a solicitation to buy, or investment advice.'

/** App footer of a build without a contract (mock data): the same notice, true of what that build does. */
export const LEGAL_NOTICE_MOCK =
  'This software is provided as is, without warranty of any kind. This build runs on an in-memory demo market: nothing is read from Stellar or sent to it, and the tokens shown have no monetary value. Nothing here is an offer to sell, a solicitation to buy, or investment advice.'

/** The footer's legal notice for the build (ruling E23): one paragraph, never both. */
export const legalNotice = (isMock: boolean): string => (isMock ? LEGAL_NOTICE_MOCK : LEGAL_NOTICE)

/** App footer, before the legal notice. */
export const COPYRIGHT_NOTICE = '\u00A9 2026 The StellSec authors.'

/** Footer of every route, after the legal notice: the lines the Stellar brand policy asks for where the name is used. */
export const TRADEMARK_NOTICE =
  '\u201CStellar\u201D is a trademark of the Stellar Development Foundation. All rights reserved. This is independent software, not affiliated with, sponsored or endorsed by the Stellar Development Foundation.'

/** Connect dialog. */
export const WALLET_DISCLOSURE = 'Set the wallet to Testnet. StellSec never asks for your secret key or recovery phrase.'

// ---------------------------------------------------------------------------------------------- covered trades

/** Ticket review of every mode except list (buy, write, request, fill, resale buy); asset About tab (ruling E17). */
export const ISSUER_DISCLOSURE =
  'The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.'

/** Next to the premium in the buy review. */
export const PREMIUM_DISCLOSURE = 'Paid to the maker now. Not refundable.'

/** Next to the price in the resale buy review. */
export const RESALE_PRICE_DISCLOSURE = 'Set by the seller. Paid to the seller now.'

/** Caption of every payoff figure. */
export const PAYOFF_CAPTION = 'Hypothetical payoff at the deadline. Not a quote.'

/**
 * Request ticket. `amount` is the premium with its unit, already formatted: `bidEscrowDisclosure('2.00 USDx')` is
 * `You escrow 2.00 USDx now; refunded if you cancel or it expires.`
 */
export function bidEscrowDisclosure(amount: string): string {
  return `You escrow ${amount} now; refunded if you cancel or it expires.`
}

const SHORTFALL_LEAD = 'Clawback shortfall'
const SHORTFALL_REST = ': payouts are first come, first served until the balance runs out, with no refund, and new trades are refused.'

const codesOf = (tokens: string | readonly string[]): string => (typeof tokens === 'string' ? tokens : tokens.join(', '))

/**
 * Reserves, and any ticket for a token the issuer clawed back from the contract. Takes one token code or several
 * (joined with commas, as the notice above a table does): `clawbackShortfallDisclosure('BOND')` is
 * `Clawback shortfall on BOND: payouts are first come, first served until the balance runs out, with no refund,
 * and new trades are refused.`
 */
export function clawbackShortfallDisclosure(tokens: string | readonly string[]): string {
  return `${SHORTFALL_LEAD} on ${codesOf(tokens)}${SHORTFALL_REST}`
}

/**
 * The same sentence in two parts, for a notice that links its first two words to the Reserves page.
 * `lead + rest` is always exactly `clawbackShortfallDisclosure(tokens)`.
 */
export function clawbackShortfallParts(tokens: string | readonly string[]): { lead: string; rest: string } {
  return { lead: SHORTFALL_LEAD, rest: ` on ${codesOf(tokens)}${SHORTFALL_REST}` }
}

// ---------------------------------------------------------------------------------------------- Margin

/** Margin banner on every Margin screen while it replays fixtures (no Margin contract id in the build). */
export const MARGIN_BANNER_SIMULATED = 'Simulated: this section replays recorded scenarios, and no contract is called.'

/** The payout-risk sentence of Margin (AGENTS.md, "StellSec Pro UI", Copy): on every Margin screen, whatever the build. */
export const MARGIN_PAYOUT_RISK = 'Partial margin: payouts can be reduced; any deficit is shown.'

/** Who sets the prices of Margin: on every Margin screen, whatever the build. */
export const MARGIN_PUBLISHER_LINE = "Prices and the settlement price are set by the team's publisher."

/** Margin banner on every Margin screen when it runs against the deployed contract: the two sentences above. */
export const MARGIN_BANNER_ONCHAIN = `${MARGIN_PAYOUT_RISK} ${MARGIN_PUBLISHER_LINE}`

/** The banner for the build: fixtures when `simulated`, the deployed contract otherwise. */
export const marginBanner = (simulated: boolean): string => (simulated ? MARGIN_BANNER_SIMULATED : MARGIN_BANNER_ONCHAIN)

/** Title of the Margin entry warning dialog. */
export const MARGIN_WARNING_TITLE = 'Margin positions carry default risk'

/** The three bullets of the Margin entry warning, in order. */
export const MARGIN_WARNING_BULLETS = [
  'Partial margin can be liquidated at the published price.',
  'Payouts to holders can be reduced, and any deficit is shown.',
  'The price feed and the settlement price are published by the team, a demo oracle, not a market.',
] as const

/** Label of the checkbox that gates the Margin warning's Continue action. */
export const MARGIN_WARNING_CONSENT = 'I understand'

// ---------------------------------------------------------------------------------------------- register

export interface DisclosureHome {
  id: string
  /** The sentence, or a sample of it for the sentences that carry a figure or a token code. */
  text: string
  /** Where it lives in the app (brief section 6.2). */
  home: string
}

/** One entry per required sentence: what it says and where it lives. Tests walk this list. */
export const DISCLOSURE_HOMES: readonly DisclosureHome[] = [
  { id: 'legal', text: LEGAL_NOTICE, home: 'App footer on every route, contract builds' },
  { id: 'legal-mock', text: LEGAL_NOTICE_MOCK, home: 'App footer on every route, mock builds' },
  { id: 'trademark', text: TRADEMARK_NOTICE, home: 'Footer of every route, after the legal notice' },
  { id: 'issuer', text: ISSUER_DISCLOSURE, home: 'Ticket review of every mode except list (buy, write, request, fill, resale buy); asset About tab' },
  { id: 'premium', text: PREMIUM_DISCLOSURE, home: 'Next to the premium in the buy review' },
  { id: 'resale-price', text: RESALE_PRICE_DISCLOSURE, home: 'Next to the price in the resale buy review' },
  { id: 'payoff-caption', text: PAYOFF_CAPTION, home: 'Caption of every payoff figure' },
  { id: 'clawback-shortfall', text: clawbackShortfallDisclosure('BOND'), home: 'Reserves, and any ticket for that token' },
  { id: 'bid-escrow', text: bidEscrowDisclosure('2.00 USDx'), home: 'Request ticket' },
  { id: 'wallet', text: WALLET_DISCLOSURE, home: 'Connect dialog' },
  { id: 'margin-banner-simulated', text: MARGIN_BANNER_SIMULATED, home: 'Every Margin screen, fixture builds' },
  { id: 'margin-banner-onchain', text: MARGIN_BANNER_ONCHAIN, home: 'Every Margin screen, contract builds' },
  { id: 'margin-warning-1', text: MARGIN_WARNING_BULLETS[0], home: 'Margin entry warning dialog' },
  { id: 'margin-warning-2', text: MARGIN_WARNING_BULLETS[1], home: 'Margin entry warning dialog' },
  { id: 'margin-warning-3', text: MARGIN_WARNING_BULLETS[2], home: 'Margin entry warning dialog' },
]

// ---------------------------------------------------------------------------------------------- banned wording

/**
 * Words and phrases that never appear in interface copy as a promise (brief section 0 rule 3 and section 6.1,
 * AGENTS.md "Claims"). Lower case; match them as whole words with `findBannedWords`.
 */
export const BANNED_WORDS: readonly string[] = [
  'guarantee',
  'guarantees',
  'guaranteed',
  'insure',
  'insured',
  'insurance',
  'safe',
  'safely',
  'safest',
  'secure',
  'securely',
  'fully backed',
  'risk-free',
  'riskless',
  'no risk',
  'zero risk',
  'protect',
  'protects',
  'protected',
  'protection',
  'yield',
  'yields',
  'apy',
  'earn interest',
]

/**
 * Tagline-style disclaimers the interface does not use (owner's direction, 11 Nov 2026). The legal notice in the
 * footer and the network indicator say what needs saying; these slogans are not repeated around the product.
 * Match with `findBannedWords(text, BANNED_TAGLINES)`.
 */
export const BANNED_TAGLINES: readonly string[] = ['testnet only', 'fictional assets', 'no real funds', 'not real funds', 'unaudited', 'demo environment']

/** Never said of a Margin position, on top of `BANNED_WORDS`. */
export const MARGIN_BANNED_WORDS: readonly string[] = [...BANNED_WORDS, 'fully collateralized', 'fully collateralised']

/**
 * Never said of a price: a reference price is always labelled with its source (brief section 0 rule 3, D12).
 * Kept apart from `BANNED_WORDS` because "live" and "oracle" are fine in other contexts ("the live contract").
 */
export const BANNED_PRICE_TERMS: readonly string[] = ['market price', 'oracle price', 'live price', 'spot price', 'real-time price', 'fair value']

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The entries of `words` that occur in `text` as whole words, case-insensitively, in list order. A space in an
 * entry also matches a hyphen and the reverse ("risk-free" finds "risk free"). Longer words do not match:
 * "cash-secured" is not "secure", "unsafe" is not "safe".
 */
export function findBannedWords(text: string, words: readonly string[] = BANNED_WORDS): string[] {
  return words.filter((w) => new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(w).replace(/[ -]/g, '[ \\u00A0-]')}(?![A-Za-z0-9])`, 'i').test(text))
}
