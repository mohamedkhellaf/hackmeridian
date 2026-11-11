import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { findBannedWords } from '../core/disclosures'
import { DEMO_HEDGERS, DEMO_WALLETS } from '../core/options/demoAccounts'
import { MockOptionsClient } from '../core/options/mockClient'
import { demoSeed } from '../core/options/mockSeed'
import type { NewOffer, OptionOffer } from '../core/options/types'
import type { TxReceipt } from '../core/tx/types'
import { FIXED_MS, FIXED_SEC } from './derived/demoSource.testhelper'
import { keys } from './keys'
import { COVERED_WRITES } from './mutations'
import type { CoveredWrite } from './mutations'
import { coveredQueries } from './queries'
import { createQueryClient } from './queryClient'
import { createActivityStore } from './tx/activityStore'
import { createFlights } from './tx/flights'
import { checkEntry, runTransaction } from './tx/runner'
import type { RunnerDeps, TxMeta, TxRun } from './tx/runner'
import { makeRunnerDeps } from './tx/useTx'

const A = DEMO_WALLETS.a
const B = DEMO_WALLETS.b
const W = COVERED_WRITES

let client: MockOptionsClient
let qc: QueryClient
let deps: RunnerDeps
const getClient = async () => client

/** Lets the mock's stage delays pass on the fake clock until `p` settles. */
async function flush<T>(p: Promise<T>): Promise<T> {
  let done = false
  p.then(
    () => (done = true),
    () => (done = true),
  )
  while (!done) await vi.advanceTimersByTimeAsync(50)
  return p
}

/** Runs one write the way `useCoveredTx` does: describe, then call the client through the runner. */
function send<Args extends unknown[], R extends TxReceipt>(spec: CoveredWrite<Args, R>, me: string, ...args: Args): Promise<TxRun<R>> {
  const d = spec.describe(...args)
  const meta: TxMeta = { product: 'covered', action: spec.action, label: d.label, done: d.done ?? null, subject: d.subject ?? null, address: me, mock: true }
  return flush(runTransaction(deps, meta, (opts) => spec.write(client, me, opts, ...args)))
}

