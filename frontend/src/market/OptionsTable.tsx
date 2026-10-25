import type { OptionOffer } from '../options/types'
import { formatAmount, formatExpiry, shortAddress, strikePerUnit } from '../options/format'

export function OptionRow({
  o,
  action,
}: {
  o: OptionOffer
  action?: { label: string; onClick: () => void; disabled?: boolean }
}) {
  return (
    <tr>
      <td>
        <span className={`kind kind-${o.kind}`}>{o.kind.toUpperCase()}</span>
      </td>
      <td>
        {formatAmount(o.underlyingQty, o.underlying.decimals)} {o.underlying.code}
      </td>
      <td>
        {strikePerUnit(o)} {o.quote.code}
      </td>
      <td>
        {formatAmount(o.totalStrike, o.quote.decimals)} {o.quote.code}
      </td>
      <td>
        {formatAmount(o.totalPremium, o.quote.decimals)} {o.quote.code}
      </td>
      <td>{formatExpiry(o.expiry)}</td>
      <td className="mono">{shortAddress(o.writer)}</td>
      <td>
        <span className={`state state-${o.state}`}>{o.state}</span>
      </td>
      <td>
        {action && (
          <button type="button" onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </button>
        )}
      </td>
    </tr>
  )
}

export function OptionsTable({ rows, actionFor }: { rows: OptionOffer[]; actionFor: (o: OptionOffer) => Parameters<typeof OptionRow>[0]['action'] }) {
  if (rows.length === 0) return <p className="empty">Nothing here yet.</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Underlying</th>
            <th>Strike / unit</th>
            <th>Total strike</th>
            <th>Premium</th>
            <th>Expiry</th>
            <th>Writer</th>
            <th>State</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <OptionRow key={o.id.toString()} o={o} action={actionFor(o)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
