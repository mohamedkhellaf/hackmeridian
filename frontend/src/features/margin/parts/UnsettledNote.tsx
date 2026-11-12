import { usePro } from '../../../data'
import { Button, Callout } from '../../../ui'

/** Why a confirmation's action is held back while the last Margin call has an unknown outcome. */
export const UNSETTLED_REASON = 'The last call was sent and is not confirmed yet.'

/**
 * Shown at the top of a Margin confirmation while the last call was sent and its outcome is unknown (contract
 * build only: a replay never leaves an outcome unknown). The action waits; "Check again" looks the call up, as
 * the result region and Activity do, so the user does not press and only then meet a refusal.
 */
export function UnsettledNote() {
  const { canCheckAgain, checkAgain } = usePro()
  if (!canCheckAgain) return null
  return (
    <Callout
      variant="warning"
      title={UNSETTLED_REASON}
      actions={
        <Button size="sm" onClick={() => void checkAgain()}>
          Check again
        </Button>
      }
    >
      <p>Another call could act twice. Once a ledger has it, or it has expired, this one can be sent.</p>
    </Callout>
  )
}
