// The Markets index: what you can do (four intents), then the assets with their reference price and what is open
// on each. Choosing an intent turns the Assets section into the question "on which asset?": one list, the same
// figures, each row's action carrying the intent. A connected wallet without the quote token first gets the
// "Get test funds" strip; `?funds=1` shows it to any connected wallet.
import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { TIER_MEANING } from '../../../core/assets'
import type { AssetTier } from '../../../core/assets'
import { GUIDE_RETURN_ATTRIBUTE, guideAnchor } from '../../../core/guide'
import { intentInfo } from '../../../core/payoff/strategies'
import { shortTokens } from '../../../core/reserves/reserves'
import { useAssets, useBalances, useBalancesById, useHealth, useMarketsIndex, useMe, useNowSec, useOptionsClient } from '../../../data'
import { Button, Callout, EmptyNote, Link, PageHeader, Skeleton } from '../../../ui'
import { ASSETS_EMPTY, ASSETS_ERROR, ASSETS_HEADING, CHOICE_CANCEL, INTENTS_HEADING, INTENT_COPY, MARKETS_TITLE, REFRESH_FAILED, RETRY, SHOW_ALL, SHOW_REFERENCE, COL, listCountLine } from '../copy'
import { indexList, needsTestFunds } from '../model'
import { Money, ShortfallNotice } from '../parts'
import { EXACT, MARKETS_ROUTE, compactSearch, useMarketsSearch } from '../routing'
import { AssetsTable } from './AssetsTable'
import { GetFunds } from './GetFunds'
import { GuideSlip } from './GuideSlip'
import { IntentList } from './IntentList'
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
  const question = useRef<HTMLHeadingElement | null>(null)
  const intentsHeading = useRef<HTMLHeadingElement | null>(null)

  const intent = search.intent
  const showAll = search.all === '1'
  const quote = assets.data?.quote ?? null
  const list = index.data ? indexList(index.data, showAll) : null
  const tiers = list ? ([...new Set(list.rows.map((r) => r.tier))] as AssetTier[]) : []
  const firstRun = me !== null && quote !== null && balances.data !== undefined && (search.funds === '1' || needsTestFunds(balances.data, quote.contractId))
  const available = !index.isError && list !== null && list.rows.length > 0
  // The question "on which asset?" is only asked while there may be an asset to choose.
  const asking = intent !== undefined && !index.isError && !(list !== null && list.rows.length === 0) ? intent : undefined
  const shortList = shortTokens(health.data ?? [])
  const short = new Set(shortList.map((t) => t.contractId))
  // A short asset says so in its own row; a short quote token touches every row, so it keeps the notice.
  const shortElsewhere = list ? shortList.filter((t) => !list.rows.some((r) => r.asset.contractId === t.contractId)) : []
  const cash = asking && intentInfo(asking).starts === 'cash' && quote ? balancesById.data?.[quote.contractId] : undefined

  // An intent was chosen on this page: move to the question it asks, in view. Not on a fresh load or a history
  // move, where nothing on the page holds focus and the document should stay where it is.
  useEffect(() => {
    if (!intent) return
    const active = document.activeElement
    if (active === null || active === document.body) return
    question.current?.focus({ preventScroll: true })
    // A behavior passed in script overrides the stylesheet's reduced-motion rule, so it is decided here.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    question.current?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  }, [intent])

  const showReferenceLink = showAll && !!index.data && index.data.some((r) => !r.isReference) && index.data.some((r) => r.isReference)

  return (
    <div className={styles.page}>
      <PageHeader title={MARKETS_TITLE} />

      {firstRun && balances.data ? <GetFunds address={me} balances={balances.data} quoteId={quote.contractId} mock={isMock} onCheck={() => void balances.refetch()} checking={balances.isFetching} from={search.from} /> : null}
      <GuideSlip displaced={firstRun} pending={me !== null && (assets.isPending || balances.isPending)} after={intentsHeading} />

      <section className={styles.section} aria-labelledby="markets-intents" {...guideAnchor('intents')}>
        {/* Takes focus after "Not now", and back from a tour started from the welcome, which is gone by then. */}
        <h2 id="markets-intents" className={styles.heading} ref={intentsHeading} tabIndex={-1} {...{ [GUIDE_RETURN_ATTRIBUTE]: '' }}>
          {INTENTS_HEADING}
        </h2>
        <IntentList current={intent} showAll={showAll} rows={list?.rows ?? null} available={available || index.isLoading} balances={balancesById.data ?? null} quoteCode={quote?.code ?? 'USDx'} />
      </section>

      <section className={styles.section} aria-labelledby="markets-assets" aria-busy={index.isLoading || undefined} {...guideAnchor('assets')}>
        <div className={styles.sectionHead}>
          <div className={styles.headMain}>
            <h2 id="markets-assets" className={styles.heading} ref={question} tabIndex={-1}>
              {asking ? INTENT_COPY[asking].question : ASSETS_HEADING}
            </h2>
            {asking ? (
              <Link tone="quiet" render={<RouterLink to={MARKETS_ROUTE} search={showAll ? { all: '1' } : {}} activeOptions={EXACT} resetScroll={false} />}>
                {CHOICE_CANCEL}
              </Link>
            ) : null}
          </div>
          {list && list.hidden > 0 ? (
            <p className={styles.count}>
              {listCountLine(list.rows.length, list.hidden)}{' '}
              <Link render={<RouterLink to={MARKETS_ROUTE} search={compactSearch({ intent, all: '1' as const })} activeOptions={EXACT} resetScroll={false} />}>{SHOW_ALL}</Link>
            </p>
          ) : showReferenceLink ? (
            <p className={styles.count}>
              <Link render={<RouterLink to={MARKETS_ROUTE} search={compactSearch({ intent })} activeOptions={EXACT} resetScroll={false} />}>{SHOW_REFERENCE}</Link>
            </p>
          ) : null}
        </div>
        {cash && cash.balance !== null && quote ? (
          <p className={styles.cash}>
            {COL.hold} <Money units={cash.balance} token={quote} />
          </p>
        ) : null}

        {index.isError ? (
          <Callout variant="danger" title={ASSETS_ERROR} actions={<Button onClick={index.retry}>{RETRY}</Button>}>
            {index.error}
          </Callout>
        ) : !list || !quote ? (
          <Skeleton variant="rows" lines={4} />
        ) : list.rows.length === 0 ? (
          <EmptyNote title={ASSETS_EMPTY} />
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
            <ShortfallNotice tokens={shortElsewhere} />
            <AssetsTable rows={list.rows} quote={quote} nowSec={nowSec} intent={asking} holdings={me ? (balancesById.data ?? null) : null} short={short} />
            {tiers.length > 1 ? (
              <dl className={styles.legend}>
                {tiers.map((tier) => (
                  <div key={tier}>
                    <dt>{tier}</dt>
                    <dd>{TIER_MEANING[tier]}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
