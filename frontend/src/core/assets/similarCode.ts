// Look-alike asset codes. Listing is open, so an asset can reuse or imitate the code of a reference asset or of
// the quote token. The flag is a fact shown beside the asset ("this is not the reference BOND"); it never blocks
// opening or trading it. Asset codes are ASCII letters and digits, so a small confusable table is enough.

import { findReferenceAsset, QUOTE_ASSETS, REFERENCE_ASSETS } from './referenceList'
import type { AssetNetwork } from './referenceList'

/**
 * Confusable skeleton of an asset code: lower case, then the pairs and digits that read as letters are folded
 * (`rn` to `m`, `vv` to `w`, `0` to `o`, `1`, `i` and `|` to `l`, `5` to `s`, `8` to `b`, `2` to `z`).
 */
export function skeleton(code: string): string {
  return code
    .toLowerCase()
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/0/g, 'o')
    .replace(/[1i|]/g, 'l')
    .replace(/5/g, 's')
    .replace(/8/g, 'b')
    .replace(/2/g, 'z')
}

/** True when the edit distance is at most 1 (one substitution, insertion or deletion). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const ra = a.slice(i)
  const rb = b.slice(i)
  return ra.slice(1) === rb.slice(1) || ra.slice(1) === rb || ra === rb.slice(1)
}

export type CodeResemblance = 'same' | 'near'

/**
 * How a code resembles a reference code: `same` when the skeletons are equal (`BOND`, `Bond`, `B0ND`, `8OND`),
 * `near` when they are one edit apart (reference of 4 or more characters) or the reference skeleton is a prefix
 * or suffix with at most 2 extra characters (`BONDS`, `BOND2`, `xBOND`, `RWA1`); null otherwise.
 */
export function codeResemblance(code: string, referenceCode: string): CodeResemblance | null {
  const a = skeleton(code)
  const b = skeleton(referenceCode)
  if (a === b) return 'same'
  if (b.length >= 4 && withinOneEdit(a, b)) return 'near'
  if (b.length >= 3 && a.length - b.length <= 2 && (a.startsWith(b) || a.endsWith(b))) return 'near'
  return null
}

export interface SimilarCodeFlag {
  /** The reference code (or quote token code) this asset's code resembles. */
  reference: string
  level: CodeResemblance
}

/**
 * The similar-code flag of an asset on a network: set when the asset is not itself in the reference list (and is
 * not the quote token) and its code resembles a reference code or the quote token's code. `same` wins over `near`;
 * among equals, list order. Null for reference assets and for codes that resemble nothing.
 */
export function similarCodeFlag(asset: { code: string; contractId: string }, network: AssetNetwork): SimilarCodeFlag | null {
  if (findReferenceAsset(asset.contractId) || asset.contractId === QUOTE_ASSETS[network].contractId) return null
  const candidates = [...REFERENCE_ASSETS[network].map((a) => a.code), QUOTE_ASSETS[network].code]
  let near: SimilarCodeFlag | null = null
  for (const reference of candidates) {
    const level = codeResemblance(asset.code, reference)
    if (level === 'same') return { reference, level }
    if (level === 'near' && !near) near = { reference, level }
  }
  return near
}
