// One option as a contract note: serial and the ledger it was read at, the kind with its payoff glyph, every
// term, the other side, where the collateral is, the state tag and the deadline in UTC and local time with a
// countdown. One figure sits under the highlighter: the one at stake now.
import type { ReactNode } from 'react'
import { config, IS_MOCK } from '../../core/config'
import { explorerAddress, explorerContract, isMockId } from '../../core/explorer'
import { formatExact, formatUnits, groupDigits } from '../../core/format'
import type { Money, OptionOffer, TokenInfo } from '../../core/options/types'
import { claimAmount } from '../../core/portfolio/positions'
import type { Role } from '../../core/portfolio/positions'
import { priceOf } from '../../core/reference'
import type { PositionView } from '../../data'
import { Address, Amount, ContractNote, Countdown, DateTime } from '../../ui'
import type { NoteTerm } from '../../ui'
import { CalendarMenu } from './CalendarMenu'
import { NOTE_TERMS, strikeAgainst } from './copy'
import { isShort } from './hooks'
import { MONEYNESS_WORD, glyphOf, money, noteKind, premiumPerUnitLine, referenceFigure, serialOf, stateName, strikeExact, strikeOf, strikeText } from './model'
import { breakevenText } from './payoff'
import css from './PositionNote.module.css'

export interface PositionNoteProps {
  option: OptionOffer
  /** The connected wallet's view, or null for a guest and for a wallet that is on neither side. */
  position: PositionView | null
  me: string | null
  /** The latest ledger, when the build reads a chain. */
  ledger: number | null
  nowSec: number
  /** This browser bought the option from its previous holder: the original premium is not the holder's cost. */
  resold?: boolean
  /** The live resale price of the option, for a viewer who is not its holder. */
  listedAt?: bigint | null
  /** Tokens the contract holds less of than it owes. */
  short?: readonly TokenInfo[]
}

const amount = (m: Money): ReactNode => <Amount value={formatUnits(m.amount, m.token.decimals)} exact={formatExact(m.amount, m.token.decimals)} unit={m.token.code} figure="serif" />

function premiumLabel(o: OptionOffer, role: Role | null): string {
  if (role === 'holder') return NOTE_TERMS.premium.holder
  if (role === 'writer') return o.holder ? NOTE_TERMS.premium.writerSold : NOTE_TERMS.premium.writerOpen
  return NOTE_TERMS.premium.none
}

/** Where the collateral is, as the row label: the figure beside it is the amount alone. */
function collateralLabel(o: OptionOffer, short: boolean): string {
  switch (o.state) {
    case 'offered':
    case 'active':
    case 'expired':
      // Short of this token, the contract owes the amount but may not hold it all.
      return short ? NOTE_TERMS.collateral.owed : NOTE_TERMS.collateral.held
    case 'exercised':
    case 'settled':
      return NOTE_TERMS.collateral.paidOut
    case 'reclaimed':
    case 'cancelled':
      return NOTE_TERMS.collateral.returned
  }
}

const party = (address: string, me: string | null, label: string): ReactNode => (
  <Address value={address} length="medium" you={address === me} explorerUrl={IS_MOCK || isMockId(address) ? undefined : explorerAddress(address)} explorerLabel={label} />
)

/** The figure at stake now: what waits to be claimed, else the listing price, else the holder's breakeven or the maker's premium. */
type Mark = 'claim' | 'listing' | 'breakeven' | 'premium' | null

