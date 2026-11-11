// "Outcome unknown" and "Check again", in place of the action of a position or request whose transaction has an
// unknown outcome and can still land (`useUnsettledTx`): on the to-do card, the row and the position page.
import type { UnsettledTx } from '../../data'
import { Button, TxStateWord } from '../../ui'
import { CHECK_AGAIN } from './copy'
import css from './Unsettled.module.css'

export function UnsettledAction({ unsettled, size = 'sm' }: { unsettled: UnsettledTx; size?: 'sm' | 'md' }) {
  return (
    <span className={css.root}>
      <TxStateWord state="unknown" />
      <Button size={size} onClick={unsettled.check} aria-label={`${CHECK_AGAIN}: ${unsettled.entry.label}`}>
        {CHECK_AGAIN}
      </Button>
    </span>
  )
}
