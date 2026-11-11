// Small adapters between exact core values and the ui kit, shared by the markets pages.
import { Link as RouterLink } from '@tanstack/react-router'
import { IS_MOCK } from '../../core/config'
import { clawbackShortfallParts } from '../../core/disclosures'
import { explorerAddress, isMockId } from '../../core/explorer'
import { formatExact, formatUnits } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'
import { Address, Amount, Callout, IconChevronLeft, Link } from '../../ui'
import type { AddressProps, AmountProps } from '../../ui'
import { BACK_TO_MARKETS } from './copy'
import { MARKETS_ROUTE, RESERVES_ROUTE } from './routing'
import styles from './parts.module.css'

export interface MoneyProps extends Omit<AmountProps, 'value' | 'exact' | 'unit'> {
  /** Exact token units. */
  units: bigint
  token: Pick<TokenInfo, 'decimals' | 'code'>
  /** Leave the unit out where a column header carries it. */
  bare?: boolean
}

/** An exact amount: truncated to two decimals on screen, every digit one press away. */
export function Money({ units, token, bare = false, ...rest }: MoneyProps) {
  return <Amount {...rest} value={formatUnits(units, token.decimals)} exact={formatExact(units, token.decimals)} unit={bare ? undefined : token.code} />
}

/**
 * An account or contract id with copy, and an explorer link when there is a page to open: never in a build that
 * runs on mock data (nothing in it is on a chain), and never for a mock placeholder id.
 */
export function ChainId({ value, ...rest }: Omit<AddressProps, 'explorerUrl'>) {
  return <Address {...rest} value={value} explorerUrl={IS_MOCK || isMockId(value) ? undefined : explorerAddress(value)} />
}

/** The way back to the Markets index, above the head of an asset page. */
export function BackToMarkets() {
  return (
    <Link tone="quiet" className={styles.back} render={<RouterLink to={MARKETS_ROUTE} />}>
      <IconChevronLeft size={14} />
      {BACK_TO_MARKETS}
    </Link>
  )
}

/**
 * The clawback shortfall sentence (core/disclosures, verbatim) for the tokens that are short, with its first
 * words linked to Reserves, where the figures are. Renders nothing when no token is short.
 */
export function ShortfallNotice({ tokens }: { tokens: ReadonlyArray<Pick<TokenInfo, 'code'>> }) {
  if (tokens.length === 0) return null
  const { lead, rest } = clawbackShortfallParts(tokens.map((t) => t.code))
  return (
    <Callout variant="danger">
      <Link render={<RouterLink to={RESERVES_ROUTE} />}>{lead}</Link>
      {rest}
    </Callout>
  )
}
