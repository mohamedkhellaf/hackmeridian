import { Link as RouterLink } from '@tanstack/react-router'
import type { AssetFlags } from '../../core/assetfacts/assetFacts'
import { ISSUER_POWERS_TITLE, POWERS_COLUMNS, POWER_STATE, describeFlagChange, describeFlags } from '../../core/assetfacts/assetFacts'
import { Button, Callout, FactTable, Link, Skeleton } from '../../ui'
import type { FactRow } from '../../ui'
import { COPY } from './copy'
import type { FlagsView } from './useIssuerConsole'
import styles from './IssuerPowers.module.css'

export interface IssuerPowersProps {
  flags: FlagsView
  onRetry: () => void
}

/** The three flags and whether they can still change, in core/assetfacts's words. */
function powerRows(flags: AssetFlags): FactRow[] {
  const change = describeFlagChange(flags)
  return [
    ...describeFlags(flags).map((f) => ({ key: f.key, label: f.label, state: f.on ? POWER_STATE.on : POWER_STATE.off, on: f.on, effect: f.consequence })),
    { key: change.key, label: change.label, state: change.state, on: change.on, effect: change.consequence },
  ]
}

/** The column heads of the powers table, as the asset's About tab has them. */
const COLUMNS = { label: POWERS_COLUMNS.power, state: POWERS_COLUMNS.state, effect: POWERS_COLUMNS.effect } as const

/**
 * What the issuer can do to the asset: the three authorization flags, each as a consequence for a holder and for
 * the Covered contract, and whether they can still change. The same component (`FactTable`), in the same words,
 * as the asset's About tab. Public facts: everyone sees them.
 */
export function IssuerPowers({ flags, onRetry }: IssuerPowersProps) {
  const c = COPY.powers
  return (
    <section className={styles.root} aria-labelledby="issuer-powers-title">
      <h2 id="issuer-powers-title" className="ui-h2">
        {ISSUER_POWERS_TITLE}
      </h2>
      {flags.status === 'loading' ? (
        <div aria-busy="true">
          <Skeleton variant="rows" lines={4} />
        </div>
      ) : flags.status === 'unknown-issuer' ? (
        <p className={styles.note}>{c.unknownIssuer}</p>
      ) : flags.status === 'missing' ? (
        <Callout variant="warning" title={c.missing} />
      ) : flags.status === 'error' ? (
        <Callout
          variant="danger"
          title={c.error(flags.message)}
          actions={
            <Button size="sm" onClick={onRetry}>
              {COPY.page.retry}
            </Button>
          }
        />
      ) : (
        <FactTable caption={c.caption} columns={COLUMNS} rows={powerRows(flags.facts.flags)} />
      )}
      <p className={styles.more}>
        <Link render={<RouterLink to="/learn" hash="risks" />}>{c.learnLink}</Link>
      </p>
    </section>
  )
}
