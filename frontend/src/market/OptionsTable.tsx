import type { OptionOffer } from '../options/types'
import { formatExpiry, strikePerUnit } from '../options/format'
import {
  actionKindOf,
  actionLabel,
  counterpartyLine,
  expirySub,
  moneyWith,
  nowMs,
  premiumOf,
  roleOf,
  statusOf,
} from '../portfolio/positions'
import type { Role } from '../portfolio/positions'
import { Button, Tag } from '../ui'
import '../portfolio/portfolio.css'

export interface RowAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

function StatusText({ o, role }: { o: OptionOffer; role: Role }) {
  const s = statusOf(o, role)
  return (
    <span className={`pf-status pf-status--${s.tone}`}>
      <i aria-hidden="true" />
      {s.label}
    </span>
  )
}

/** The button label: the in-flight label from the runner ("Exercising…") wins, else the explicit payout label. */
function buttonLabel(o: OptionOffer, role: Role, action: RowAction): string {
  if (action.label.endsWith('…')) return action.label
  const kind = actionKindOf(o, role)
  return kind ? actionLabel(o, kind) : action.label
}

function ActionButton({ o, role, action, full }: { o: OptionOffer; role: Role; action?: RowAction; full?: boolean }) {
  if (!action) return null
  const kind = actionKindOf(o, role)
  return (
    <Button
      variant={kind === 'cancel' ? 'secondary' : 'primary'}
      size={full ? 'lg' : 'md'}
      fullWidth={full}
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.disabled ? 'Another transaction is in progress' : undefined}
    >
      {buttonLabel(o, role, action)}
    </Button>
  )
}

function Title({ o }: { o: OptionOffer }) {
  return (
    <span className="pf-title">
      {o.underlying.code} <Tag tone={o.kind}>{o.kind}</Tag> {strikePerUnit(o)}
    </span>
  )
}

const roleText = (r: Role) => (r === 'holder' ? 'Holder' : 'Writer')

/** One desktop table row. `me` decides the role (holder or writer) and therefore the signs and labels. */
export function OptionRow({ o, me, action }: { o: OptionOffer; me: string | null; action?: RowAction }) {
  const role = roleOf(o, me)
  if (!role) return null
  const prem = premiumOf(o, role)
  const now = nowMs()
  return (
    <tr>
      <td>
        <Title o={o} />
        <span className="ui-sub">{counterpartyLine(o, role)}</span>
      </td>
      <td className="ui-left">{roleText(role)}</td>
      <td>{moneyWith(o.underlyingQty, o.underlying)}</td>
      <td>{moneyWith(o.totalStrike, o.quote)}</td>
      <td className={`pf-prem pf-prem--${prem.tone}`}>{prem.text}</td>
      <td>
        {formatExpiry(o.expiry)}
        <span className="ui-sub">{expirySub(o, now)}</span>
      </td>
      <td>
        <StatusText o={o} role={role} />
        {/* Raw contract state, visually hidden: the buy e2e spec reads `.state`. The visible label is above. */}
        <span className="state pf-sr" aria-hidden="true">
          {o.state}
        </span>
      </td>
      <td>
        <ActionButton o={o} role={role} action={action} />
      </td>
    </tr>
  )
}

/** One mobile card (shown instead of the table at <= 768px). */
export function OptionCard({ o, me, action }: { o: OptionOffer; me: string | null; action?: RowAction }) {
  const role = roleOf(o, me)
  if (!role) return null
  const prem = premiumOf(o, role)
  return (
    <article className="pf-card">
      <div className="pf-card-head">
        <Title o={o} />
        <span className="pf-card-role">{roleText(role)}</span>
      </div>
      <div className="pf-card-line">
        <span>
          {moneyWith(o.underlyingQty, o.underlying)} → {moneyWith(o.totalStrike, o.quote)}
        </span>
        <span>{expirySub(o, nowMs())}</span>
      </div>
      <div className="pf-card-line">
        <span>
          Premium <span className={`pf-prem--${prem.tone}`}>{prem.text}</span>
        </span>
        <span>{formatExpiry(o.expiry)}</span>
      </div>
      <StatusText o={o} role={role} />
      <ActionButton o={o} role={role} action={action} full />
    </article>
  )
}

export function OptionsTable({
  rows,
  me,
  actionFor,
  empty,
}: {
  rows: OptionOffer[]
  me: string | null
  actionFor: (o: OptionOffer) => RowAction | undefined
  empty?: string
}) {
  if (rows.length === 0) return <p className="pf-empty">{empty ?? 'Nothing here yet.'}</p>
  return (
    <>
      <div className="pf-table ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Option</th>
              <th className="ui-left">Role</th>
              <th>Size</th>
              <th>Total strike</th>
              <th>Premium</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>
                <span className="pf-sr">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <OptionRow key={o.id.toString()} o={o} me={me} action={actionFor(o)} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="pf-cards">
        {rows.map((o) => (
          <OptionCard key={o.id.toString()} o={o} me={me} action={actionFor(o)} />
        ))}
      </div>
    </>
  )
}
