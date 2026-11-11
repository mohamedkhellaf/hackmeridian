// One hook per Covered contract write. Each returns the staged transaction state for a ticket's Sign step and a
// `run` with the call's own arguments. No optimistic update anywhere: the screen shows the stages, then the
// fresh reads that the confirmation invalidates (see tx/invalidation.ts for which).
//
//   const buy = useBuy()
//   const { state, result } = await buy.run(offer)        // never rejects
//   buy.state.phase   // idle | checking | signing | submitting | pending | confirmed | failed | unknown | expired | declined
//   buy.checkAgain()  // only for `unknown`; a transaction whose outcome is unknown is never sent again
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { OptionsClient } from '../core/options/client'
import { requiredCollateral } from '../core/options/types'
import type { NewOffer, OptionOffer, SupportedAssets, TokenInfo, TxResult } from '../core/options/types'
import { claimAmount } from '../core/portfolio/positions'
import type { Bid, NewBid } from '../core/requests/types'
import { TxError } from '../core/tx/errors'
import type { TxOptions, TxReceipt } from '../core/tx/types'
import { formatUnits, formatUtc, withUnit } from '../core/format'
import { exactStrikePerUnit } from '../core/series'
import { amt } from '../core/units'
import { keys } from './keys'
import { TX_NOT_CONNECTED } from './tx/copy'
import { bidSubject, optionSubject } from './tx/invalidation'
import type { CoveredAction } from './tx/invalidation'
import { useTx } from './tx/useTx'
import type { TxController, TxDescription, UseTxOptions } from './tx/useTx'
import type { TxRun } from './tx/runner'
import { useOptionsClient } from './useOptionsClient'

/** A Covered write bound to its arguments. Everything but `run` is the shared `TxController`. */
export interface CoveredTx<A extends unknown[], R> extends Omit<TxController, 'run'> {
  run: (...args: A) => Promise<TxRun<R>>
}

export type MutationOptions = Pick<UseTxOptions, 'announce' | 'open'>

type Terms = { kind: 'put' | 'call'; underlying: TokenInfo; underlyingQty: bigint }
const on = (o: Terms): string => `${o.kind} on ${amt(o.underlyingQty, o.underlying)}`

// The second line of an Activity entry: the series behind the label's quantity. The strike is per unit when
// that is an exact amount, else the total (nothing is rounded into a figure the contract does not hold).
type Series = Terms & { totalStrike: bigint; expiry: number }
function strike(o: Series, quote: TokenInfo): string {
  const perUnit = exactStrikePerUnit(o)
  return perUnit === null ? `total strike ${amt(o.totalStrike, quote)}` : `strike ${withUnit(formatUnits(perUnit, quote.decimals), quote.code)} per ${o.underlying.code}`
}
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
/** `Strike 10.20 USDx per FUND, deadline 13 Nov 2026, 08:00 UTC`: for a label that already names kind and quantity. */
const terms = (o: Series, quote: TokenInfo): string => capital(`${strike(o, quote)}, deadline ${formatUtc(o.expiry)}`)
/** `Call on 1.00 BOND, strike 98.00 USDx per BOND, deadline ...`: for a label that names only an amount. */
const fullTerms = (o: Series, quote: TokenInfo): string => capital(`${on(o)}, ${strike(o, quote)}, deadline ${formatUtc(o.expiry)}`)
/** A new offer or bid carries no quote token of its own: the contract's is passed in when the asset list is loaded. */
const newTerms = (o: Series, quote: TokenInfo | null): string => (quote ? terms(o, quote) : `Deadline ${formatUtc(o.expiry)}`)

export interface CoveredWrite<A extends unknown[], R extends TxReceipt> {
  action: CoveredAction
  describe: (...args: A) => Omit<TxDescription, 'action'>
  /** For a write whose arguments carry no quote token (a new offer, a new bid): the detail line, given the contract's. */
  detail?: (order: A[0], quote: TokenInfo | null) => string
  /** The same for the label, so it can carry the money that moves ("locking 95.00 USDx"). Falls back to `describe`. */
  label?: (order: A[0], quote: TokenInfo | null) => string
  /** What the confirmed write created (`option:<id>`, `bid:<id>`), recorded on its Activity entry. */
  created?: (result: R) => string | null
  write: (client: OptionsClient, me: string, opts: Required<TxOptions>, ...args: A) => Promise<R>
}

function useCoveredTx<A extends unknown[], R extends TxReceipt>(spec: CoveredWrite<A, R>, options: MutationOptions = {}): CoveredTx<A, R> {
  const tx = useTx({ product: 'covered', announce: options.announce, open: options.open })
  const { getClient, me } = useOptionsClient()
  const qc = useQueryClient()
  const { run: runTx, ...rest } = tx
  const run = useCallback(
    (...args: A) => {
      const described = spec.describe(...args)
      // The asset list is in the cache whenever a ticket is open; without it the line falls back to the deadline.
      const quote = qc.getQueryData<SupportedAssets>(keys.assets())?.quote ?? null
      const detail = spec.detail ? spec.detail(args[0], quote) : described.detail
      const label = spec.label ? spec.label(args[0], quote) : described.label
      return runTx<R>(
        { ...described, label, detail, action: spec.action },
        async (opts) => {
          // `useTx` already refuses without a wallet; this guards a wallet that disconnects in between.
          if (!me) throw new TxError('refused', TX_NOT_CONNECTED)
          return spec.write(await getClient(), me, opts, ...args)
        },
        spec.created,
      )
    },
    [runTx, getClient, me, spec, qc],
  )
  return { ...rest, run }
}

