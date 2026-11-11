import { Link as RouterLink } from '@tanstack/react-router'
import { ISSUER_POWERS_TITLE, POWERS_COLUMNS, POWER_STATE, describeFlagChange, describeFlags } from '../../core/assetfacts/assetFacts'
import { Button, Callout, Link, RowHeader, Skeleton, Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../ui'
import { COPY } from './copy'
import type { FlagsView } from './useIssuerConsole'
import styles from './IssuerPowers.module.css'

export interface IssuerPowersProps {
  flags: FlagsView
  onRetry: () => void
}

/**
 * What the issuer can do to the asset: the three authorization flags, each as a consequence for a holder and for
 * the Covered contract, and whether they can still change. The same table, in the same words, as the asset's
 * About tab. Public facts: everyone sees them.
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
        <TableWrap label={c.caption}>
          <Table caption={c.caption} prose>
            <THead>
              <Tr>
                <Th>{POWERS_COLUMNS.power}</Th>
                <Th>{POWERS_COLUMNS.state}</Th>
                <Th>{POWERS_COLUMNS.effect}</Th>
              </Tr>
            </THead>
            <TBody>
              {describeFlags(flags.facts.flags).map((flag) => (
                <Tr key={flag.key}>
                  <RowHeader className={styles.power}>{flag.label}</RowHeader>
                  <Td className={styles.state} data-on={flag.on || undefined}>
                    {flag.on ? POWER_STATE.on : POWER_STATE.off}
                  </Td>
                  <Td className={styles.effect}>{flag.consequence}</Td>
                </Tr>
              ))}
              {[describeFlagChange(flags.facts.flags)].map((change) => (
                <Tr key={change.key}>
                  <RowHeader className={styles.power}>{change.label}</RowHeader>
                  <Td className={styles.state} data-on={change.on || undefined}>
                    {change.state}
                  </Td>
                  <Td className={styles.effect}>{change.consequence}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
      <p className={styles.more}>
        <Link render={<RouterLink to="/learn" hash="risks" />}>{c.learnLink}</Link>
      </p>
    </section>
  )
}
