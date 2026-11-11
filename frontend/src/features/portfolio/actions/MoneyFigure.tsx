// An exact amount on a dialog or a receipt: the figure in the serif and the unit in the sans, as on the note.
import { formatExact, formatUnits } from '../../../core/format'
import type { Money } from '../../../core/options/types'
import { Amount } from '../../../ui'

export function MoneyFigure({ m }: { m: Money }) {
  return <Amount value={formatUnits(m.amount, m.token.decimals)} exact={formatExact(m.amount, m.token.decimals)} unit={m.token.code} figure="serif" />
}
