// The About tab of an asset: whether this wallet can hold it and, if not, whose move it is; what the token is;
// what its issuer can do and what that means for an option on it. Facts come from the chain (core/assetfacts);
// a read that failed says so instead of guessing. The contract's own facts live on Reserves, linked from here.
import { Link as RouterLink } from '@tanstack/react-router'
import { findReferenceAsset } from '../../../core/assets'
import type { AssetFlags } from '../../../core/assetfacts/assetFacts'
import { ISSUER_POWERS_TITLE, POWERS_COLUMNS, POWER_STATE, describeFlagChange, describeFlags } from '../../../core/assetfacts/assetFacts'
import { config } from '../../../core/config'
import { ISSUER_DISCLOSURE } from '../../../core/disclosures'
import { isMockId } from '../../../core/explorer'
import type { TokenInfo } from '../../../core/options/types'
import { useAssetFacts, useBalancesById, useEligibility, useHolderStatus, useMe, useOptionsClient } from '../../../data'
import { Button, Callout, FactTable, KeyValue, KeyValueItem, Link, Skeleton } from '../../../ui'
import type { FactRow } from '../../../ui'
import {
  ABOUT,
  ACCESS,
  CONTRACTS_LINK,
  DOMAIN_NOT_SET,
  FACTS_ERROR,
  FACTS_LOADING,
  FACTS_PARTIAL,
  FACT_ROW,
  FUNDS_LINK,
  MEANS,
  NATIVE_FACTS,
  NOT_READ,
  POWERS_CAPTION,
  RETRY,
  SIGNERS_LIVE,
  SIGNERS_LOCKED,
  TEST_TOKEN_NOTE,
  UNKNOWN,
  UNKNOWN_POWERS_NOTE,
  trustlinesLine,
} from '../copy'
import { accessCase } from '../model'
import { ChainId } from '../parts'
import { MARKETS_ROUTE, RESERVES_ROUTE } from '../routing'
import styles from './AboutTab.module.css'

export interface AboutTabProps {
  token: TokenInfo
}

/** Every flag on: the effects a flag has when it is on, for the case where the flags themselves are not known. */
const ALL_ON: AssetFlags = { authRequired: true, authRevocable: true, clawback: true, authImmutable: false }

/** The three flags and, once the flags are known, whether they can still change, in core/assetfacts's words. */
function powerRows(flags: AssetFlags | null): FactRow[] {
  const known = flags !== null
  const rows: FactRow[] = describeFlags(flags ?? ALL_ON).map((f) => ({ key: f.key, label: f.label, state: known ? (f.on ? POWER_STATE.on : POWER_STATE.off) : NOT_READ, on: known && f.on, effect: f.consequence }))
  if (flags !== null) {
    const change = describeFlagChange(flags)
    rows.push({ key: change.key, label: change.label, state: change.state, on: change.on, effect: change.consequence })
  }
  return rows
}

/** The column heads of the powers table, as the Issuer page has them. */
const COLUMNS = { label: POWERS_COLUMNS.power, state: POWERS_COLUMNS.state, effect: POWERS_COLUMNS.effect } as const

/** "Your access": decided from what the wallet itself lacks first, then from the issuer's authorization. */
function Access({ token, me }: { token: TokenInfo; me: string }) {
  const balances = useBalancesById(me)
  const holder = useHolderStatus(token, me)
  const eligible = useEligibility(token.contractId, me)
  const status = balances.data?.[token.contractId]?.status
  const which = accessCase(status, holder.data, eligible.isPending ? undefined : eligible.isError ? null : eligible.data)
  const code = token.code
  const line = which === 'checking' || which === 'error' ? ACCESS[which] : ACCESS[which](code)
  const needsFunds = which === 'unfunded' || which === 'noTrustline'

  return (
    <section className={styles.section} aria-labelledby="about-access">
      <h2 id="about-access" className={styles.title}>
        {ABOUT.accessTitle}
      </h2>
      <p className={styles.line}>
        {line}{' '}
        {needsFunds ? <Link render={<RouterLink to={MARKETS_ROUTE} search={{ funds: '1' }} />}>{FUNDS_LINK}</Link> : null}
      </p>
    </section>
  )
}

