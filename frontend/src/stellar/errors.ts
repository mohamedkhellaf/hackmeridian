// Decode Stellar/Soroban failures into human messages. Update the tables below when the
// final options contract error codes are published.

// SAC (Stellar Asset Contract) errors.
export const SAC_ERRORS: Record<number, string> = {
  10: 'Insufficient token balance for this action.',
  13: 'Missing trustline for this token. Add a trustline first.',
  11: 'Token balance is deauthorized: the issuer has frozen it or has not authorized your account.',
}

// Options contract errors (spike codes; final contract may differ).
export const OPTIONS_ERRORS: Record<number, string> = {
  1: 'Option not found.',
  2: 'This option has expired.',
  3: 'This option has not expired yet.',
  4: 'This option is already settled.',
  5: 'Only the option writer can do this.',
  6: 'Invalid arguments for this option.',
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

  const codes = [...raw.matchAll(/Error\(Contract,\s*#(\d+)\)/g)].map((m) => Number(m[1]))
  for (const c of codes) {
    // SAC codes (>= 10) don't overlap the options table, so one lookup order is enough.
    const msg = SAC_ERRORS[c] ?? OPTIONS_ERRORS[c]
    if (msg) return msg
  }
  if (codes.length) return `Contract error #${codes[0]}.`

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
