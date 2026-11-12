import type { AssetRecordFacts } from '../../core/assetfacts/assetFacts'
import { explorerAddress } from '../../core/explorer'
import { groupDigits } from '../../core/format'
import { Address, Card, KeyValue, KeyValueItem, Skeleton } from '../../ui'
import { COPY } from './copy'
import type { IssuerAsset } from './model'
import type { FlagsView } from './useIssuerConsole'
import styles from './AssetCard.module.css'

export interface AssetCardProps {
  asset: IssuerAsset
  /** Undefined while it is being read, null when it cannot be known. */
  issuer: string | null | undefined
  flags: FlagsView
  record: AssetRecordFacts | null
  /** On mock data the ids exist only in this page: no explorer link, no asset contract, no issuer account facts. */
  mock: boolean
}

/**
 * The asset's identity and how many trustlines are in each state. Public facts: a guest sees them too. On a wide
 * sheet the two blocks sit side by side.
 */
export function AssetCard({ asset, issuer, flags, record, mock }: AssetCardProps) {
  const c = COPY.asset
  const facts = !mock && flags.status === 'ready' ? flags.facts : null
  return (
    <Card title={c.title} headingLevel={2} className={styles.card}>
      <div className={styles.blocks}>
        <KeyValue figures="sans">
          <KeyValueItem label={c.code}>{asset.code}</KeyValueItem>
          <KeyValueItem label={c.issuer}>
            {issuer ? (
              <Address value={issuer} explorerUrl={mock ? undefined : explorerAddress(issuer)} explorerLabel={c.viewIssuer} copyLabel={c.copyIssuer} />
            ) : issuer === null ? (
              c.issuerUnknown
            ) : (
              <Skeleton width="7rem" />
            )}
          </KeyValueItem>
          {mock ? null : (
            <KeyValueItem label={c.contract}>
              <Address value={asset.contractId} explorerUrl={explorerAddress(asset.contractId)} explorerLabel={c.viewContract} copyLabel={c.copyContract} />
            </KeyValueItem>
          )}
          {facts ? <KeyValueItem label={c.homeDomain}>{facts.homeDomain ?? c.noHomeDomain}</KeyValueItem> : null}
          {facts ? <KeyValueItem label={c.keys}>{facts.locked ? c.keysLocked : c.keysLive}</KeyValueItem> : null}
        </KeyValue>

        {record ? (
          <section className={styles.block} aria-labelledby="issuer-trustlines-title">
            <h3 id="issuer-trustlines-title" className={styles.blockTitle}>
              {COPY.trustlines.title}
            </h3>
            <KeyValue figures="sans" variant="plain">
              <KeyValueItem label={COPY.trustlines.authorized}>{groupDigits(String(record.trustlines.authorized))}</KeyValueItem>
              <KeyValueItem label={COPY.trustlines.restricted}>{groupDigits(String(record.trustlines.maintainOnly))}</KeyValueItem>
              <KeyValueItem label={COPY.trustlines.unauthorized}>{groupDigits(String(record.trustlines.unauthorized))}</KeyValueItem>
              <KeyValueItem label={COPY.trustlines.contracts}>{groupDigits(String(record.contracts))}</KeyValueItem>
            </KeyValue>
          </section>
        ) : null}
      </div>
    </Card>
  )
}