export function PositionNote({ option: o, position, me, ledger, nowSec, resold = false, listedAt = null, short = [] }: PositionNoteProps) {
  const role = position?.role ?? null
  const live = (o.state === 'active' || o.state === 'offered') && o.expiry > nowSec
  const perUnit = `${o.quote.code} per ${o.underlying.code}`
  // A breakeven from the original premium is not the holder's own when it bought the option from a holder.
  const breakeven = role === 'holder' && resold ? null : breakevenText(o)
  const collateral = position?.collateral ?? (o.kind === 'put' ? strikeOf(o) : { token: o.underlying, amount: o.underlyingQty })
  const reference = position?.reference ?? null
  const figure = referenceFigure(reference, o.quote)
  const value = position?.exerciseValue ?? null
  const listing = position?.listing?.askTotal ?? listedAt
  const claimWaits = o.state === 'exercised'

  const ongoing = o.state === 'offered' || o.state === 'active'
  const mark: Mark =
    claimWaits && role === 'writer'
      ? 'claim'
      : !ongoing
        ? null
        : listing !== null && role === 'holder'
          ? 'listing'
          : role === 'holder' && breakeven !== null
            ? 'breakeven'
            : role === 'writer'
              ? 'premium'
              : null

  const terms: NoteTerm[] = [
    { label: NOTE_TERMS.quantity, value: amount({ token: o.underlying, amount: o.underlyingQty }) },
    {
      label: NOTE_TERMS.strike,
      value: <Amount value={strikeText(o)} exact={strikeExact(o)} unit={perUnit} figure="serif" />,
      hint: `${money(strikeOf(o))} in total`,
    },
    {
      label: premiumLabel(o, role),
      value: amount({ token: o.quote, amount: o.totalPremium }),
      marked: mark === 'premium',
      hint: [premiumPerUnitLine(o), role === 'holder' ? (resold ? NOTE_TERMS.resoldHint : NOTE_TERMS.premiumHint) : null].filter(Boolean).join('. ') || undefined,
    },
  ]
  if (breakeven !== null) {
    terms.push({ label: NOTE_TERMS.breakeven, value: <Amount value={breakeven} unit={perUnit} figure="serif" />, marked: mark === 'breakeven' })
  }
  terms.push({ label: NOTE_TERMS.deadline, value: <DateTime value={o.expiry * 1000} local="below" /> })
  if (o.state === 'active' && position?.moneyness && reference && priceOf(reference) !== null && figure !== null) {
    terms.push({ label: NOTE_TERMS.moneyness, value: MONEYNESS_WORD[position.moneyness], hint: strikeAgainst(position) ?? undefined })
    if (role === 'holder' && value !== null) {
      const magnitude = value < 0n ? -value : value
      terms.push({
        label: NOTE_TERMS.exerciseValue,
        value:
          value === 0n ? (
            amount({ token: o.quote, amount: 0n })
          ) : (
            <Amount
              value={formatUnits(magnitude, o.quote.decimals)}
              exact={formatExact(magnitude, o.quote.decimals)}
              unit={o.quote.code}
              direction={value > 0n ? 'gain' : 'loss'}
              figure="serif"
            />
          ),
        hint: NOTE_TERMS.exerciseValueHint,
      })
    }
  }
  if (listing !== null && o.state === 'active') {
    terms.push({ label: NOTE_TERMS.listing, value: amount({ token: o.quote, amount: listing }), marked: mark === 'listing' })
  }
  terms.push({ label: collateralLabel(o, isShort(collateral.token, short)), value: amount(collateral) })
  if (claimWaits) terms.push({ label: role === 'writer' ? NOTE_TERMS.claim : NOTE_TERMS.claimOther, value: amount(claimAmount(o)), marked: mark === 'claim' })
  if (role !== 'writer') terms.push({ label: NOTE_TERMS.maker, value: party(o.writer, me, 'View the maker on the explorer') })
  if (role !== 'holder') {
    terms.push({ label: NOTE_TERMS.holder, value: o.holder ? party(o.holder, me, 'View the holder on the explorer') : NOTE_TERMS.noHolder })
  }

  // The holder must exercise by the deadline; the maker has something to claim or reclaim after it.
  const calendar = role !== null && o.state === 'active' && live ? <CalendarMenu option={o} role={role} /> : null
  const contract =
    !IS_MOCK && config.optionsContractId ? (
      <span className={css.contract}>
        <span>Contract</span>
        <Address value={config.optionsContractId} explorerUrl={explorerContract(config.optionsContractId)} explorerLabel="View the contract on the explorer" copyLabel="Copy contract id" />
      </span>
    ) : null

  return (
    <ContractNote
      className={css.note}
      serial={serialOf(o.id)}
      ledger={ledger !== null ? groupDigits(String(ledger)) : undefined}
      glyph={glyphOf(o.kind, role)}
      kind={noteKind(o, role)}
      headingLevel={2}
      state={stateName(o)}
      aside={live ? <Countdown to={o.expiry * 1000} warnBelowMs={(position?.role === 'holder' && position.moneyness === 'in' ? 48 : 2) * 3_600_000} label="Time left" /> : undefined}
      terms={terms}
      footer={
        calendar || contract ? (
          <>
            {calendar}
            {contract}
          </>
        ) : undefined
      }
    />
  )
}
