import { shortAddress } from '../../core/options/format'
import { Button } from '../../ui'
import { COPY } from './copy'
import type { AccountRow, IssuerActionKind, RowActions } from './model'
import styles from './RowActionButtons.module.css'

export interface RowActionButtonsProps {
  row: AccountRow
  actions: RowActions
  /** The action running on this row, if any: its button shows progress. */
  running: IssuerActionKind | null
  onAuthorize: (row: AccountRow) => void
  onFreeze: (row: AccountRow) => void
  onClawback: (row: AccountRow) => void
}

/**
 * The actions of one row. Only the ones its state calls for are offered; one that is offered and cannot run is
 * disabled with its reason. A row with nothing to act on shows no button.
 */
export function RowActionButtons({ row, actions, running, onAuthorize, onFreeze, onClawback }: RowActionButtonsProps) {
  // The Authorization column already says why in plain words; here the reason is kept for screen readers, which
  // would otherwise meet an empty cell.
  if (actions.note) return <span className="ui-vh">{actions.note}</span>
  const who = row.escrow ? COPY.accounts.escrowName.toLowerCase() : shortAddress(row.address)
  const c = COPY.accounts
  return (
    <div className={styles.buttons}>
      {actions.authorize ? (
        <Button
          size="sm"
          onClick={() => onAuthorize(row)}
          disabled={!actions.authorize.enabled}
          disabledReason={actions.authorize.reason}
          loading={running === 'authorize'}
          aria-label={c.authorizeName(who)}
        >
          {c.authorize}
        </Button>
      ) : null}
      {actions.freeze ? (
        <Button
          size="sm"
          onClick={() => onFreeze(row)}
          disabled={!actions.freeze.enabled}
          disabledReason={actions.freeze.reason}
          loading={running === 'freeze'}
          aria-label={c.freezeName(who)}
        >
          {c.freeze}
        </Button>
      ) : null}
      {actions.clawback ? (
        <Button
          size="sm"
          variant="quiet"
          tone="danger"
          onClick={() => onClawback(row)}
          disabled={!actions.clawback.enabled}
          disabledReason={actions.clawback.reason}
          loading={running === 'clawback'}
          aria-label={c.clawbackName(who)}
        >
          {c.clawback}
        </Button>
      ) : null}
    </div>
  )
}
