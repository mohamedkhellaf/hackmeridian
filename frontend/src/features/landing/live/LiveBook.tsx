// The only part of the landing that reads the chain (or the demo book). The page imports this file with a
// dynamic `import()` once the browser is idle, so the first paint never waits for it and never triggers the load
// of a chain client. It renders nothing: it reads, picks the open put the hero shows, and reports plain data.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { assetParam } from '../../../core/assets'
import { requiredCollateral } from '../../../core/options/types'
import { priceOf } from '../../../core/reference'
import { expiryDayKey } from '../../../core/series'
import { plainAmount, premiumUnits } from '../../../core/units'
import { useLedger, useMarket, useMarketsIndex, useNowSec, useOptionsClient } from '../../../data'
import { searchFromTicketIntent } from '../../ticket'
import { putChoices, selectFloor } from '../hero/selection'
import type { LiveChoices, LiveOffer, LivePick, LiveState } from './types'

export interface LiveBookProps {
  pick: LivePick
  onChange: (state: LiveState) => void
}

export default function LiveBook({ pick, onChange }: LiveBookProps) {
  const { isMock } = useOptionsClient()
  // The landing is not a trading screen: one read a minute is enough for an example.
  const index = useMarketsIndex({ cadence: 'slow' })
  const ledgerQuery = useLedger()
  const nowSec = useNowSec(60)
  const ledger = ledgerQuery.data?.sequence ?? null

  // Only assets of the app's reference list can become the example, and only when a maker has a put on offer.
  const rows = index.data
  const assets = useMemo(() => (rows ?? []).filter((r) => r.isReference && r.summary.lowestPut !== null), [rows])
  const assetId = assets.find((r) => r.asset.contractId === pick.assetId)?.asset.contractId ?? assets[0]?.asset.contractId ?? null
  const market = useMarket(assetId, { cadence: 'slow' })
  const view = market.data
  const pickStrike = pick.strike ?? null
  const pickExpiry = pick.expiry ?? null

  const open = useMemo((): { offer: LiveOffer; choices: LiveChoices } | null => {
    if (!view || assetId === null) return null
    const choices = putChoices(view)
    const selection = selectFloor(choices, { strike: pickStrike, expiry: pickExpiry }, priceOf(view.reference), nowSec)
    const chosen = selection.chosen
    const option = chosen?.row.offer
    if (!chosen || !option) return null
    const row = chosen.row
    const resale = row.source === 'resale'
    const reference = priceOf(view.reference)
    const offer: LiveOffer = {
      id: option.id,
      source: resale ? 'resale' : 'maker',
      underlying: row.underlying,
      quote: row.quote,
      underlyingQty: row.underlyingQty,
      totalStrike: row.totalStrike,
      totalPremium: row.totalPremium,
      expiry: row.expiry,
      strikePerUnit: chosen.strikePerUnit,
      seller: row.counterparty,
      collateral: requiredCollateral(option).amount,
      reference: reference === null ? null : { perUnit: reference, label: view.reference.label },
      assetParam: assetParam(row.underlying),
      ticketSearch: searchFromTicketIntent(resale ? { mode: 'buy-resale', optionId: option.id } : { mode: 'buy', offerId: option.id }),
      guidedSearch: {
        mode: 'guided',
        intent: 'floor',
        kind: 'put',
        strike: plainAmount(chosen.strikePerUnit, row.quote.decimals),
        expiry: expiryDayKey(row.expiry),
        qty: plainAmount(row.underlyingQty, row.underlying.decimals),
      },
    }
    const here = choices.filter((c) => c.expiry === chosen.expiry)
    return {
      offer,
      choices: {
        assets: assets.map((r) => ({ id: r.asset.contractId, code: r.asset.code, typeLabel: r.typeLabel })),
        assetId,
        strikes: here.map((c) => ({ value: c.strikePerUnit, perUnit: premiumUnits(c.row) })),
        expiries: selection.expiries,
        movedFrom: selection.movedFrom,
      },
    }
  }, [view, assetId, assets, pickStrike, pickExpiry, nowSec])

  const failed = index.isError || (assetId !== null && market.isError)
  const waiting = index.isLoading || (assetId !== null && market.isLoading)
  // The hooks hand out a new retry function on every render; the reported state must not change with them.
  const retryIndex = index.retry
  const retryMarket = market.retry
  const retryRef = useRef<() => void>(() => {})
  useEffect(() => {
    retryRef.current = () => {
      retryIndex()
      retryMarket()
    }
  }, [retryIndex, retryMarket])
  const retry = useCallback(() => retryRef.current(), [])

  // What is open anyway (off the standard grid, or calls only), so the note never says "nothing" when there is something.
  const openOffers = useMemo(() => (rows ?? []).filter((r) => r.isReference).reduce((n, r) => n + r.summary.offers + r.summary.listings, 0), [rows])

  const state = useMemo((): LiveState => {
    const common = { mock: isMock, ledger }
    if (failed) return { ...common, status: 'error', retry }
    if (waiting) return { ...common, status: 'loading' }
    if (!open) return { ...common, status: 'none', openOffers }
    return { ...common, status: 'open', ...open }
  }, [isMock, ledger, failed, waiting, open, openOffers, retry])

  useEffect(() => {
    onChange(state)
  }, [state, onChange])

  return null
}
