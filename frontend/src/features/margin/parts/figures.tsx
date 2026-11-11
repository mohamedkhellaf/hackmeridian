import type { ReactNode } from 'react'
import { explorerAddress } from '../../../core/explorer'
import type { Party } from '../../../core/pro/types'
import { VAULT } from '../../../core/pro/types'
import { Address, Amount, VisuallyHidden } from '../../../ui'
import { isAddress, partyName } from '../model/names'
import { QUOTE, perLot, usdx, usdxExact } from '../model/money'
import css from './figures.module.css'

/** Where the source has no value: a dash for the eye, words for a screen reader. Never a guess. */
export function NoValue({ label = 'Not available' }: { label?: string }) {
  return (
    <span className={css.none}>
      <span aria-hidden="true">–</span>
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  )
}

export interface UsdxProps {
  v: bigint | null | undefined
  /** Prints the unit after the figure. Leave out where the column header carries it. */
  unit?: boolean
  figure?: 'sans' | 'serif'
  size?: 'md' | 'lg'
  /** Colours a shortfall, debt or deficit and adds the word for it. A zero is never toned. */
  tone?: 'loss'
  /** What a missing value means here ("Known after settlement"). */
  none?: string
  /** What the figure counts, for screen readers. USDx unless it is something else on the same scale (vault shares). */
  counts?: string
  /** A price per lot (a mark, a breakeven): four decimals, so a column of them lines up. */
  perLot?: boolean
}

/** A USDx amount at two decimals, truncated; the exact value is one focus or press away. */
export function Usdx({ v, unit = false, figure = 'sans', size = 'md', tone, none, counts = QUOTE, perLot: lot = false }: UsdxProps) {
  if (v == null) return <NoValue label={none} />
  const negative = v < 0n
  const abs = negative ? -v : v
  const toned = tone === 'loss' && v !== 0n
  const text = `${negative ? '−' : ''}${lot ? perLot(abs) : usdx(abs)}`
  return (
    <span className={css.amount} data-tone={toned ? 'loss' : undefined}>
      <Amount value={text} exact={`${negative ? '−' : ''}${usdxExact(abs)}`} unit={unit ? QUOTE : undefined} figure={figure} size={size} srLabel={`${text} ${counts}`} />
    </span>
  )
}

export interface WhoProps {
  id: Party
  /** The account this page acts as: marked "(you)". */
  me?: Party
  /** `medium` on decision surfaces (dialogs), `short` in tables. */
  length?: 'short' | 'medium'
}

/** A party: the vault by name, a replay party by name, an address shortened with copy and explorer link. */
export function Who({ id, me, length = 'short' }: WhoProps) {
  if (id === VAULT) return <span>Vault</span>
  const you = me !== undefined && me !== '' && id === me
  if (isAddress(id)) return <Address value={id} length={length} you={you} explorerUrl={explorerAddress(id)} />
  return (
    <span className={css.party}>
      {partyName(id)}
      {you ? <span className={css.you}> (you)</span> : null}
    </span>
  )
}

/** The id beside a name ("Series 0", "Position 1"): there for cross-reference, never the first thing read. */
export function Sub({ children }: { children: ReactNode }) {
  return <span className={css.sub}>{children}</span>
}
