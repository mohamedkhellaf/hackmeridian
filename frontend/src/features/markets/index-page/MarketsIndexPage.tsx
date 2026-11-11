// The Markets index: what you can do (three intents), then the assets with their reference price and what is
// open on each. A connected wallet without any balance first gets the "Get test funds" strip.
import { Link as RouterLink } from '@tanstack/react-router'
import { ASSET_LIST_NOTE, TIER_MEANING } from '../../../core/assets'
import type { AssetTier } from '../../../core/assets'
import { guideAnchor } from '../../../core/guide'
import { shortTokens } from '../../../core/reserves/reserves'
import { useAssets, useBalances, useBalancesById, useHealth, useMarketsIndex, useMe, useNowSec, useOptionsClient } from '../../../data'
import { Button, Callout, EmptyNote, Link, PageHeader, Skeleton } from '../../../ui'
import {
  ASSETS_EMPTY,
  ASSETS_EMPTY_HINT,
  ASSETS_ERROR,
  ASSETS_HEADING,
  INTENTS_HEADING,
  MARKETS_LEAD,
  MARKETS_TITLE,
  REFRESH_FAILED,
  RETRY,
  SHOW_ALL,
  SHOW_REFERENCE,
  listCountLine,
} from '../copy'
import { indexList, needsTestFunds } from '../model'
import { ShortfallNotice } from '../parts'
import { EXACT, MARKETS_ROUTE, compactSearch, useMarketsSearch } from '../routing'
import { AssetChoice } from './AssetChoice'
import { AssetsTable } from './AssetsTable'
import { GetFunds } from './GetFunds'
import { GuideSlip } from './GuideSlip'
import { IntentCards } from './IntentCards'
import styles from './MarketsIndexPage.module.css'

export function MarketsIndexPage() {
  const search = useMarketsSearch()
  const me = useMe()
  const { isMock } = useOptionsClient()
  const index = useMarketsIndex()
  const assets = useAssets()
  const balances = useBalances(me)
  const balancesById = useBalancesById(me)
  const health = useHealth()
  const nowSec = useNowSec(30)

  const showAll = search.all === '1'
  const quote = assets.data?.quote ?? null
  const list = index.data ? indexList(index.data, showAll) : null
  const tiers = list ? ([...new Set(list.rows.map((r) => r.tier))] as AssetTier[]) : []
  const firstRun = me !== null && quote !== null && needsTestFunds(balances.data)

  return (
    <div className={styles.page}>
      <PageHeader title={MARKETS_TITLE} description={MARKETS_LEAD} />

      {firstRun && balances.data ? <GetFunds address={me} balances={balances.data} quoteId={quote.contractId} mock={isMock} /> : null}
      <GuideSlip displaced={firstRun} pending={me !== null && (assets.isPending || balances.isPending)} />

      <section className={styles.section} aria-labelledby="markets-intents" {...guideAnchor('intents')}>
        <h2 id="markets-intents" className={styles.heading}>
          {INTENTS_HEADING}
        </h2>
        <IntentCards current={search.intent} showAll={showAll} rows={list?.rows ?? null} balances={balancesById.data ?? null} quoteCode={quote?.code ?? 'USDx'} />
        {search.intent ? (
          <AssetChoice intent={search.intent} showAll={showAll} rows={list?.rows ?? null} quote={quote} balances={balancesById.data ?? null} connected={me !== null} />
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="markets-assets" aria-busy={index.isLoading || undefined} {...guideAnchor('assets')}>
        <div className={styles.sectionHead}>
          <h2 id="markets-assets" className={styles.heading}>
            {ASSETS_HEADING}
          </h2>
          {list && list.rows.length > 0 ? (
            <p className={styles.count}>
              {listCountLine(list.rows.length, list.hidden, list.all)}{' '}
              {list.hidden > 0 ? (
                <Link render={<RouterLink to={MARKETS_ROUTE} search={compactSearch({ intent: search.intent, all: '1' as const })} activeOptions={EXACT} resetScroll={false} />}>{SHOW_ALL}</Link>
              ) : showAll && index.data && index.data.some((r) => !r.isReference) && index.data.some((r) => r.isReference) ? (
                <Link render={<RouterLink to={MARKETS_ROUTE} search={compactSearch({ intent: search.intent })} activeOptions={EXACT} resetScroll={false} />}>{SHOW_REFERENCE}</Link>
              ) : null}
            </p>
          ) : null}
        </div>

        {index.isError ? (
          <Callout variant="danger" title={ASSETS_ERROR} actions={<Button onClick={index.retry}>{RETRY}</Button>}>
            {index.error}
          </Callout>
        ) : !list || !quote ? (
          <Skeleton variant="rows" lines={4} />
        ) : list.rows.length === 0 ? (
          <EmptyNote title={ASSETS_EMPTY} hint={ASSETS_EMPTY_HINT} />
        ) : (
          <>
            {index.refreshFailed ? (
              <p className={styles.stale}>
                {REFRESH_FAILED}{' '}
                <Button variant="quiet" size="sm" onClick={index.retry}>
                  {RETRY}
                </Button>
              </p>
            ) : null}
            <ShortfallNotice tokens={shortTokens(health.data ?? [])} />
            <AssetsTable rows={list.rows} quote={quote} nowSec={nowSec} />
            <dl className={styles.legend}>
              {tiers.map((tier) => (
                <div key={tier}>
                  <dt>{tier}</dt>
                  <dd>{TIER_MEANING[tier]}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.listNote}>{ASSET_LIST_NOTE}</p>
          </>
        )}
      </section>
    </div>
  )
}
