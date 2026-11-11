// Plain values shared by the markets pages (kept apart from the components so fast refresh stays whole).
import { findReferenceAsset } from '../../core/assets'
import { formatUnits } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'
import type { DomainGlyph } from '../../ui'

/** `99.40 USDx` as plain text, for accessible names and sentences. Truncated, never rounded up. */
export const moneyText = (units: bigint, token: Pick<TokenInfo, 'decimals' | 'code'>): string => `${formatUnits(units, token.decimals)} ${token.code}`

/** The domain glyph of a reference asset's type; a listed asset outside the list has none. */
export function assetGlyph(contractId: string): DomainGlyph | null {
  return findReferenceAsset(contractId)?.type ?? null
}