const cached = () => ({
  options: keys.options(),
  asks: keys.asks(),
  bids: keys.bids(),
  collateral: keys.collateral(),
  health: keys.health(),
  assets: keys.assets(),
  balancesA: keys.balancesFor(A),
  balancesB: keys.balancesFor(B),
  eligibility: keys.eligibility('C_MOCK_FUND', A),
  writerCount: keys.writerOpenCount(A),
  buyerCount: keys.buyerOpenCount(B),
})
/** Names of the cached reads a transaction marked stale. */
const stale = () =>
  Object.entries(cached())
    .filter(([, key]) => qc.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort()

beforeAll(() => vi.useFakeTimers({ now: FIXED_MS }))
afterAll(() => vi.useRealTimers())

beforeEach(async () => {
  vi.setSystemTime(FIXED_MS)
  client = new MockOptionsClient(demoSeed(FIXED_SEC))
  qc = createQueryClient(true)
  deps = { ...makeRunnerDeps(qc, getClient), activity: createActivityStore({ storage: null }), flights: createFlights(), announce: undefined, autoCheck: false }
  const underlying = (await flush(client.supportedAssets())).underlyings[0].contractId
  await flush(
    Promise.all([
      qc.fetchQuery(coveredQueries.options(getClient)),
      qc.fetchQuery(coveredQueries.asks(getClient)),
      qc.fetchQuery(coveredQueries.bids(getClient)),
      qc.fetchQuery(coveredQueries.collateral(getClient)),
      qc.fetchQuery(coveredQueries.health(getClient)),
      qc.fetchQuery(coveredQueries.assets(getClient)),
      qc.fetchQuery(coveredQueries.balances(getClient, A)),
      qc.fetchQuery(coveredQueries.balances(getClient, B)),
      qc.fetchQuery(coveredQueries.eligibility(getClient, underlying, A)),
      qc.fetchQuery(coveredQueries.writerOpenCount(getClient, A)),
      qc.fetchQuery(coveredQueries.buyerOpenCount(getClient, B)),
    ]),
  )
  expect(underlying).toBe('C_MOCK_FUND')
  expect(stale()).toEqual([])
})

const option = (id: bigint) => flush(client.getOption(id))
const makerOffer = async (): Promise<OptionOffer> => (await flush(client.listOptions())).find((o) => o.state === 'offered' && o.writer !== A && o.writer !== B && o.underlying.code === 'FUND' && o.kind === 'put')!

describe('Covered writes through the transaction layer, on the mock contract', () => {
  it('buy: the buyer becomes the holder; the book, reserves, balances and the open count go stale', async () => {
    const offer = await makerOffer()
    const run = await send(W.buy, B, offer)
    expect(run.state).toMatchObject({ phase: 'confirmed', effect: 'fee-charged' })
    expect(run.result?.hash).toBeTruthy()
    expect(await option(offer.id)).toMatchObject({ state: 'active', holder: B })
    expect(stale()).toEqual(['balancesA', 'balancesB', 'collateral', 'health', 'options', 'writerCount'])
    const entry = deps.activity.get(B, run.entryId!)!
    expect(entry).toMatchObject({ action: 'buy', done: 'Bought', subject: `option:${offer.id}`, phase: 'confirmed', mock: true, hash: run.result!.hash })
    expect(entry.label).toMatch(new RegExp(`^Buy put on ${Number(offer.underlyingQty / 10n ** 7n)}\\.00 FUND for \\d+\\.\\d\\d USDx$`))
  })

  it('exercise, claim delivery and reclaim each move their option one state on', async () => {
    expect((await send(W.exercise, A, await option(0n))).state.phase).toBe('confirmed')
    expect((await option(0n)).state).toBe('exercised')
    expect(stale()).toEqual(['asks', 'balancesA', 'balancesB', 'collateral', 'health', 'options'])

    const claim = await send(W.claimDelivery, A, await option(3n))
    expect(claim.state.phase).toBe('confirmed')
    expect((await option(3n)).state).toBe('settled')
    expect(deps.activity.get(A, claim.entryId!)!.label).toBe('Claim 98.00 USDx')

    const reclaim = await send(W.reclaim, A, await option(4n))
    expect(reclaim.state.phase).toBe('confirmed')
    expect((await option(4n)).state).toBe('reclaimed')
    expect(deps.activity.get(A, reclaim.entryId!)!.label).toBe('Reclaim 48.00 USDx')
    // Neither a claim nor a reclaim touches the requests.
    expect(stale()).not.toContain('bids')
    expect(deps.activity.list(A)).toHaveLength(3)
  })

  it('write an offer, then cancel it', async () => {
    const fund = (await option(6n)).underlying
    const terms: NewOffer = { kind: 'call', underlying: fund, underlyingQty: 3n * 10n ** 7n, totalStrike: 318n * 10n ** 6n, totalPremium: 6n * 10n ** 6n, expiry: (await option(6n)).expiry }
    const written = await send(W.writeOffer, A, terms)
    expect(written.state.phase).toBe('confirmed')
    expect(typeof written.result!.id).toBe('bigint')
    expect(deps.activity.get(A, written.entryId!)).toMatchObject({ label: 'Write call on 3.00 FUND', done: 'Offer written', subject: null })
    expect(stale()).toEqual(['balancesA', 'balancesB', 'collateral', 'health', 'options', 'writerCount'])
    const created = await option(written.result!.id)
    expect(created).toMatchObject({ state: 'offered', writer: A })
    expect((await send(W.cancelOffer, A, created)).state.phase).toBe('confirmed')
    expect((await option(created.id)).state).toBe('cancelled')
  })

  it('list for sale, re-price nothing else, withdraw: only the listings go stale', async () => {
    const held = await option(1n)
    const listed = await send(W.listForSale, A, held, 25n * 10n ** 6n)
    expect(listed.state.phase).toBe('confirmed')
    expect(await flush(client.getAsk(1n))).toBe(25n * 10n ** 6n)
    expect(deps.activity.get(A, listed.entryId!)!.label).toBe('List put on 2.00 BOND for 2.50 USDx')
    expect(stale()).toEqual(['asks'])
    expect((await send(W.cancelSale, A, held)).state.phase).toBe('confirmed')
    expect(await flush(client.getAsk(1n))).toBeNull()
    expect(stale()).toEqual(['asks'])
  })

  it('buy from a holder at the price reviewed', async () => {
    const listing = await option(9n)
    const ask = (await flush(client.getAsk(9n)))!
    const run = await send(W.buyResale, B, listing, ask)
    expect(run.state.phase).toBe('confirmed')
    expect((await option(9n)).holder).toBe(B)
    // The collateral does not move on a resale.
    expect(stale()).toEqual(['asks', 'balancesA', 'balancesB', 'options'])
  })

  it('post a request, withdraw one, fill one', async () => {
    const fund = (await option(6n)).underlying
    const posted = await send(W.createBid, B, { kind: 'call', underlying: fund, underlyingQty: 5n * 10n ** 7n, totalStrike: 52n * 10n ** 7n, totalPremium: 10n ** 7n, expiry: (await option(6n)).expiry })
    expect(posted.state.phase).toBe('confirmed')
    expect(typeof posted.result!.id).toBe('bigint')
    expect(stale()).toEqual(['balancesA', 'balancesB', 'bids', 'buyerCount', 'collateral', 'health'])

    const own = (await flush(client.listBids()))!.find((b) => b.id === 0n)!
    expect((await send(W.cancelBid, A, own)).state.phase).toBe('confirmed')
    expect((await flush(client.getBid(0n))).state).toBe('cancelled')

    const theirs = (await flush(client.listBids()))!.find((b) => b.id === 2n)!
    expect(theirs.buyer).toBe(DEMO_HEDGERS.a)
    const filled = await send(W.fillBid, A, theirs)
    expect(filled.state.phase).toBe('confirmed')
    expect(await option(filled.result!.optionId)).toMatchObject({ state: 'active', writer: A, holder: DEMO_HEDGERS.a })
    expect(deps.activity.get(A, filled.entryId!)).toMatchObject({ label: 'Fill request for put on 10.00 FUND, locking 104.00 USDx, receiving 2.80 USDx', subject: 'bid:2' })
    expect(stale()).toContain('options')
  })

  it('a refusal by the contract rules sends nothing, records nothing and invalidates nothing', async () => {
    const own = await option(6n)
    const run = await send(W.buy, A, own)
    expect(run.state).toMatchObject({ phase: 'failed', effect: 'nothing-sent', hash: null })
    expect(run.state.error).toBeTruthy()
    expect(run.entryId).toBeNull()
    expect(deps.activity.list(A)).toEqual([])
    expect(stale()).toEqual([])
    expect((await option(6n)).state).toBe('offered')
  })

  it('a declined signature leaves everything as it was', async () => {
    const offer = await makerOffer()
    client.failNextWith('declined')
    const run = await send(W.buy, B, offer)
    expect(run.state).toMatchObject({ phase: 'declined', effect: 'nothing-sent' })
    expect(deps.activity.list(B)).toEqual([])
    expect(stale()).toEqual([])
    expect((await option(offer.id)).state).toBe('offered')
  })

  it('an unknown outcome is checked, not re-sent: the later look confirms it and only then invalidates', async () => {
    const offer = await makerOffer()
    client.failNextWith('unknown')
    const run = await send(W.buy, B, offer)
    expect(run.state).toMatchObject({ phase: 'unknown', effect: 'outcome-unknown' })
    expect(run.state.hash).toBeTruthy()
    expect(stale()).toEqual([])
    expect(deps.activity.get(B, run.entryId!)!.phase).toBe('unknown')
    const entry = deps.activity.get(B, run.entryId!)!
    const meta: TxMeta = { product: 'covered', action: entry.action, label: entry.label, done: entry.done, subject: entry.subject, address: B, mock: true }
    const after = await flush(checkEntry(deps, meta, run.entryId!))
    expect(after).toMatchObject({ phase: 'confirmed', effect: 'fee-charged' })
    expect((await option(offer.id)).holder).toBe(B)
    expect(stale()).toEqual(['balancesA', 'balancesB', 'collateral', 'health', 'options', 'writerCount'])
  })

  it('a transaction that failed in a ledger is kept, with the fee charged', async () => {
    const offer = await makerOffer()
    client.failNextWith('failed')
    const run = await send(W.buy, B, offer)
    expect(run.state).toMatchObject({ phase: 'failed', effect: 'fee-charged' })
    expect(deps.activity.get(B, run.entryId!)).toMatchObject({ phase: 'failed', effect: 'fee-charged' })
    expect(stale().length).toBeGreaterThan(0)
  })
})

describe('labels of the twelve writes', () => {
  it('are plain sentence-case phrases with exact figures and no banned word', async () => {
    const held = await option(1n)
    const bid = (await flush(client.listBids()))![2]
    const labels = [
      W.buy.describe(held),
      W.exercise.describe(held),
      W.claimDelivery.describe(await option(3n)),
      W.reclaim.describe(await option(4n)),
      W.cancelOffer.describe(await option(6n)),
      W.writeOffer.describe(held),
      W.listForSale.describe(held, 25n * 10n ** 6n),
      W.cancelSale.describe(held),
      W.buyResale.describe(held, 25n * 10n ** 6n),
      W.createBid.describe(bid),
      W.cancelBid.describe(bid),
      W.fillBid.describe(bid),
    ]
    expect(labels.map((l) => l.label)).toEqual([
      'Buy put on 2.00 BOND for 0.30 USDx',
      'Exercise put on 2.00 BOND',
      'Claim 98.00 USDx',
      'Reclaim 48.00 USDx',
      'Cancel offer of put on 5.00 FUND',
      'Write put on 2.00 BOND',
      'List put on 2.00 BOND for 2.50 USDx',
      'Cancel listing of put on 2.00 BOND',
      'Buy put on 2.00 BOND from its holder for 2.50 USDx',
      'Request put on 10.00 FUND',
      'Cancel request for put on 10.00 FUND',
      'Fill request for put on 10.00 FUND, locking 104.00 USDx, receiving 2.80 USDx',
    ])
    // A new offer or request says what it locks or escrows once the contract's quote token is known (review findings 36, 47).
    expect(W.writeOffer.label!(held, held.quote)).toBe('Write put on 2.00 BOND, locking 194.00 USDx, asking 0.30 USDx')
    expect(W.writeOffer.label!({ ...held, kind: 'call' }, held.quote)).toBe('Write call on 2.00 BOND, locking 2.00 BOND, asking 0.30 USDx')
    expect(W.writeOffer.label!(held, null)).toBe('Write put on 2.00 BOND')
    expect(W.createBid.label!(bid, bid.quote)).toBe('Request put on 10.00 FUND, escrowing 2.80 USDx')
    expect(labels.map((l) => l.done)).toEqual(['Bought', 'Exercised', 'Delivery claimed', 'Reclaimed', 'Offer cancelled', 'Offer written', 'Listed for sale', 'Listing cancelled', 'Bought from holder', 'Request posted', 'Request cancelled', 'Request filled'])
    // The second line of the Activity entry: the series, exactly. New orders get theirs from the contract's quote token.
    const quote = held.quote
    const details = labels.map((l, i) => (i === 5 ? W.writeOffer.detail!(held, quote) : i === 9 ? W.createBid.detail!(bid, quote) : l.detail))
    expect(details).toEqual([
      'Strike 97.00 USDx per BOND, deadline 20 Nov 2026, 08:00 UTC',
      'Strike 97.00 USDx per BOND, deadline 20 Nov 2026, 08:00 UTC',
      'Call on 1.00 BOND, strike 98.00 USDx per BOND, deadline 13 Nov 2026, 08:00 UTC',
      'Put on 2.00 EQTY, strike 24.00 USDx per EQTY, deadline 6 Nov 2026, 08:00 UTC',
      'Strike 9.80 USDx per FUND, deadline 27 Nov 2026, 08:00 UTC',
      'Strike 97.00 USDx per BOND, deadline 20 Nov 2026, 08:00 UTC',
      'Strike 97.00 USDx per BOND, deadline 20 Nov 2026, 08:00 UTC',
      'Strike 97.00 USDx per BOND, deadline 20 Nov 2026, 08:00 UTC',
      'Strike 97.00 USDx per BOND, deadline 20 Nov 2026, 08:00 UTC',
      'Strike 10.40 USDx per FUND, deadline 20 Nov 2026, 08:00 UTC',
      'Strike 10.40 USDx per FUND, deadline 20 Nov 2026, 08:00 UTC',
      'Strike 10.40 USDx per FUND, deadline 20 Nov 2026, 08:00 UTC',
    ])
    // Without the asset list a new order still says when it ends; an uneven strike is given as the total, never rounded.
    expect(W.writeOffer.detail!(held, null)).toBe('Deadline 20 Nov 2026, 08:00 UTC')
    expect(W.buy.describe({ ...held, underlyingQty: 3n * 10n ** 7n, totalStrike: 100n * 10n ** 7n }).detail).toBe('Total strike 100.00 USDx, deadline 20 Nov 2026, 08:00 UTC')
    for (const [i, l] of labels.entries()) {
      const text = `${l.label} ${l.done} ${details[i]}`
      expect(findBannedWords(text)).toEqual([])
      expect(text).not.toMatch(/[—–→!]/)
    }
    expect(Object.values(W).map((w) => w.action)).toEqual(['buy', 'exercise', 'claim-delivery', 'reclaim', 'cancel-offer', 'write-offer', 'list-for-sale', 'cancel-sale', 'buy-resale', 'create-bid', 'cancel-bid', 'fill-bid'])
  })
})
