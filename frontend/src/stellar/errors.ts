import { config } from '../config'

// Decode Stellar/Soroban failures into human messages.

// SAC (Stellar Asset Contract) errors.
export const SAC_ERRORS: Record<number, string> = {
  10: 'Insufficient token balance for this action.',
  13: 'Missing trustline for this token. Add a trustline first.',
  11: 'Token balance is deauthorized: the issuer has frozen it or has not authorized your account.',
}

// Options contract errors: docs/contract-abi.md section 2 (public ABI, codes never renumbered).
export const OPTIONS_ERRORS: Record<number, string> = {
  1: 'Option not found.',
  2: 'Invalid offer: amounts must be positive and the expiry must be in the future.',
  3: 'This asset is not supported by the contract.',
  4: 'Your account is not authorized to hold this asset (the issuer has not approved it).',
  5: 'The issuer has not authorized the options contract for this asset yet.',
  6: 'This action is not valid for the option in its current state.',
  7: 'Only the option writer can do this.',
  8: 'Only the option holder can do this.',
  9: 'This option has expired.',
  10: 'This option has not expired yet.',
  11: 'You cannot buy your own offer.',
  12: 'Amount overflow.',
  13: 'Invalid contract configuration.',
}

// Codes 10-13 exist in both tables (options: NotExpired/SelfTrade/Overflow/InvalidConfig; SAC:
// balance/deauthorized/trustline). Error(Contract, #n) carries no contract id, so we look at the
// closest contract id mentioned before it in the diagnostic text.
function lookupCode(raw: string, code: number, at: number): string | undefined {
  const opt = OPTIONS_ERRORS[code]
  const sac = SAC_ERRORS[code]
  if (opt && !sac) return opt
  if (sac && !opt) return sac
  if (!opt || !sac) return undefined
  const ids = [...raw.slice(0, at).matchAll(/C[A-Z2-7]{55}/g)]
  const last = ids[ids.length - 1]?.[0]
  if (last && config.optionsContractId) return last === config.optionsContractId ? opt : sac
  return `${opt} (or, if raised by the token contract: ${sac})`
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

export function describeError(e: unknown): string {
  const raw = messageOf(e)
  const lower = raw.toLowerCase()

  // Contract codes first: a diagnostic string may also contain words like "expired".
  // SAC reports a missing account/trustline as Error(Contract, #6)/#13 with this text; #6 would
  // otherwise collide with the options table, so match the text first.
  if (/account entry is missing/.test(lower)) return 'Account not funded on Testnet. Fund it with friendbot first.'
  if (/trustline entry is missing/.test(lower)) return 'Missing trustline for this token. Add a trustline first.'

  const found = [...raw.matchAll(/Error\(Contract,\s*#(\d+)\)/g)].map((m) => ({ code: Number(m[1]), at: m.index ?? 0 }))
  for (const { code, at } of found) {
    const msg = lookupCode(raw, code, at)
    if (msg) return msg
  }
  if (found.length) return `Contract error #${found[0].code}.`

  if (/reject|denied|declined|cancel/.test(lower) || (e instanceof Error && e.name === 'UserRejectedError'))
    return 'You rejected the request in your wallet.'
  if (/wrong network|network passphrase|networkpassphrase|tx_bad_auth/.test(lower))
    return 'Your wallet is on the wrong network. Switch Freighter to Testnet.'
  if (/account not found|tx_no_source_account|txnosourceaccount/.test(lower))
    return 'Account not funded on Testnet. Fund it with friendbot first.'
  if (/tx_insufficient_balance/.test(lower)) return 'Not enough XLM to pay fees and reserves.'
  if (/tx_insufficient_fee|insufficient_fee/.test(lower))
    return 'Fee too low for current network load. Retry the transaction.'
  if (/tx_too_late|txtoolate|expired|timeout|timed out|still pending/.test(lower))
    return 'The transaction expired or timed out. Please try again.'

  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw || 'Unknown error.'
}