// The specs are module constants so every hook's `run` keeps its identity between renders.

const BUY: CoveredWrite<[offer: OptionOffer], TxResult> = {
  action: 'buy',
  describe: (o) => ({ label: `Buy ${on(o)} for ${amt(o.totalPremium, o.quote)}`, detail: terms(o, o.quote), done: 'Bought', subject: optionSubject(o.id) }),
  write: (c, me, opts, o) => c.buy(o.id, me, opts),
}
const EXERCISE: CoveredWrite<[option: OptionOffer], TxResult> = {
  action: 'exercise',
  describe: (o) => ({ label: `Exercise ${on(o)}`, detail: terms(o, o.quote), done: 'Exercised', subject: optionSubject(o.id) }),
  write: (c, me, opts, o) => c.exercise(o.id, me, opts),
}
const CLAIM: CoveredWrite<[option: OptionOffer], TxResult> = {
  action: 'claim-delivery',
  describe: (o) => {
    const c = claimAmount(o)
    return { label: `Claim ${amt(c.amount, c.token)}`, detail: fullTerms(o, o.quote), done: 'Delivery claimed', subject: optionSubject(o.id) }
  },
  write: (c, me, opts, o) => c.claimDelivery(o.id, me, opts),
}
const RECLAIM: CoveredWrite<[option: OptionOffer], TxResult> = {
  action: 'reclaim',
  describe: (o) => {
    const c = requiredCollateral(o)
    return { label: `Reclaim ${amt(c.amount, c.token)}`, detail: fullTerms(o, o.quote), done: 'Reclaimed', subject: optionSubject(o.id) }
  },
  write: (c, me, opts, o) => c.reclaim(o.id, me, opts),
}
const CANCEL_OFFER: CoveredWrite<[offer: OptionOffer], TxResult> = {
  action: 'cancel-offer',
  describe: (o) => ({ label: `Cancel offer of ${on(o)}`, detail: terms(o, o.quote), done: 'Offer cancelled', subject: optionSubject(o.id) }),
  write: (c, me, opts, o) => c.cancelOffer(o.id, me, opts),
}
const WRITE_OFFER: CoveredWrite<[offer: NewOffer], TxResult & { id: bigint }> = {
  action: 'write-offer',
  describe: (o) => ({ label: `Write ${on(o)}`, done: 'Offer written', subject: null }),
  detail: newTerms,
  // What the maker locks and asks: the collateral (the strike in the quote token for a put, the underlying for a call).
  label: (o, quote) => {
    const ask = quote ? `, asking ${amt(o.totalPremium, quote)}` : ''
    if (o.kind === 'call') return `Write ${on(o)}, locking ${amt(o.underlyingQty, o.underlying)}${ask}`
    return quote ? `Write ${on(o)}, locking ${amt(o.totalStrike, quote)}${ask}` : `Write ${on(o)}`
  },
  created: (r) => optionSubject(r.id),
  write: (c, me, opts, o) => c.createOffer(o, me, opts),
}
const LIST_FOR_SALE: CoveredWrite<[option: OptionOffer, askTotal: bigint], TxResult> = {
  action: 'list-for-sale',
  describe: (o, ask) => ({ label: `List ${on(o)} for ${amt(ask, o.quote)}`, detail: terms(o, o.quote), done: 'Listed for sale', subject: optionSubject(o.id) }),
  write: (c, me, opts, o, ask) => c.listForSale(o.id, me, ask, opts),
}
const CANCEL_SALE: CoveredWrite<[option: OptionOffer], TxResult> = {
  action: 'cancel-sale',
  describe: (o) => ({ label: `Cancel listing of ${on(o)}`, detail: terms(o, o.quote), done: 'Listing cancelled', subject: optionSubject(o.id) }),
  write: (c, me, opts, o) => c.cancelSale(o.id, me, opts),
}
const BUY_RESALE: CoveredWrite<[option: OptionOffer, maxTotal: bigint], TxResult> = {
  action: 'buy-resale',
  describe: (o, max) => ({ label: `Buy ${on(o)} from its holder for ${amt(max, o.quote)}`, detail: terms(o, o.quote), done: 'Bought from holder', subject: optionSubject(o.id) }),
  write: (c, me, opts, o, max) => c.buyResale(o.id, me, max, opts),
}
const CREATE_BID: CoveredWrite<[bid: NewBid], TxResult & { id: bigint }> = {
  action: 'create-bid',
  describe: (b) => ({ label: `Request ${on(b)}`, done: 'Request posted', subject: null }),
  detail: newTerms,
  label: (b, quote) => (quote ? `Request ${on(b)}, escrowing ${amt(b.totalPremium, quote)}` : `Request ${on(b)}`),
  created: (r) => bidSubject(r.id),
  write: (c, me, opts, b) => c.createBid(b, me, opts),
}
const CANCEL_BID: CoveredWrite<[bid: Bid], TxResult> = {
  action: 'cancel-bid',
  describe: (b) => ({ label: `Cancel request for ${on(b)}`, detail: terms(b, b.quote), done: 'Request cancelled', subject: bidSubject(b.id) }),
  write: (c, me, opts, b) => c.cancelBid(b.id, me, opts),
}
const FILL_BID: CoveredWrite<[bid: Bid], TxResult & { optionId: bigint }> = {
  action: 'fill-bid',
  describe: (b) => {
    const locks = requiredCollateral(b)
    return { label: `Fill request for ${on(b)}, locking ${amt(locks.amount, locks.token)}, receiving ${amt(b.totalPremium, b.quote)}`, detail: terms(b, b.quote), done: 'Request filled', subject: bidSubject(b.id) }
  },
  created: (r) => optionSubject(r.optionId),
  write: (c, me, opts, b) => c.fillBid(b.id, me, opts),
}

