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
  102: 'The contract refused the terms: amounts must be above zero, the deadline in the future, and a transfer must go to another account.',
  103: 'This asset is not supported by the contract.',
  104: 'This account is not authorized to hold this asset (the issuer has not approved it).',
  105: 'The issuer has not authorized the Covered contract for this asset, so it cannot settle.',
  106: 'The option changed before your transaction landed: it was bought, cancelled, exercised or has expired. Open it again to see where it stands.',
  107: 'Only the maker of this option can do this.',
  108: 'Only the option holder can do this.',
  109: 'This option has expired.',
  110: 'This option has not expired yet.',
  111: 'The maker cannot buy or hold their own option.',
  112: 'An amount is too large for the contract. Lower the quantity or the strike.',
  113: 'The contract was deployed with settings it does not accept.',
  114: 'The market is full: too many open offers. Try again once some are filled or cancelled.',
  115: 'Clawback shortfall: the issuer took back tokens held by the contract, so new trades on this token are refused.',
  116: 'You already have 50 open offers, the most one account can have. Cancel one, or wait for one to be bought or to expire.',
  117: 'This asset is already listed.',
  118: 'This asset has no Stellar Asset Contract deployed yet, so it cannot be listed.',
  119: 'The deadline is too far out: at most 2 years from now.',
  120: 'This option is no longer for sale (bought, withdrawn, exercised or transferred).',
  121: 'The seller changed the price. Review the new price before buying.',
  122: 'This request is no longer open (filled, cancelled or expired).',
  123: 'Only the buyer who posted this request can do this.',
  124: 'The request book is full: too many open requests. Try again once some are filled or cancelled.',
  125: 'You already have 50 open requests, the most one account can have. Cancel one, or wait for one to be filled or to expire.',
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

const NOT_FUNDED = 'Account not funded on Testnet. Fund it with Friendbot first.'

/** A request that never reached the network, or a part of this app that could not be loaded. */
export const NETWORK_UNREACHABLE = 'The network could not be reached.'

export function describeError(e: unknown): string {
  const raw = messageOf(e)
  const lower = raw.toLowerCase()

  // Contract codes first: a diagnostic string may also contain words like "expired".
  // SAC reports a missing account/trustline as Error(Contract, #6)/#13 with this text; #6 would
  // otherwise collide with the options table, so match the text first.
  if (/account entry is missing/.test(lower)) return NOT_FUNDED
  if (/trustline entry is missing/.test(lower)) return 'Missing trustline for this token. Add a trustline first.'

  const found = [...raw.matchAll(/Error\(Contract,\s*#(\d+)\)/g)].map((m) => ({ code: Number(m[1]) }))
  for (const { code } of found) {
    const msg = lookupCode(code)
    if (msg) return msg
  }
  if (found.length) return `Contract error #${found[0].code}.`

  // A fetch that never got an answer, or a code chunk that could not be loaded: say so, never print the URL.
  if (/failed to fetch|networkerror|network error|load failed|dynamically imported module|importing a module script failed|err_internet_disconnected/.test(lower))
    return NETWORK_UNREACHABLE

  if (/reject|denied|declined|cancel/.test(lower) || (e instanceof Error && e.name === 'UserRejectedError'))
    return 'You declined to sign in your wallet.'
  // tx_bad_auth: the signature does not match the source account for this network. Either cause is possible.
  if (/tx_bad_auth|txbadauth/.test(lower))
    return 'The signature does not match: the wallet signed with another account, or for another network, than this app uses. Check both in your wallet.'
  if (/wrong network|network passphrase|networkpassphrase/.test(lower))
    return 'Your wallet is on the wrong network. Switch your wallet to Testnet.'
  if (/account not found|tx_no_source_account|txnosourceaccount/.test(lower))
    return NOT_FUNDED
  if (/tx_insufficient_balance|txinsufficientbalance/.test(lower)) return 'Not enough XLM to pay fees and reserves.'
  if (/tx_insufficient_fee|insufficient_fee|txinsufficientfee/.test(lower))
    return 'Fee too low for current network load. Nothing was charged; send it again.'
  if (/tx_bad_seq|txbadseq/.test(lower))
    return 'Another transaction from this account went first, so this one was not accepted. Nothing was charged; sign it again.'
  // Rejected for its time bound before any ledger: nothing was sent on, so signing again is harmless.
  if (/tx_too_late|txtoolate|tx_too_early|txtooearly/.test(lower))
    return 'The time limit of this transaction passed before the network accepted it. Nothing was charged; sign it again.'
  // A timeout says nothing about the outcome: the transaction may still be included. Never suggest sending again here.
  if (/timeout|timed out|still pending|not confirmed yet/.test(lower))
    return 'Not confirmed yet. The transaction may still be included; check again before sending another.'
  if (/expired/.test(lower)) return 'The transaction expired without being included. Nothing was charged.'

  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw || 'Unknown error.'
}
