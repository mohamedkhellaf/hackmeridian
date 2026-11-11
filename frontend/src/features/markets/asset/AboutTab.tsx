// The About tab of an asset: what it is, what its issuer can do and what that means for an option on it, which
// contract holds the collateral and who has any power over it. Facts come from the chain (core/assetfacts); a
// read that failed says so instead of guessing, and a mock asset says it has no on-chain facts.
import { Link as RouterLink } from '@tanstack/react-router'
import { TIER_MEANING, findReferenceAsset, tierOf } from '../../../core/assets'
import type { AssetFlags } from '../../../core/assetfacts/assetFacts'
import { describeFlags } from '../../../core/assetfacts/assetFacts'
import { config } from '../../../core/config'
import { ISSUER_DISCLOSURE } from '../../../core/disclosures'
import { explorerAccount, explorerAsset, explorerContract, isMockId } from '../../../core/explorer'
import type { TokenInfo } from '../../../core/options/types'
import { useAssetFacts, useEligibility, useMe, useOptionsClient } from '../../../data'
import { Button, Callout, Card, KeyValue, KeyValueItem, Link, RowHeader, Skeleton, Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../../ui'
import {
  ABOUT,
  ACCESS,
  CONTRACT,
  DOMAIN_NOT_SET,
  FACTS_ERROR,
  FACTS_LOADING,
  FACTS_PARTIAL,
  FACT_ROW,
  LINKS,
  MEANS,
  MOCK_FACTS,
  MOCK_POWERS_NOTE,
  NATIVE_FACTS,
  NOT_READ,
  POWERS_CAPTION,
  POWER_CHANGE,
  POWER_COL,
  POWER_STATE,
  RETRY,
  SIGNERS_LIVE,
  SIGNERS_LOCKED,
  UNKNOWN,
  UNKNOWN_POWERS_NOTE,
  trustlinesLine,
  TEST_TOKEN_NOTE,
  typeLine,
} from '../copy'
import { ChainId } from '../parts'
import { RESERVES_ROUTE } from '../routing'
import styles from './AboutTab.module.css'

export interface AboutTabProps {
  token: TokenInfo
}

/** Every flag on: the effects a flag has when it is on, for the case where the flags themselves are not known. */
const ALL_ON: AssetFlags = { authRequired: true, authRevocable: true, clawback: true, authImmutable: false }

function Powers({ flags, note }: { flags: AssetFlags | null; note: string | null }) {
  const known = flags !== null
  const rows = describeFlags(flags ?? ALL_ON)
  return (
    <>
      {note ? <p className={styles.note}>{note}</p> : null}
      <TableWrap label={POWERS_CAPTION}>
        <Table caption={POWERS_CAPTION} className={styles.powers}>
          <THead>
            <Tr>
              <Th>{POWER_COL.power}</Th>
              <Th>{POWER_COL.state}</Th>
              <Th>{POWER_COL.effect}</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((f) => (
              <Tr key={f.key}>
                <RowHeader className={styles.power}>{f.label}</RowHeader>
                <Td className={styles.state} data-on={known && f.on ? '' : undefined}>
                  {known ? (f.on ? POWER_STATE.on : POWER_STATE.off) : NOT_READ}
                </Td>
                <Td className={styles.effect}>{f.consequence}</Td>
              </Tr>
            ))}
            {known ? (
              <Tr>
                <RowHeader className={styles.power}>{POWER_CHANGE.label}</RowHeader>
                <Td className={styles.state} data-on={flags.authImmutable ? undefined : ''}>
                  {flags.authImmutable ? POWER_CHANGE.no : POWER_CHANGE.yes}
                </Td>
                <Td className={styles.effect}>{flags.authImmutable ? POWER_CHANGE.fixed : POWER_CHANGE.open}</Td>
              </Tr>
            ) : null}
          </TBody>
        </Table>
      </TableWrap>
    </>
  )
}

function ExplorerLinks({ token, contractId }: { token: TokenInfo; contractId: string | undefined }) {
  if (isMockId(token.contractId)) return <p className={styles.note}>{LINKS.mock}</p>
  return (
    <ul className={styles.links} role="list">
      {token.issuer ? (
        <>
          <li>
            <Link external href={explorerAsset(token.code, token.issuer)}>
              {LINKS.asset(token.code)}
            </Link>
          </li>
          <li>
            <Link external href={explorerAccount(token.issuer)}>
              {LINKS.issuer}
            </Link>
          </li>
        </>
      ) : null}
      <li>
        <Link external href={explorerContract(token.contractId)}>
          {LINKS.contract}
        </Link>
      </li>
      {contractId ? (
        <li>
          <Link external href={explorerContract(contractId)}>
            {LINKS.options}
          </Link>
        </li>
      ) : null}
    </ul>
  )
}

