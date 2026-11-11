import { describeFlags } from '../../core/assetfacts/assetFacts'
import type { AssetRecordFacts } from '../../core/assetfacts/assetFacts'
import { explorerAddress } from '../../core/explorer'
import { groupDigits } from '../../core/format'
import { Address, Button, Callout, Card, KeyValue, KeyValueItem, Skeleton } from '../../ui'
import { COPY } from './copy'
import { flagLimits } from './model'
import type { IssuerAsset } from './model'
import type { FlagsView } from './useIssuerConsole'
import styles from './AssetCard.module.css'

export interface AssetCardProps {
  asset: IssuerAsset
  /** Undefined while it is being read, null when it cannot be known. */
  issuer: string | null | undefined
  flags: FlagsView
  record: AssetRecordFacts | null
  onRetryFlags: () => void
}

/** One flag: its name, On or Off as a word, and what that means for a holder and for the options contract. */
function FlagRow({ label, state, on, text }: { label: string; state: string; on: boolean; text: string }) {
  return (
    <div className={styles.flag}>
      <dt className={styles.flagLabel}>{label}</dt>
      <dd className={styles.flagValue}>
        <span className={styles.flagState} data-on={on || undefined}>
          {state}
        </span>
        <span className={styles.flagText}>{text}</span>
      </dd>
    </div>
  )
}

/**
 * The asset's identity and the issuer's powers: the three authorization flags as consequences, whether they can
 * still change, and how many trustlines are in each state. Public facts: a guest sees them too.
 */
export function AssetCard({ asset, issuer, flags, record, onRetryFlags }: AssetCardProps) {
  const c = COPY.flags
  const facts = flags.status === 'ready' ? flags.facts : null
  const limits = facts ? flagLimits(facts.flags) : []
  return (
    <Card title={COPY.asset.title} headingLevel={2} className={styles.card}>
      <KeyValue figures="sans" className={styles.facts}>
        <KeyValueItem label={COPY.asset.code}>{asset.code}</KeyValueItem>
        <KeyValueItem label={COPY.asset.issuer}>
          {issuer ? (
            <Address value={issuer} explorerUrl={explorerAddress(issuer)} explorerLabel={COPY.asset.viewIssuer} copyLabel={COPY.asset.copyIssuer} />
          ) : issuer === null ? (
            COPY.asset.issuerUnknown
          ) : (
            <Skeleton width="7rem" />
          )}
        </KeyValueItem>
        <KeyValueItem label={COPY.asset.contract}>
          <Address
            value={asset.contractId}
            explorerUrl={explorerAddress(asset.contractId)}
            explorerLabel={COPY.asset.viewContract}
            copyLabel={COPY.asset.copyContract}
          />
        </KeyValueItem>
        {facts ? <KeyValueItem label={COPY.asset.homeDomain}>{facts.homeDomain ?? COPY.asset.noHomeDomain}</KeyValueItem> : null}
      </KeyValue>

      <section className={styles.block} aria-labelledby="issuer-flags-title">
        <h3 id="issuer-flags-title" className={styles.blockTitle}>
          {c.title}
        </h3>
        {flags.status === 'loading' ? (
          <div aria-busy="true">
            <Skeleton variant="rows" lines={3} />
          </div>
        ) : flags.status === 'unknown-issuer' ? (
          <p className={styles.note}>{c.unknownIssuer}</p>
        ) : flags.status === 'missing' ? (
          <Callout variant="warning">{c.missing}</Callout>
        ) : flags.status === 'error' ? (
          <Callout
            variant="danger"
            actions={
              <Button size="sm" onClick={onRetryFlags}>
                {c.retry}
              </Button>
            }
          >
            {c.error(flags.message)}
          </Callout>
        ) : (
          <>
            <dl className={styles.flags}>
              {describeFlags(flags.facts.flags).map((flag) => (
                <FlagRow key={flag.key} label={flag.label} state={flag.on ? c.on : c.off} on={flag.on} text={flag.consequence} />
              ))}
              <FlagRow
                label={c.canChange}
                state={flags.facts.flags.authImmutable ? c.canChangeNo : c.canChangeYes}
                on={!flags.facts.flags.authImmutable}
                text={flags.facts.flags.authImmutable ? c.canChangeNoText : c.canChangeYesText}
              />
              {flags.facts.locked ? <FlagRow label={c.locked} state={c.lockedYes} on text={c.lockedText} /> : null}
            </dl>
            {limits.length > 0 ? (
              <Callout variant="info">
                {limits.map((limit) => (
                  <p key={limit}>{limit}</p>
                ))}
              </Callout>
            ) : null}
          </>
        )}
      </section>

      {record ? (
        <section className={styles.block} aria-labelledby="issuer-trustlines-title">
          <h3 id="issuer-trustlines-title" className={styles.blockTitle}>
            {COPY.trustlines.title}
          </h3>
          <KeyValue figures="sans" variant="plain" className={styles.facts}>
            <KeyValueItem label={COPY.trustlines.authorized}>{groupDigits(String(record.trustlines.authorized))}</KeyValueItem>
            <KeyValueItem label={COPY.trustlines.restricted}>{groupDigits(String(record.trustlines.maintainOnly))}</KeyValueItem>
            <KeyValueItem label={COPY.trustlines.unauthorized}>{groupDigits(String(record.trustlines.unauthorized))}</KeyValueItem>
            <KeyValueItem label={COPY.trustlines.contracts}>{groupDigits(String(record.contracts))}</KeyValueItem>
          </KeyValue>
        </section>
      ) : null}
    </Card>
  )
}
