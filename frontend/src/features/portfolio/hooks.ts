// What the portfolio reads besides the positions themselves: which options this browser bought from a holder,
// which were created by filling a request, and which tokens the contract holds less of than it owes.
import { useEffect, useMemo, useState } from 'react'
import type { CollateralHealth, OptionOffer, TokenInfo } from '../../core/options/types'
import { shortfallFor } from '../../core/reserves/reserves'
import { optionSubject, useActivity, useBids, useHealth } from '../../data'

/** Option ids this wallet bought from their previous holder, from this browser's confirmed transactions. */
export function useResaleBought(): ReadonlySet<string> {
  const { entries } = useActivity()
  return useMemo(() => new Set(entries.filter((e) => e.action === 'buy-resale' && e.phase === 'confirmed' && e.subject).map((e) => e.subject as string)), [entries])
}

/** True when this browser bought the option from its previous holder: the original premium is then not what the wallet paid. */
export function useResold(option: Pick<OptionOffer, 'id'> | null): boolean {
  const bought = useResaleBought()
  return option ? bought.has(optionSubject(option.id)) : false
}

/** True when a filled request created the option: its buyer escrowed the premium before a maker filled it. */
export function useFromRequest(option: Pick<OptionOffer, 'id'> | null): boolean {
  const bids = useBids({ enabled: option !== null })
  return useMemo(() => (option ? (bids.data ?? []).some((b) => b.state === 'filled' && b.optionId === option.id) : false), [bids.data, option])
}

const NO_HEALTH: CollateralHealth[] = []

/** What the contract owes and holds per token, for the clawback shortfall. Empty while unknown. */
export function useReserveHealth(): CollateralHealth[] {
  return useHealth().data ?? NO_HEALTH
}

/** The short tokens that touch this option or request: its underlying or its quote token (core/reserves). */
export const shortOf = (o: Pick<OptionOffer, 'underlying' | 'quote'>, health: CollateralHealth[]): TokenInfo[] => shortfallFor(o, health)

/** Whether a payout in `token` is short. */
export const isShort = (token: Pick<TokenInfo, 'contractId'>, short: readonly TokenInfo[]): boolean => short.some((t) => t.contractId === token.contractId)

const SEEN_KEY = 'stellsec.portfolio.offers.v1.'

function readSeen(address: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY + address)
    if (!raw) return null
    const ids: unknown = JSON.parse(raw)
    return Array.isArray(ids) ? new Set(ids.filter((id): id is string => typeof id === 'string')) : null
  } catch {
    return null
  }
}

function writeSeen(address: string, ids: readonly string[]): void {
  try {
    localStorage.setItem(SEEN_KEY + address, JSON.stringify(ids))
  } catch {
    // No storage here (a private window, blocked site data): nothing is marked as new next time.
  }
}

/**
 * The wallet's options that were open offers when it last opened Portfolio in this browser and have found a buyer
 * since. A convenience kept in this browser only: the chain has no history the app reads yet. Worked out once per
 * wallet and visit, from what the previous visit stored; this visit's open offers are stored once, for the next.
 */
export function useSoldSinceLastVisit(me: string | null, offers: readonly OptionOffer[] | null): ReadonlySet<bigint> {
  const [visit, setVisit] = useState<{ me: string; ids: ReadonlySet<bigint> } | null>(null)
  // Worked out while rendering, the first time this wallet's options are known (React's pattern for state that
  // follows a prop): reading storage is pure, and the result is kept for the rest of the visit.
  let current = visit
  if (me && offers && visit?.me !== me) {
    const before = readSeen(me)
    const ids = new Set<bigint>()
    if (before) for (const o of offers) if (o.writer === me && o.holder !== null && before.has(o.id.toString())) ids.add(o.id)
    current = { me, ids }
    setVisit(current)
  }
  const ready = current?.me === me
  useEffect(() => {
    if (!me || !offers || !ready) return
    writeSeen(
      me,
      offers.filter((o) => o.writer === me && o.state === 'offered').map((o) => o.id.toString()),
    )
    // Stored once per visit and wallet, when the marks were worked out: a sale seen during this visit is marked on the next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, ready])
  return ready && current ? current.ids : NO_IDS
}

const NO_IDS: ReadonlySet<bigint> = new Set()