export function AboutTab({ token }: AboutTabProps) {
  const me = useMe()
  const { isMock } = useOptionsClient()
  const mockAsset = isMockId(token.contractId)
  const facts = useAssetFacts(token)
  const eligible = useEligibility(token.contractId, me)
  const listed = findReferenceAsset(token.contractId)
  const tier = tierOf(token)

  const d = facts.data
  // A mock asset answers at once with fixture flags (marked `mock`); only a real one has reads that load or fail.
  const loading = !mockAsset && facts.isPending
  const failed = !mockAsset && facts.isError && !d
  const flags = d?.record?.flags ?? d?.issuerInfo?.flags ?? null
  const issuer = d?.issuer ?? token.issuer ?? null
  const powersNote = mockAsset ? MOCK_POWERS_NOTE : flags === null && !loading ? UNKNOWN_POWERS_NOTE : null

  return (
    <div className={styles.root}>
      <div className={styles.main}>
        <section className={styles.section} aria-labelledby="about-facts" aria-busy={loading || undefined}>
          <h2 id="about-facts" className={styles.title}>
            {ABOUT.factsTitle}
          </h2>
          {mockAsset ? <p className={styles.note}>{MOCK_FACTS}</p> : null}
          {failed ? (
            <Callout variant="warning" title={FACTS_ERROR} actions={<Button onClick={() => void facts.refetch()}>{RETRY}</Button>}>
              {facts.error instanceof Error ? facts.error.message : null}
            </Callout>
          ) : null}
          {d?.partial ? <Callout variant="warning" title={FACTS_PARTIAL} /> : null}
          {d?.native ? <p className={styles.note}>{NATIVE_FACTS}</p> : null}
          <KeyValue figures="sans">
            <KeyValueItem label={FACT_ROW.code}>{token.code}</KeyValueItem>
            <KeyValueItem label={FACT_ROW.type} hint={listed && !mockAsset ? TEST_TOKEN_NOTE : undefined}>
              {typeLine(listed?.typeLabel ?? null)}
            </KeyValueItem>
            <KeyValueItem label={FACT_ROW.issuer}>
              {issuer ? <ChainId value={issuer} length="medium" copyLabel="Copy the issuer address" explorerLabel="View the issuer on the explorer" /> : loading ? <Skeleton width="8rem" /> : UNKNOWN}
            </KeyValueItem>
            <KeyValueItem label={FACT_ROW.contract}>
              <ChainId value={token.contractId} length="medium" copyLabel="Copy the asset contract id" explorerLabel="View the asset contract on the explorer" />
            </KeyValueItem>
            <KeyValueItem label={FACT_ROW.tier} hint={TIER_MEANING[tier]}>
              {tier}
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
          </KeyValue>
        </section>

        <section className={styles.section} aria-labelledby="about-powers">
          <h2 id="about-powers" className={styles.title}>
            {ABOUT.powersTitle}
          </h2>
          {loading ? (
            <>
              <span className="ui-vh">{FACTS_LOADING}</span>
              <Skeleton variant="rows" lines={4} />
            </>
          ) : (
            <Powers flags={flags} note={powersNote} />
          )}
          <Callout variant="warning" label="Issuer control">
            {ISSUER_DISCLOSURE}
          </Callout>
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

      <div className={styles.side}>
        <Card title={ABOUT.accessTitle} headingLevel={2} className={styles.access}>
          <p className={styles.accessLine}>
            {!me
              ? ACCESS.guest(token.code)
              : eligible.isPending
                ? ACCESS.checking
                : eligible.isError
                  ? ACCESS.error
                  : eligible.data
                    ? ACCESS.yes(token.code)
                    : ACCESS.no(token.code)}
          </p>
        </Card>

        <Card title={ABOUT.contractTitle} headingLevel={2}>
          <KeyValue figures="sans" layout="stacked">
            <KeyValueItem label={CONTRACT.id}>
              {isMock || !config.optionsContractId ? (
                CONTRACT.mock
              ) : (
                <ChainId value={config.optionsContractId} length="medium" copyLabel="Copy the options contract id" explorerLabel="View the options contract on the explorer" />
              )}
            </KeyValueItem>
            <KeyValueItem label={CONTRACT.admin}>{CONTRACT.adminValue}</KeyValueItem>
            <KeyValueItem label={CONTRACT.upgrades}>{CONTRACT.upgradesValue}</KeyValueItem>
            <KeyValueItem label={CONTRACT.price}>{CONTRACT.priceValue}</KeyValueItem>
            <KeyValueItem label={CONTRACT.listing}>{CONTRACT.listingValue}</KeyValueItem>
            <KeyValueItem label={CONTRACT.audit}>{CONTRACT.auditValue}</KeyValueItem>
          </KeyValue>
          <p className={styles.more}>
            <Link render={<RouterLink to={RESERVES_ROUTE} />}>{CONTRACT.reserves}</Link>
          </p>
        </Card>

        <Card title={ABOUT.linksTitle} headingLevel={2}>
          <ExplorerLinks token={token} contractId={isMock ? undefined : config.optionsContractId} />
        </Card>
      </div>
    </div>
  )
}
