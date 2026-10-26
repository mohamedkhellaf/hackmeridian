// Decode Stellar/Soroban failures into human messages.

// SAC (Stellar Asset Contract) errors.
export const SAC_ERRORS: Record<number, string> = {
  10: 'Insufficient token balance for this action.',
  13: 'Missing trustline for this token. Add a trustline first.',
  11: 'Token balance is deauthorized: the issuer has frozen it or has not authorized your account.',
}

// Options contract errors: docs/contract-abi.md section 2. v1.1+ codes start at 101 so they never collide with
// SAC errors (#1-#13). Error codes are public ABI: never renumber, new codes append at the end.
export const OPTIONS_ERRORS: Record<number, string> = {
  101: 'Option not found.',
  102: 'Invalid request: amounts must be positive, the expiry must be in the future, and you cannot transfer to yourself.',
  103: 'This asset is not supported by the contract.',
  104: 'This account is not authorized to hold this asset (the issuer has not approved it).',
  105: 'The issuer has not authorized the options contract for this asset, so it cannot settle.',
  106: 'This action is not valid for the option in its current state.',
  107: 'Only the option writer can do this.',
  108: 'Only the option holder can do this.',
  109: 'This option has expired.',
  110: 'This option has not expired yet.',
  111: 'The writer cannot be the buyer or the new holder of their own option.',
  112: 'Amount overflow.',
  113: 'Invalid contract configuration.',
  114: 'The market is full: too many open offers. Try again once some are filled or cancelled.',
  115: 'Collateral shortfall: the issuer clawed back tokens held by the contract, so new offers and purchases on this token are paused.',
  116: 'You already have the maximum of 50 open offers. Cancel or wait for some to be bought or expire.',
  117: 'This asset is already listed.',
  118: 'This asset has no Stellar Asset Contract deployed yet, so it cannot be listed.',
  119: 'The expiry is too far out: offers can run for at most 2 years.',
  120: 'This option is no longer for sale: someone else bought it or the seller took it off sale.',
}

// Options codes (101+) and SAC codes (1-13) are disjoint, so a code identifies its source on its own.
function lookupCode(code: number): string | undefined {
  return OPTIONS_ERRORS[code] ?? SAC_ERRORS[code]
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

  const found = [...raw.matchAll(/Error\(Contract,\s*#(\d+)\)/g)].map((m) => ({ code: Number(m[1]) }))
  for (const { code } of found) {
    const msg = lookupCode(code)
    if (msg) return msg
  }
  if (found.length) return `Contract error #${found[0].code}.`

  if (/reject|denied|declined|cancel/.test(lower) || (e instanceof Error && e.name === 'UserRejectedError'))
    return 'You rejected the request in your wallet.'
  if (/wrong network|network passphrase|networkpassphrase|tx_bad_auth/.test(lower))
    return 'Your wallet is on the wrong network. Switch your wallet to Testnet.'
  if (/account not found|tx_no_source_account|txnosourceaccount/.test(lower))
    return 'Account not funded on Testnet. Fund it with friendbot first.'
  if (/tx_insufficient_balance/.test(lower)) return 'Not enough XLM to pay fees and reserves.'
  if (/tx_insufficient_fee|insufficient_fee/.test(lower))
    return 'Fee too low for current network load. Retry the transaction.'
  if (/tx_too_late|txtoolate|expired|timeout|timed out|still pending/.test(lower))
    return 'The transaction expired or timed out. Please try again.'

  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw || 'Unknown error.'
}
