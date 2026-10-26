import type { CollateralHealth, OptionOffer } from '../options/types'
import { shortfallFor } from '../reserves/reserves'
import { ShortfallNotice } from '../reserves/ShortfallWarning'
import { formatDisplay, shortAddress, strikePerUnit } from '../options/format'
import { formatCountdown, formatExpiryShort } from './series'
import { actionKindOf, money, nowMs, roleOf } from '../portfolio/positions'
import type { ActionKind, Role } from '../portfolio/positions'
import { Button, Mono, Tag } from '../ui'
import '../portfolio/portfolio.css'

export interface RowAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

const COLUMNS = 10

/** The on-chain lifecycle word. Settled stays Settled; an expired option shows Expired whether or not it was reclaimed. */
function stateWord(o: OptionOffer): string {
  switch (o.state) {
    case 'offered':
      return 'Offered'
    case 'active':
      return 'Active'
    case 'exercised':
      return 'Exercised'
    case 'settled':
      return 'Settled'
    case 'expired':
    case 'reclaimed':
      return 'Expired'
    case 'cancelled':
      return 'Cancelled'
  }
}

const BUTTON: Record<ActionKind, string> = {
  exercise: 'Exercise',
  cancel: 'Cancel offer',
  claim: 'Claim delivery',
  reclaim: 'Reclaim',
}

/** The in-flight label from the runner ("Exercising…") wins, else the contract action name. */
function buttonLabel(kind: ActionKind | null, action: RowAction): string {
  if (action.label.endsWith('…')) return action.label
  return kind ? BUTTON[kind] : action.label
}

// Display only: premium per one unit of underlying.
function premiumPerUnit(o: OptionOffer): string {
  if (o.underlyingQty === 0n) return '–'
  return formatDisplay((o.totalPremium * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty, o.quote.decimals)
}

/** The other side of the position: the maker for a held option, the buyer (if any) for a written one. */
function counterparty(o: OptionOffer, role: Role): string | null {
  return role === 'holder' ? o.writer : o.holder
}

/** One table row. `me` decides the role (holder or writer) and therefore the action. */
export function OptionRow({
  o,
  me,
  action,
  health = [],
  cellUnit = '',
}: {
  o: OptionOffer
  me: string | null
  action?: RowAction
  health?: CollateralHealth[]
  /** Unit after each quote amount, only when the header cannot carry it (mixed quote tokens). */
  cellUnit?: string
}) {
  const role: Role | null = roleOf(o, me)
  if (!role) return null
  const kind = actionKindOf(o, role)
  const short = shortfallFor(o, health)
  const live = o.state === 'offered' || o.state === 'active'
  const other = counterparty(o, role)
  // On phones the action column drops out and the button takes the state word's place (the button implies the state).
  const button = action ? (
    <Button
      size="sm"
      variant="secondary"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.disabled ? 'Another transaction is in progress' : undefined}
    >
      {buttonLabel(kind, action)}
    </Button>
  ) : null
  return (
    <>
      <tr>
        <td>{o.underlying.code}</td>
        <td>{o.kind === 'put' ? 'Put' : 'Call'}</td>
        <td className="num">{money(o.underlyingQty, o.underlying.decimals)}</td>
        <td className="num">
          {strikePerUnit(o)}
          {cellUnit}
        </td>
        <td className="pf-exp">
          <span>{formatExpiryShort(o.expiry)}</span>
          {live && (
            <>
              {' '}
              <span className="pf-cd">{formatCountdown(o.expiry, nowMs())}</span>
            </>
          )}
        </td>
        <td className="num hide-sm">
          {premiumPerUnit(o)}
          {cellUnit}
        </td>
        <td className="num hide-sm">
          {money(o.totalPremium, o.quote.decimals)}
          {cellUnit}
        </td>
        <td className="hide-sm">{other ? <Mono>{shortAddress(other)}</Mono> : null}</td>
        <td>
          <Tag tone="neutral" className={button ? 'pf-tag-act' : undefined}>
            {stateWord(o)}
          </Tag>
          {button && <span className="pf-act-sm">{button}</span>}
        </td>
        <td className="num pf-act hide-sm">{button}</td>
      </tr>
      {short.length > 0 && (
        <tr className="pf-short">
          <td colSpan={COLUMNS}>
            <ShortfallNotice tokens={short} />
          </td>
        </tr>
      )}
    </>
  )
}

/** Positions table. Column order matches Markets; on phones Premium, Total, the counterparty and the action column drop out. */
export function OptionsTable({
  rows,
  me,
  actionFor,
  health = [],
  label,
  counterpartyLabel = 'Maker',
}: {
  rows: OptionOffer[]
  me: string | null
  actionFor: (o: OptionOffer) => RowAction | undefined
  health?: CollateralHealth[]
  /** Accessible name of the table (the section heading). */
  label: string
  /** Header of the counterparty column: `Maker` for held options, `Buyer` for written ones. */
  counterpartyLabel?: string
}) {
  const quotes = new Set(rows.map((o) => o.quote.code))
  // One quote token on screen: its unit goes in the header once, not after every number.
  const unit = quotes.size === 1 ? ` (${rows[0].quote.code})` : ''
  const cellUnit = (o: OptionOffer) => (unit ? '' : ` ${o.quote.code}`)
  return (
    <div className="ui-table-wrap pf-table">
      <table className="ui-table" aria-label={label}>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Kind</th>
            <th className="num">Qty</th>
            <th className="num">Strike{unit}</th>
            <th>Expiry</th>
            <th className="num hide-sm">Premium{unit}</th>
            <th className="num hide-sm" title="Total premium">
              Total{unit}
            </th>
            <th className="hide-sm">{counterpartyLabel}</th>
            <th>State</th>
            <th className="num hide-sm">
              <span className="pf-sr">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <OptionRow key={o.id.toString()} o={o} me={me} action={actionFor(o)} health={health} cellUnit={cellUnit(o)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
