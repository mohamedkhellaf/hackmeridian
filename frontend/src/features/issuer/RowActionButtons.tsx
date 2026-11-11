import { shortAddress } from '../../core/options/format'
import { Button, IconButton, IconMore, Menu, MenuGroup, MenuItem } from '../../ui'
import { COPY } from './copy'
import type { AccountRow, IssuerActionKind, RowAction, RowActions } from './model'
import styles from './RowActionButtons.module.css'

export interface RowActionButtonsProps {
  row: AccountRow
  actions: RowActions
  /** The action running on this row, if any: its button shows progress. */
  running: IssuerActionKind | null
  /** `sm` in a table row, `md` on a phone row and in a statement. */
  size?: 'sm' | 'md'
  onAction: (kind: IssuerActionKind, row: AccountRow) => void
}

const WORD: Record<IssuerActionKind, string> = { authorize: COPY.accounts.authorize, freeze: COPY.accounts.freeze, clawback: COPY.accounts.clawback }
const NAME: Record<IssuerActionKind, (who: string) => string> = {
  authorize: COPY.accounts.authorizeName,
  freeze: COPY.accounts.freezeName,
  clawback: COPY.accounts.clawbackName,
}

/**
 * The actions of one row: at most two controls. The action its state calls for is the button; the rest (claw
 * back always among them) sit in the row's menu, one step away. While a transaction runs or is unresolved, what
 * is offered stays in place, disabled, with the reason. A row with nothing to act on shows no control.
 */
export function RowActionButtons({ row, actions, running, size = 'sm', onAction }: RowActionButtonsProps) {
  // The Authorization column already says why in plain words; here the reason is kept for screen readers, which
  // would otherwise meet an empty cell.
  if (actions.note) return <span className="ui-vh">{actions.note}</span>
  const who = row.escrow ? COPY.accounts.escrowWho : shortAddress(row.address)
  const p = actions.primary
  const blocked = actions.more.find((a: RowAction) => !a.enabled)?.reason
  const items = actions.more.map((a) => (
    <MenuItem key={a.kind} tone={a.kind === 'clawback' ? 'danger' : 'default'} disabled={!a.enabled} onSelect={() => onAction(a.kind, row)}>
      {WORD[a.kind]}
    </MenuItem>
  ))
  return (
    <div className={styles.buttons} data-size={size}>
      {/* One element in this place whatever the action: when the row's state changes after the action (Authorize
          becomes Freeze), the button keeps the focus. */}
      {p ? (
        <Button
          size={size}
          onClick={() => onAction(p.kind, row)}
          // The running action shows progress and keeps its focus; the kit's reason tooltip would wrap (and
          // remount) the very button that was pressed.
          disabled={!p.enabled && running !== p.kind}
          disabledReason={p.reason}
          loading={running === p.kind}
          aria-label={NAME[p.kind](who)}
        >
          {WORD[p.kind]}
        </Button>
      ) : null}
      {actions.more.length > 0 ? (
        <Menu trigger={<IconButton size={size} variant="secondary" label={COPY.accounts.more(who)} icon={<IconMore />} aria-busy={running !== null && running !== p?.kind ? true : undefined} />}>
          {blocked ? <MenuGroup label={blocked}>{items}</MenuGroup> : items}
        </Menu>
      ) : null}
    </div>
  )
}
