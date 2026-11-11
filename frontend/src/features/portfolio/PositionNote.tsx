// One option as a contract note: serial and the ledger it was read at, the kind with its payoff glyph, every
// term, the counterparty, where the collateral is, the state tag and the deadline in UTC and local time with a
// countdown. The user's own key term sits under the highlighter.
import type { ReactNode } from 'react'
import { config, IS_MOCK } from '../../core/config'
import { explorerAddress, explorerContract, isMockId } from '../../core/explorer'
import { formatExact, formatUnits, groupDigits } from '../../core/format'
import type { Money, OptionOffer } from '../../core/options/types'
import { claimAmount } from '../../core/portfolio/positions'
import type { Role } from '../../core/portfolio/positions'
import { priceOf } from '../../core/reference'
import type { PositionView } from '../../data'
import { Address, Amount, ContractNote, Countdown, DateTime } from '../../ui'
import type { NoteTerm } from '../../ui'
import { CalendarMenu } from './CalendarMenu'
import { NOTE_TERMS } from './copy'
import { MONEYNESS_WORD, glyphOf, money, noteKind, referenceFigure, referenceName, serialOf, stateName, strikeExact, strikeOf, strikeText } from './model'
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
}

const amount = (m: Money, unit: string = m.token.code): ReactNode => (
  <Amount value={formatUnits(m.amount, m.token.decimals)} exact={formatExact(m.amount, m.token.decimals)} unit={unit} figure="serif" />
)

function collateralText(o: OptionOffer, collateral: Money): string {
  const text = money(collateral)
  switch (o.state) {
    case 'offered':
    case 'active':
    case 'expired':
      return `${text} in the contract`
    case 'exercised':
    case 'settled':
      return `${text}, paid out at exercise`
    case 'reclaimed':
    case 'cancelled':
      return `${text}, returned to the writer`
  }
}

function premiumLabel(o: OptionOffer, role: Role | null): string {
  if (role === 'holder') return NOTE_TERMS.premium.holder
  if (role === 'writer') return o.holder ? NOTE_TERMS.premium.writerSold : NOTE_TERMS.premium.writerOpen
  return NOTE_TERMS.premium.none
}

const party = (address: string, me: string | null, label: string): ReactNode => (
  <Address value={address} length="medium" you={address === me} explorerUrl={isMockId(address) ? undefined : explorerAddress(address)} explorerLabel={label} />
)

export function PositionNote({ option: o, position, me, ledger, nowSec }: PositionNoteProps) {
  const role = position?.role ?? null
  const live = (o.state === 'active' || o.state === 'offered') && o.expiry > nowSec
  const perUnit = `${o.quote.code} per ${o.underlying.code}`
  const breakeven = breakevenText(o)
  const collateral = position?.collateral ?? (o.kind === 'put' ? strikeOf(o) : { token: o.underlying, amount: o.underlyingQty })
  const reference = position?.reference ?? null
  const figure = referenceFigure(reference, o.quote)
  const value = position?.exerciseValue ?? null

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
      marked: role === 'writer',
      hint: role === 'holder' ? NOTE_TERMS.premiumHint : undefined,
    },
  ]
  if (breakeven !== null) {
    terms.push({
      label: NOTE_TERMS.breakeven,
      value: <Amount value={breakeven} unit={perUnit} figure="serif" />,
      marked: role === 'holder',
      hint: o.kind === 'put' ? 'Strike less the premium per unit' : 'Strike plus the premium per unit',
    })
  }
  terms.push({
    label: NOTE_TERMS.deadline,
    value: <DateTime value={o.expiry * 1000} local="below" />,
  })
  if (o.state === 'active' && position?.moneyness && reference && priceOf(reference) !== null && figure !== null) {
    terms.push({
      label: NOTE_TERMS.moneyness,
      value: MONEYNESS_WORD[position.moneyness],
      hint: `Reference price ${figure} ${o.quote.code} (${referenceName(reference)}). ${reference.note}`,
    })
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
        hint: 'Exercising now against not exercising, at the reference price. The premium is not counted.',
      })
    }
  }
  if (position?.listing) {
    terms.push({ label: NOTE_TERMS.listing, value: amount({ token: o.quote, amount: position.listing.askTotal }), marked: true, hint: 'Your price. A buyer pays it to you and becomes the holder.' })
  }
  terms.push({ label: NOTE_TERMS.collateral, value: collateralText(o, collateral) })
  if (o.state === 'exercised') {
    terms.push({
      label: role === 'writer' ? NOTE_TERMS.claim : 'Waiting for the writer',
      value: `${money(claimAmount(o))} in the contract`,
      marked: role === 'writer',
    })
  }
  if (role !== 'writer') terms.push({ label: NOTE_TERMS.writer, value: party(o.writer, me, 'View the writer on the explorer') })
  if (role !== 'holder') {
    terms.push({ label: NOTE_TERMS.holder, value: o.holder ? party(o.holder, me, 'View the holder on the explorer') : NOTE_TERMS.noHolder })
  }

  const calendar = role === 'holder' && o.state === 'active' && live ? <CalendarMenu option={o} /> : null
  const contract =
    !IS_MOCK && config.optionsContractId ? (
      <span className={css.contract}>
        <span>Contract</span>
        <Address value={config.optionsContractId} explorerUrl={explorerContract(config.optionsContractId)} explorerLabel="View the contract on the explorer" copyLabel="Copy contract id" />
      </span>
    ) : null

  return (
    <ContractNote
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