/** The twelve writes as data (action, label, client call), for the hooks below and for tests. */
export const COVERED_WRITES = {
  buy: BUY,
  exercise: EXERCISE,
  claimDelivery: CLAIM,
  reclaim: RECLAIM,
  cancelOffer: CANCEL_OFFER,
  writeOffer: WRITE_OFFER,
  listForSale: LIST_FOR_SALE,
  cancelSale: CANCEL_SALE,
  buyResale: BUY_RESALE,
  createBid: CREATE_BID,
  cancelBid: CANCEL_BID,
  fillBid: FILL_BID,
} as const

/** Buy a maker's funded offer: pays the premium, the buyer becomes the holder. `run(offer)`. */
export const useBuy = (options?: MutationOptions): CoveredTx<[offer: OptionOffer], TxResult> => useCoveredTx(BUY, options)

/** Exercise a held option before its deadline: delivers one leg, receives the other, atomically. `run(option)`. */
export const useExercise = (options?: MutationOptions): CoveredTx<[option: OptionOffer], TxResult> => useCoveredTx(EXERCISE, options)

/** Writer claims what an exercise left in the contract (put: the underlying; call: the strike). `run(option)`. */
export const useClaimDelivery = (options?: MutationOptions): CoveredTx<[option: OptionOffer], TxResult> => useCoveredTx(CLAIM, options)

/** Writer takes the collateral of an expired option or offer back. `run(option)`. */
export const useReclaim = (options?: MutationOptions): CoveredTx<[option: OptionOffer], TxResult> => useCoveredTx(RECLAIM, options)

/** Writer cancels an open offer and gets the collateral back. `run(offer)`. */
export const useCancelOffer = (options?: MutationOptions): CoveredTx<[offer: OptionOffer], TxResult> => useCoveredTx(CANCEL_OFFER, options)

/** Write a new offer and lock its collateral. `run(newOffer)`; the result carries the new option `id`. */
export const useWriteOffer = (options?: MutationOptions): CoveredTx<[offer: NewOffer], TxResult & { id: bigint }> => useCoveredTx(WRITE_OFFER, options)

/** Holder lists an active option for sale, or changes its price. `run(option, askTotal)`. */
export const useListForSale = (options?: MutationOptions): CoveredTx<[option: OptionOffer, askTotal: bigint], TxResult> => useCoveredTx(LIST_FOR_SALE, options)

/** Holder withdraws a resale listing. `run(option)`. */
export const useCancelSale = (options?: MutationOptions): CoveredTx<[option: OptionOffer], TxResult> => useCoveredTx(CANCEL_SALE, options)

/** Buy an option from its holder. `run(option, maxTotal)`: `maxTotal` is the ask the buyer reviewed; a higher live ask is refused. */
export const useBuyResale = (options?: MutationOptions): CoveredTx<[option: OptionOffer, maxTotal: bigint], TxResult> => useCoveredTx(BUY_RESALE, options)

/** Post a request (bid) and escrow its premium. `run(newBid)`; the result carries the new bid `id`. */
export const useCreateBid = (options?: MutationOptions): CoveredTx<[bid: NewBid], TxResult & { id: bigint }> => useCoveredTx(CREATE_BID, options)

/** Buyer cancels a request, open or past its deadline; the escrowed premium comes back. `run(bid)`. */
export const useCancelBid = (options?: MutationOptions): CoveredTx<[bid: Bid], TxResult> => useCoveredTx(CANCEL_BID, options)

/** Maker fills a request: locks the collateral, receives the escrowed premium. `run(bid)`; the result carries the new `optionId`. */
export const useFillBid = (options?: MutationOptions): CoveredTx<[bid: Bid], TxResult & { optionId: bigint }> => useCoveredTx(FILL_BID, options)