export function AboutTab({ token }: AboutTabProps) {
  const me = useMe()
  const { isMock } = useOptionsClient()
  const mockAsset = isMockId(token.contractId)
  const facts = useAssetFacts(token)
  const listed = findReferenceAsset(token.contractId)

  const d = facts.data
  // A mock asset answers at once with the flags of the regulated asset the mock plays; only a real one has reads
  // that load or fail.
  const loading = !mockAsset && facts.isPending
  const failed = !mockAsset && facts.isError && !d
  const flags = d?.record?.flags ?? d?.issuerInfo?.flags ?? null
  const issuer = d?.issuer ?? token.issuer ?? null
  const optionsId = isMock ? undefined : config.optionsContractId || undefined

  return (
    <div className={styles.root}>
      {me ? <Access token={token} me={me} /> : null}

      <section className={styles.section} aria-labelledby="about-facts" aria-busy={loading || undefined}>
        <h2 id="about-facts" className={styles.title}>
          {ABOUT.factsTitle}
        </h2>
        {listed ? <p className={styles.line}>{TEST_TOKEN_NOTE}</p> : null}
        {failed ? (
          <Callout variant="warning" title={FACTS_ERROR} actions={<Button onClick={() => void facts.refetch()}>{RETRY}</Button>}>
            {facts.error instanceof Error ? facts.error.message : null}
          </Callout>
        ) : null}
        {d?.partial ? <Callout variant="warning" title={FACTS_PARTIAL} /> : null}
        {d?.native ? <p className={styles.note}>{NATIVE_FACTS}</p> : null}
        <KeyValue figures="sans">
          <KeyValueItem label={FACT_ROW.issuer}>
            {issuer ? <ChainId value={issuer} length="medium" copyLabel="Copy the issuer address" explorerLabel="View the issuer on the explorer" /> : loading ? <Skeleton width="8rem" /> : UNKNOWN}
          </KeyValueItem>
          <KeyValueItem label={FACT_ROW.contract}>
            <ChainId value={token.contractId} length="medium" copyLabel="Copy the asset contract id" explorerLabel="View the asset contract on the explorer" />
          </KeyValueItem>
          {mockAsset ? null : (
            <>
              <KeyValueItem label={FACT_ROW.domain}>{loading ? <Skeleton width="6rem" /> : d?.issuerInfo ? (d.issuerInfo.homeDomain ?? DOMAIN_NOT_SET) : UNKNOWN}</KeyValueItem>
              <KeyValueItem label={FACT_ROW.trustlines}>
                {loading ? <Skeleton width="10rem" /> : d?.record ? trustlinesLine(d.record.trustlines.authorized, d.record.trustlines.maintainOnly, d.record.trustlines.unauthorized) : UNKNOWN}
              </KeyValueItem>
              <KeyValueItem label={FACT_ROW.contracts}>{loading ? <Skeleton width="3rem" /> : d?.record ? d.record.contracts : UNKNOWN}</KeyValueItem>
              <KeyValueItem label={FACT_ROW.signers}>{loading ? <Skeleton width="10rem" /> : d?.issuerInfo ? (d.issuerInfo.locked ? SIGNERS_LOCKED : SIGNERS_LIVE) : UNKNOWN}</KeyValueItem>
            </>
          )}
          {optionsId ? (
            <KeyValueItem label={FACT_ROW.options} hint={<Link render={<RouterLink to={RESERVES_ROUTE} />}>{CONTRACTS_LINK}</Link>}>
              <ChainId value={optionsId} length="medium" copyLabel="Copy the Covered contract id" explorerLabel="View the Covered contract on the explorer" />
            </KeyValueItem>
          ) : null}
        </KeyValue>
        {optionsId ? null : (
          <p className={styles.line}>
            <Link render={<RouterLink to={RESERVES_ROUTE} />}>{CONTRACTS_LINK}</Link>
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="about-powers">
        <h2 id="about-powers" className={styles.title}>
          {ISSUER_POWERS_TITLE}
        </h2>
        {loading ? (
          <>
            <span className="ui-vh">{FACTS_LOADING}</span>
            <Skeleton variant="rows" lines={4} />
          </>
        ) : (
          <>
            {flags === null ? <p className={styles.note}>{UNKNOWN_POWERS_NOTE}</p> : null}
            <FactTable caption={POWERS_CAPTION} columns={COLUMNS} rows={powerRows(flags)} />
          </>
        )}
        <p className={styles.issuer}>{ISSUER_DISCLOSURE}</p>
      </section>

      <section className={styles.section} aria-labelledby="about-means">
        <h2 id="about-means" className={styles.title}>
          {ABOUT.meansTitle}
        </h2>
        <ul className={styles.means}>
          {MEANS(token.code).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
