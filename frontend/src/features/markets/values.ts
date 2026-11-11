// Plain values shared by the markets pages (kept apart from the components so fast refresh stays whole).
import { formatUnits, withUnit } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'

/** `99.40 USDx` as plain text, for accessible names and sentences. Truncated, never rounded up. */
export const moneyText = (units: bigint, token: Pick<TokenInfo, 'decimals' | 'code'>): string => withUnit(formatUnits(units, token.decimals), token.code)
