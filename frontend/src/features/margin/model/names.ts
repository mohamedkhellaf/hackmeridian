// Names: how a series, a party, a replayed scenario and a contract call read on screen. Presentation only.
import { formatUtcDate } from '../../../core/format'
import type { Party, SeriesView } from '../../../core/pro/types'
import { PRO_UNDERLYING, VAULT } from '../../../core/pro/types'
import { usdx } from './money'

/** The underlying of the Margin market (one per deployment): see `PRO_UNDERLYING` in core/pro/types. */
export const UNDERLYING = PRO_UNDERLYING

/** `EQTY 110.00 call`. */
export function contractName(s: SeriesView | undefined): string {
  return s ? `${UNDERLYING} ${usdx(s.strike)} call` : `${UNDERLYING} call`
}

/** `EQTY 110.00 call, 5 Feb 2027`: enough to tell two series apart in a list. */
export function contractTitle(s: SeriesView | undefined): string {
  return s ? `${contractName(s)}, ${formatUtcDate(s.expiry)}` : contractName(s)
}

const isAccountId = (id: string) => /^[GC][A-Z2-7]{55}$/.test(id)

/** True for a Stellar address (the live contract); false for a party name of the replay. */
export function isAddress(id: Party): boolean {
  return isAccountId(id)
}

/**
 * A replay party as a name: `MAKER_A` is `Maker A`, `LP1` is `LP 1`, `ALICE` is `Alice`. Addresses are left
 * alone (the Address component shortens them).
 */
export function partyName(id: Party): string {
  if (id === VAULT) return 'Vault'
  if (isAccountId(id) || !/^[A-Z][A-Z0-9_]*$/.test(id)) return id
  return id
    .split('_')
    .map((word) => {
      const m = /^([A-Z]+?)(\d+)$/.exec(word)
      const [letters, digits] = m ? [m[1], m[2]] : [word, '']
      const text = letters.length <= 2 ? letters : letters[0] + letters.slice(1).toLowerCase()
      return digits ? `${text} ${digits}` : text
    })
    .join(' ')
}

const sentenceCase = (id: string) => {
  const text = id.replace(/_/g, ' ').trim()
  return text ? text[0].toUpperCase() + text.slice(1) : id
}


export { scenarioCopy } from '../../../core/pro/scenarios'
export type { ScenarioCopy } from '../../../core/pro/scenarios'

/** A contract call as an action in words. */
const CALLS: Record<string, string> = {
  list_series: 'List a series',
  publish_risk: 'Publish a price snapshot',
  publish_settlement: 'Publish the settlement price',
  deposit: 'Deposit margin',
  withdraw: 'Withdraw margin',
  create_offer: 'Write a call',
  cancel_offer: 'Cancel an offer',
  buy: 'Buy a call',
  exercise: 'Exercise early',
  liquidate: 'Take over an account',
  settle: 'Settle a book',
  settle_vault: 'Settle a series',
  claim: 'Claim',
  lp_deposit: 'Deposit to the vault',
  set_time: 'Move the clock forward',
  get_requirement: 'Read the margin requirement',
}

export function callName(op: string): string {
  return CALLS[op] ?? sentenceCase(op)
}
