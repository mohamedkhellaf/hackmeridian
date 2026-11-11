/**
 * Sample values for the gallery. They are specimens, not data: fixed so that screenshots are stable, and
 * fictional like every asset and maker on this Testnet deployment.
 */

/** 13 Nov 2026, 08:00 UTC: a Friday, on the standard expiry grid. */
export const SAMPLE_DEADLINE = Date.UTC(2026, 10, 13, 8, 0, 0)

/** A fixed "ledger close time" 2 d 4 h before the deadline, so countdowns do not tick in the gallery. */
export const SAMPLE_NOW = SAMPLE_DEADLINE - (2 * 24 + 4) * 3_600_000

export const SAMPLE_ADDRESS = 'GAJ2RZUNJM6VEZWBZJRZWQ5ZG5OCN7LKN2CJMKE2MJRER52IF2UAVC7G'
export const SAMPLE_CONTRACT = 'CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6'
export const SAMPLE_HASH = 'b3c8fdd1a609e688f2b76b92e9dc9ce3f867062129a09fcc6092e667c7c7808e'
export const EXPLORER = 'https://stellar.expert/explorer/testnet'
