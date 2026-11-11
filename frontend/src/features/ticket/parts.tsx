// Small pieces shared by the steps of the ticket: amounts, deadlines, parties, the status lines of the
// pre-trade re-check and its issues.
import { Link as RouterLink } from '@tanstack/react-router'
import { explorerAddress } from '../../core/explorer'
import { formatExact, formatUnits } from '../../core/format'
import type { PreTradeIssue, PreTradeLine } from '../../core/options/preTrade'
import type { Money, TokenInfo } from '../../core/options/types'
import { useIsMock, useNowSec } from '../../data'
import { Address, Amount, Callout, Countdown, DateTime, IconWarning, Link, Skeleton, formatLocalTime } from '../../ui'
import { TEST_FUNDS_LINK } from './copy'
import styles from './parts.module.css'

/**
 * An exact amount as the term sheet prints it, always through the kit's Amount (one setting of the unit). When two
 * decimals hide digits, the figure opens the exact value on press.
 */
export function MoneyText({ money, size }: { money: Money; size?: 'md' | 'lg' }) {
  const shown = formatUnits(money.amount, money.token.decimals)
  const exact = formatExact(money.amount, money.token.decimals)
  return <Amount value={shown} exact={exact} unit={money.token.code} figure="serif" size={size} />
}

/** A price per unit of underlying, with its exact value on request. */
export function PriceText({ units, quote }: { units: bigint | null; quote: TokenInfo }) {
  if (units === null) return <span>–</span>
  return <MoneyText money={{ token: quote, amount: units }} />
}

/** The deadline in UTC, the canonical form both sides of a trade read. */
export function DeadlineValue({ expiry }: { expiry: number }) {
  return <DateTime value={expiry * 1000} />
}

/** Under a deadline: the time left and the viewer's local time; once it has passed, that alone. */
export function DeadlineHint({ expiry }: { expiry: number }) {
  const nowSec = useNowSec(15)
  const local = formatLocalTime(expiry * 1000)
  if (expiry <= nowSec) return <span className={styles.deadline}>The deadline has passed.</span>
  return (
    <span className={styles.deadline}>
      <span>
        In <Countdown to={expiry * 1000} expiredLabel="no time" />.
      </span>{' '}
      <span>{`${local.charAt(0).toUpperCase()}${local.slice(1)}.`}</span>
    </span>
  )
}

/** A party to the trade: its role (left out where the row label already says it), the 6+6 address, copy and, on a chain build, the explorer link. */
export function Party({ role, address, me, named = true }: { role: string; address: string; me: string | null; named?: boolean }) {
  const mock = useIsMock()
  return (
    <Address
      value={address}
      name={named ? role : undefined}
      length="medium"
      you={me !== null && address === me}
      copyLabel={`Copy the ${role.toLowerCase()} address`}
      explorerUrl={mock ? undefined : explorerAddress(address)}
      explorerLabel={`View the ${role.toLowerCase()} on the explorer`}
    />
  )
}

/** One status line of the re-check as a row value: the words, with a warning glyph when the check failed. */
export function StatusValue({ line }: { line: PreTradeLine }) {
  if (line.status === 'pending') {
    return (
      <span className={styles.status} data-status="pending">
        <span className="ui-vh">{line.text}</span>
        <span aria-hidden="true" className={styles.pending}>
          <Skeleton variant="text" width="5rem" />
        </span>
      </span>
    )
  }
  return (
    <span className={styles.status} data-status={line.status}>
      {line.status === 'fail' ? <IconWarning className={styles.statusIcon} /> : null}
      <span>{line.text}</span>
    </span>
  )
}

const ISSUE_LABEL: Partial<Record<PreTradeIssue['code'], string>> = {
  'clawback-shortfall': 'Reserves',
  'implausible-terms': 'Check terms',
  'last-minutes': 'Deadline',
  'price-changed': 'Price changed',
  'exercise-unfunded': 'Exercise',
  'below-exercise-value': 'Check terms',
}

/** Where a wallet that cannot pay learns how to get test funds (the strip on Markets). */
const FUNDS_HREF = '/markets' as const

/**
 * What the re-check found. A blocking issue stops the action; a warning lets the user go on. Each says the
 * cause, the consequence and the fix with exact figures (the sentences come from core/options/preTrade). A wallet
 * that cannot pay gets the way to test funds.
 */
export function Issues({ issues, only }: { issues: readonly PreTradeIssue[]; only?: 'block' | 'warn' }) {
  // A guest is asked to connect by the action itself, and an empty price by its own field: neither is repeated here.
  const shown = issues.filter((i) => i.code !== 'not-connected' && i.code !== 'invalid-price' && (only === undefined || i.level === only))
  if (shown.length === 0) return null
  return (
    <div className={styles.issues}>
      {shown.map((issue, i) => (
        <Callout
          key={`${issue.code}-${i}`}
          variant={issue.level === 'block' ? 'danger' : 'warning'}
          label={ISSUE_LABEL[issue.code] ?? (issue.level === 'block' ? 'Blocked' : 'Warning')}
          actions={
            issue.code === 'insufficient-funds' || issue.code === 'unfunded-account' ? (
              <Link render={<RouterLink to={FUNDS_HREF} search={{ funds: '1' }} />}>{TEST_FUNDS_LINK}</Link>
            ) : undefined
          }
        >
          {issue.message}
        </Callout>
      ))}
    </div>
  )
}
