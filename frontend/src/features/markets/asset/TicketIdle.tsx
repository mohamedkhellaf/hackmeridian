// The ticket rail before anything is picked: a blank contract note that says what to pick, with the lines the
// order will fill in.
import type { TokenInfo } from '../../../core/options/types'
import { EmptyNote } from '../../../ui'
import { IDLE_BLANK, IDLE_HINT, IDLE_TITLE } from '../copy'
import type { AssetMode, AssetTab } from '../routing'
import styles from './TicketIdle.module.css'

export interface TicketIdleProps {
  token: TokenInfo
  tab: AssetTab
  mode: AssetMode
}

export function TicketIdle({ token, tab, mode }: TicketIdleProps) {
  const hint = tab === 'requests' ? IDLE_HINT.requests : IDLE_HINT[mode]
  return (
    <div className={styles.root} data-testid="ticket-idle">
      <EmptyNote headingLevel={2} title={IDLE_TITLE} hint={hint}>
        <dl className={styles.blank} aria-hidden="true">
          <div>
            <dt>Asset</dt>
            <dd>{token.code}</dd>
          </div>
          {IDLE_BLANK.map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={styles.line} />
            </div>
          ))}
        </dl>
      </EmptyNote>
    </div>
  )
}
