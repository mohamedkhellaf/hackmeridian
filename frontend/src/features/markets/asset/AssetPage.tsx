// The asset page frame: header, sub-tabs, the mode switch and, on the Trade tab, the guided flow or the chain
// beside the order ticket. The two modes are owned by ./guided and ./chain; the ticket by features/ticket.
//
// The rail (from 1200 px) is a column only where it has something to hold: on the Trade tab always (in guided
// mode its idle content is the guided page's closing block, in chain mode it is empty until a price is
// picked), on the Requests tab only while a ticket is open. Below 1200 px the ticket is a drawer or a page.
import { useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { AssetSearch } from '../../../app/search'
import { QUOTE_ASSETS, assetParam, resolveAssetParam } from '../../../core/assets'
import type { TokenInfo } from '../../../core/options/types'
import { shortfallFor } from '../../../core/reserves/reserves'
import { referenceMode, useActivity, useAssets, useBid, useBids, useDefaultMode, useHealth, useMe, useNowSec, useOption } from '../../../data'
import { Button, Callout, Skeleton, useIsWide } from '../../../ui'
import { TicketHost, searchFromTicketIntent, ticketIntentFromSearch } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { ChainMode } from '../chain'
import { GuidedClosing, GuidedMode, shownSeriesOf } from '../guided'
import { ASSET_ERROR, ASSET_LOADING, RAIL_LABEL, RETRY } from '../copy'
import { assetRequests } from '../model'
import { ShortfallNotice } from '../parts'
import { ASSET_ROUTE, CLEAR_TICKET, compactSearch, useAssetParam, useAssetSearch, usePatchSearch } from '../routing'
import type { AssetMode, AssetTab } from '../routing'
import { AboutTab } from './AboutTab'
import { AssetHeader } from './AssetHeader'
import { AssetNotFound, AssetPageError, AssetPageSkeleton } from './AssetStates'
import { AssetTabs } from './AssetTabs'
import { RequestsTab } from './RequestsTab'
import styles from './AssetPage.module.css'

const idOf = (value: string | undefined): bigint | null => (value === undefined ? null : BigInt(value))
const sameSearch = (a: object, b: object): boolean => JSON.stringify(compactSearch(a)) === JSON.stringify(compactSearch(b))
const historyIndex = (state: unknown): number | null => {
  const index = (state as { __TSR_index?: unknown } | undefined)?.__TSR_index
  return typeof index === 'number' ? index : null
}

/** The subject of the order a ticket URL points at, as the Activity list names it (`option:12`, `bid:3`). */
function orderSubject(search: AssetSearch): string | null {
  if (search.offer !== undefined) return `option:${search.offer}`
  if (search.ask !== undefined) return `option:${search.ask}`
  if (search.bid !== undefined) return `bid:${search.bid}`
  return null
}

export function AssetPage() {
  const param = useAssetParam()
  const search = useAssetSearch()
  const location = useLocation()
  const router = useRouter()
  const assets = useAssets()
  const bids = useBids()
  const health = useHealth()
  const me = useMe()
  const activity = useActivity()
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

  // A ticket link under one asset that names an order on another (a crafted or mistyped link) is moved to the
  // asset of that order, so the page around the ticket is the right one.
  const linkedOption = useOption(idOf(search.offer ?? search.ask))
  const linkedBid = useBid(idOf(search.bid))
  const orderAsset = search.bid !== undefined ? linkedBid.data?.underlying : search.offer !== undefined || search.ask !== undefined ? linkedOption.data?.underlying : undefined
  useEffect(() => {
    if (!token || !orderAsset || orderAsset.contractId === token.contractId) return
    void navigate({ to: ASSET_ROUTE, params: { asset: assetParam(orderAsset) }, search: true, replace: true })
  }, [token, orderAsset, navigate])

  const mode: AssetMode = search.mode ?? defaultMode
  const tab: AssetTab = search.tab ?? 'trade'
  const guidedTrade = mode === 'guided' && tab === 'trade'

  const assetId = token?.contractId ?? null
  // From guided to the chain the series on screen goes with the user, also when the guided page chose it by
  // default: the chain opens on that deadline with the series selected (no ticket is opened for it).
  const setMode = useCallback(
    (next: AssetMode) => {
      setDefaultMode(next)
      const series = next === 'chain' && mode === 'guided' && assetId !== null ? shownSeriesOf(assetId) : null
      patch(series ? { mode: next, ...series } : { mode: next })
    },
    [patch, setDefaultMode, mode, assetId],
  )

  const intent = useMemo(() => (assetId ? ticketIntentFromSearch(search, assetId) : null), [search, assetId])

  // History. Opening a ticket adds an entry (Back then closes it, as a phone user expects); closing it returns to
  // the entry that opened it when nothing changed in between, and otherwise replaces the ticket's entry. Either
  // way Back never reopens a ticket the user closed.
  const index = historyIndex(location.state)
  const idle = useRef<{ index: number | null; search: AssetSearch } | null>(null)
  useEffect(() => {
    if (intent === null) idle.current = { index, search }
  }, [intent, index, search])
  // The search with the ticket's keys cleared. In guided mode the quantity and the premium are the user's guided
  // terms, not only fields of the ticket: closing the review to change a date must not lose them.
  const cleared = useMemo<Partial<AssetSearch>>(() => {
    const out: Partial<AssetSearch> = { ...CLEAR_TICKET, ...searchFromTicketIntent(null) }
    if (guidedTrade) {
      delete out.qty
      delete out.premium
    }
    return out
  }, [guidedTrade])
  const closeTicket = useCallback(() => {
    const before = idle.current
    if (before && before.index !== null && index === before.index + 1 && sameSearch(before.search, { ...search, ...cleared })) router.history.back()
    else patch(cleared, { replace: true })
  }, [patch, cleared, search, index, router])
  const changeIntent = useCallback((next: TicketIntent) => patch({ ...CLEAR_TICKET, ...searchFromTicketIntent(next) }, { replace: true }), [patch])

  // Back onto the entry of an order this browser has since bought, filled or cancelled: the order is gone, so the
  // entry opens the page without its ticket instead of a refusal on the user's own trade.
  const locationKey = (location.state as { __TSR_key?: string } | undefined)?.__TSR_key ?? location.href
  const latest = useRef({ entries: activity.entries, search, patch, cleared })
  useEffect(() => {
    latest.current = { entries: activity.entries, search, patch, cleared }
  })
  useEffect(() => {
    // Only when the entry is entered: a transaction confirmed while the ticket is open shows its receipt.
    const { entries, search: now, patch: apply, cleared: clear } = latest.current
    const subject = orderSubject(now)
    if (subject !== null && entries.some((e) => e.subject === subject && e.phase === 'confirmed')) apply(clear, { replace: true })
  }, [locationKey])

  // Closing the ticket in the rail can remove the control that opened it (the closing block is the rail's idle
  // content): focus then goes to the rail's first control instead of the document.
  const rail = useRef<HTMLDivElement | null>(null)
  const hadTicket = useRef(false)
  useEffect(() => {
    if (intent !== null) {
      hadTicket.current = true
      return
    }
    if (!hadTicket.current) return
    hadTicket.current = false
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== null && document.activeElement !== document.body) return
      rail.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [intent])

  // The rail column ends at the bottom of the screen even before the page is scrolled to its sticky top, so the
  // ticket's action bar, pinned to the bottom of the column, is in view as soon as the ticket opens.
  useRailFit(rail)

  const openRequests = useMemo(() => (assetId && bids.data ? assetRequests(bids.data, assetId, me, nowSec).filter((r) => r.open).length : undefined), [assetId, bids.data, me, nowSec])

  if (resolution.status === 'invalid') return <AssetNotFound reason="invalid" listed={listed} />
  if (!token) {
    if (listed) return <AssetNotFound reason="unknown" listed={listed} />
    if (assets.isError) return <AssetPageError message={assets.error instanceof Error ? assets.error.message : null} onRetry={() => void assets.refetch()} />
    return <AssetPageSkeleton />
  }

  const ready = listed !== undefined
  const failed = !ready && assets.isError
  const hasRail = tab !== 'about'
  // The Requests tab spans the full width until a ticket opens.
  const railColumn = hasRail && (tab === 'trade' || intent !== null)
  // The guided page's closing block lives in the rail from 1200 px; GuidedMode renders it in the page below.
  // In chain mode the rail is empty until a price is picked (the line under the chain says what to do).
  const railIdle = guidedTrade && wide ? <GuidedClosing assetId={token.contractId} /> : null
  const landmark = wide && railColumn && (intent !== null || railIdle !== null)

  return (
    <div className={styles.page} data-tab={tab}>
      <AssetHeader token={token} quote={quote} />
      <ShortfallNotice tokens={shortfallFor({ underlying: token, quote }, health.data ?? [])} />
      <AssetTabs param={param} tab={tab} mode={mode} urlMode={search.mode} onModeChange={setMode} requests={openRequests} />
      {failed ? (
        <Callout variant="danger" title={ASSET_ERROR} actions={<Button onClick={() => void assets.refetch()}>{RETRY}</Button>}>
          {assets.error instanceof Error ? assets.error.message : null}
        </Callout>
      ) : ready ? (
        <div className={styles.body} data-rail={railColumn || undefined}>
          <div className={styles.main}>
            {tab === 'trade' ? mode === 'chain' ? <ChainMode assetId={token.contractId} /> : <GuidedMode assetId={token.contractId} /> : null}
            {tab === 'requests' ? <RequestsTab token={token} /> : null}
            {tab === 'about' ? <AboutTab token={token} /> : null}
          </div>
          {hasRail ? (
            // A landmark only where it is a column with something in it: below 1200 px the ticket opens over the page
            // and this box is empty, and in chain mode it is empty until a price is picked. One element in every
            // case, so the ticket keeps its state when the window crosses the width. In guided mode the intent
            // picker is the one side switch: the ticket has no Buy, Write and Request tabs there (F4).
            <div ref={rail} className={styles.rail} role={landmark ? 'complementary' : undefined} aria-label={landmark ? RAIL_LABEL : undefined}>
              <TicketHost placement="rail" intent={intent} startAt={search.step} onClose={closeTicket} onIntentChange={changeIntent} idle={railIdle} sides={!guidedTrade} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.loading} aria-busy="true">
          <span className="ui-vh">{ASSET_LOADING}</span>
          <Skeleton variant="rows" lines={mode === 'chain' && tab === 'trade' ? 8 : 5} />
        </div>
      )}
    </div>
  )
}

/** Publishes where the rail starts in the viewport as `--rail-top`, which bounds its height (AssetPage.module.css). */
function fitRail(el: HTMLElement | null): void {
  if (!el) return
  el.style.setProperty('--rail-top', `${Math.max(0, Math.round(el.getBoundingClientRect().top))}px`)
}

function useRailFit(rail: { current: HTMLDivElement | null }): void {
  // Every render can move the rail (the header and the tabs load); scrolling and resizing move it too.
  useLayoutEffect(() => fitRail(rail.current))
  useEffect(() => {
    let frame = 0
    const queue = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fitRail(rail.current))
    }
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
    }
  }, [rail])
}
