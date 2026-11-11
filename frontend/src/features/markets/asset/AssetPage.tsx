// The asset page frame: header, sub-tabs, the mode switch and, on the Trade tab, the guided flow or the chain
// beside the order ticket. The two modes are owned by ./guided and ./chain; the ticket by features/ticket.
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo } from 'react'
import type { AssetSearch } from '../../../app/search'
import { QUOTE_ASSETS, resolveAssetParam } from '../../../core/assets'
import type { TokenInfo } from '../../../core/options/types'
import { shortfallFor } from '../../../core/reserves/reserves'
import { referenceMode, useAssets, useBids, useDefaultMode, useHealth, useMe, useNowSec } from '../../../data'
import { Skeleton, useIsWide } from '../../../ui'
import { TicketHost, searchFromTicketIntent, ticketIntentFromSearch } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { ChainMode } from '../chain'
import { GuidedMode } from '../guided'
import { ASSET_LOADING, RAIL_LABEL } from '../copy'
import { assetRequests } from '../model'
import { ShortfallNotice } from '../parts'
import { ASSET_ROUTE, CLEAR_TICKET, useAssetParam, useAssetSearch, usePatchSearch } from '../routing'
import type { AssetMode, AssetTab } from '../routing'
import { AboutTab } from './AboutTab'
import { AssetHeader } from './AssetHeader'
import { AssetNotFound, AssetPageError, AssetPageSkeleton } from './AssetStates'
import { AssetTabs } from './AssetTabs'
import { RequestsTab } from './RequestsTab'
import { TicketIdle } from './TicketIdle'
import styles from './AssetPage.module.css'

export function AssetPage() {
  const param = useAssetParam()
  const search = useAssetSearch()
  const assets = useAssets()
  const bids = useBids()
  const health = useHealth()
  const me = useMe()
  const nowSec = useNowSec(30)
  const navigate = useNavigate()
  const patch = usePatchSearch<AssetSearch>()
  const [defaultMode, setDefaultMode] = useDefaultMode()
  const wide = useIsWide()

  const network = referenceMode()
  const listed = assets.data?.underlyings
  const resolution = useMemo(() => resolveAssetParam(param, network, listed ?? []), [param, network, listed])
  const canonical = resolution.status === 'found' && !resolution.isCanonical ? resolution.canonical : null

  // The app's reference list resolves a slug before the contract has answered, so the head of the page is
  // there at once. The contract's own list then confirms the asset, or the page says it is not listed.
  const token = useMemo<TokenInfo | null>(() => {
    if (resolution.status !== 'found') return null
    const fromContract = listed?.find((t) => t.contractId === resolution.contractId)
    if (fromContract || listed) return fromContract ?? null
    const ref = resolution.reference
    return ref ? { contractId: ref.contractId, code: ref.code, decimals: ref.decimals, issuer: ref.issuer } : null
  }, [resolution, listed])
  const quote = useMemo<TokenInfo>(() => {
    const q = assets.data?.quote ?? QUOTE_ASSETS[network]
    return { contractId: q.contractId, code: q.code, decimals: q.decimals, issuer: q.issuer }
  }, [assets.data, network])

  // An accepted alias (a contract id, CODE-ISSUER of a reference asset) is replaced by the canonical segment.
  useEffect(() => {
    if (canonical === null) return
    void navigate({ to: ASSET_ROUTE, params: { asset: canonical }, search: true, replace: true })
  }, [canonical, navigate])

  const mode: AssetMode = search.mode ?? defaultMode
  const tab: AssetTab = search.tab ?? 'trade'
  const guidedTrade = mode === 'guided' && tab === 'trade'

  const setMode = useCallback(
    (next: AssetMode) => {
      setDefaultMode(next)
      patch({ mode: next })
    },
    [patch, setDefaultMode],
  )

  const assetId = token?.contractId ?? null
  const intent = useMemo(() => (assetId ? ticketIntentFromSearch(search, assetId) : null), [search, assetId])
  const closeTicket = useCallback(() => {
    const cleared: Partial<AssetSearch> = { ...CLEAR_TICKET, ...searchFromTicketIntent(null) }
    // In guided mode the quantity and the premium are the user's guided terms, not only fields of the ticket:
    // closing the review to change a date must not lose them.
    if (guidedTrade) {
      delete cleared.qty
      delete cleared.premium
    }
    patch(cleared)
  }, [patch, guidedTrade])
  const changeIntent = useCallback((next: TicketIntent) => patch({ ...CLEAR_TICKET, ...searchFromTicketIntent(next) }, { replace: true }), [patch])
  const openRequests = useMemo(() => (assetId && bids.data ? assetRequests(bids.data, assetId, me, nowSec).filter((r) => r.open).length : undefined), [assetId, bids.data, me, nowSec])

  if (resolution.status === 'invalid') return <AssetNotFound reason="invalid" listed={listed} />
  if (!token) {
    if (listed) return <AssetNotFound reason="unknown" listed={listed} />
    if (assets.isError) return <AssetPageError message={assets.error instanceof Error ? assets.error.message : null} onRetry={() => void assets.refetch()} />
    return <AssetPageSkeleton />
  }
  if (!listed && assets.isError) return <AssetPageError message={assets.error instanceof Error ? assets.error.message : null} onRetry={() => void assets.refetch()} />

  const withRail = tab !== 'about'
  const ready = listed !== undefined

  return (
    <div className={styles.page} data-tab={tab}>
      <AssetHeader token={token} quote={quote} />
      <ShortfallNotice tokens={shortfallFor({ underlying: token, quote }, health.data ?? [])} />
      <AssetTabs param={param} tab={tab} mode={mode} urlMode={search.mode} onModeChange={setMode} requests={openRequests} />
      {ready ? (
        <div className={styles.body} data-rail={withRail || undefined}>
          <div className={styles.main}>
            {tab === 'trade' ? mode === 'chain' ? <ChainMode assetId={token.contractId} /> : <GuidedMode assetId={token.contractId} /> : null}
            {tab === 'requests' ? <RequestsTab token={token} /> : null}
            {tab === 'about' ? <AboutTab token={token} /> : null}
          </div>
          {withRail ? (
            // A landmark only where it is a column: below 1200 px the ticket opens over the page and this box is
            // empty. One element in both cases, so the ticket keeps its state when the window crosses the width.
            <div className={styles.rail} role={wide ? 'complementary' : undefined} aria-label={wide ? RAIL_LABEL : undefined}>
              <TicketHost placement="rail" intent={intent} startAt={search.step} onClose={closeTicket} onIntentChange={changeIntent} idle={<TicketIdle token={token} tab={tab} mode={mode} />} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.body} data-rail={withRail || undefined} aria-busy="true">
          <span className="ui-vh">{ASSET_LOADING}</span>
          <Skeleton variant="block" height="26rem" />
          <Skeleton variant="block" height="18rem" className={styles.railBone} />
        </div>
      )}
    </div>
  )
}
