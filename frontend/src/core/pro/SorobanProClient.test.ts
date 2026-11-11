import { Account, Contract, contract, Keypair, rpc, scValToNative, SorobanDataBuilder, StrKey, TransactionBuilder, xdr } from '@stellar/stellar-sdk'
import { describe, expect, it, vi } from 'vitest'
import { config } from '../config'
import { bookFromAbi, i128, positionFromAbi, proCodeOf, seriesFromAbi, shortsFromAbi, u32, u64, writerArg } from './proAbi'
import type { AbiAccount, AbiBook, AbiPosition, AbiSeries } from './proAbi'
import { PRO_SPEC } from './proSpec'
import { failureOf, ProCallError, SorobanProClient } from './SorobanProClient'
import { VAULT } from './types'

const spec = new contract.Spec([...PRO_SPEC])
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 7))
const QUOTE = StrKey.encodeContract(Buffer.alloc(32, 9))
const W = Keypair.random().publicKey()
const H = Keypair.random().publicKey()
const E7 = 10_000_000n

// stellar-sdk 17 XDR: union arms and fields are properties (v.type, op.func.invokeContract), not accessor calls.
type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any
const typeOf = (v: xdr.ScVal) => (v as Any).type as string
const argTypes = (fn: string, args: Record<string, unknown>) => spec.funcArgsToScVals(fn, args).map(typeOf)

/** Encodes `native` as the ok type of `fn`'s output, the way the contract would return it. */
function ret(fn: string, native: unknown): xdr.ScVal {
  const out = (spec.getFunc(fn) as Any).outputs[0]
  if (!out) return xdr.ScVal.scvVoid()
  const t = out.type === 'scSpecTypeResult' ? out.result.okType : out
  return spec.nativeToScVal(native, t)
}
const roundTrip = <T,>(fn: string, native: unknown): T => {
  const r = spec.funcResToNative(fn, ret(fn, native)) as T | { unwrap: () => T }
  return r && typeof r === 'object' && 'unwrap' in r && typeof r.unwrap === 'function' ? r.unwrap() : (r as T)
}

describe('Pro ABI encoding (contract spec of contracts/pro)', () => {
  it('encodes every wallet call with the exact Soroban types', () => {
    expect(argTypes('deposit', { who: W, amount: i128(5n * E7) })).toEqual(['scvAddress', 'scvI128'])
    expect(argTypes('withdraw', { who: W, amount: i128(1n) })).toEqual(['scvAddress', 'scvI128'])
    expect(argTypes('create_offer', { writer: W, series_id: u32(0), qty: i128(1000n), premium: i128(25n * E7), quote_expiry: u64(1_800_000_000) })).toEqual([
      'scvAddress',
      'scvU32',
      'scvI128',
      'scvI128',
      'scvU64',
    ])
    expect(argTypes('cancel_offer', { writer: W, offer_id: u32(3) })).toEqual(['scvAddress', 'scvU32'])
    expect(argTypes('buy', { buyer: H, offer_id: u32(3) })).toEqual(['scvAddress', 'scvU32'])
    expect(argTypes('exercise', { holder: H, pos_id: u32(1) })).toEqual(['scvAddress', 'scvU32'])
    expect(argTypes('settle', { book_id: u32(2) })).toEqual(['scvU32'])
    expect(argTypes('settle_vault', { series_id: u32(0) })).toEqual(['scvU32'])
    expect(argTypes('claim', { holder: H, pos_id: u32(1) })).toEqual(['scvAddress', 'scvU32'])
    expect(argTypes('lp_deposit', { lp: H, amount: i128(100n * E7) })).toEqual(['scvAddress', 'scvI128'])
  })

  it('encodes the liquidate taker as an Option and get_requirement as the Writer enum', () => {
    const [, , none] = spec.funcArgsToScVals('liquidate', { caller: H, writer: W, taker: undefined })
    expect(typeOf(none)).toBe('scvVoid')
    const [, , some] = spec.funcArgsToScVals('liquidate', { caller: H, writer: W, taker: H })
    expect(typeOf(some)).toBe('scvAddress')
    const [vault] = spec.funcArgsToScVals('get_requirement', { who: writerArg(VAULT) })
    expect(typeOf(vault)).toBe('scvVec')
    expect(scValToNative(vault)).toEqual(['Vault'])
    const [acct] = spec.funcArgsToScVals('get_requirement', { who: writerArg(W) })
    expect(scValToNative(acct)).toEqual(['Account', W])
  })

  it('range-checks amounts, ids and times before encoding', () => {
    expect(() => i128(1n << 127n)).toThrow()
    expect(() => u32(-1)).toThrow()
    expect(() => u32(1.5)).toThrow()
    expect(() => u64(-1)).toThrow()
    expect(u64(1_800_000_000)).toBe(1_800_000_000n)
  })
})

describe('Pro ABI decoding', () => {
  it('decodes a series with its snapshot and derives the deficit only once closed', () => {
    const raw = { strike: 100n * E7, expiry: 1_800_000_000n, settlement_price: 120n * E7, oi: 1000n, open_books: 0, shortfall: 50n, vault_paid: 30n, pool: 0n, claimed: 0n, closed: true }
    const s = roundTrip<AbiSeries>('get_series', raw)
    const snap = roundTrip<Parameters<typeof seriesFromAbi>[2]>('get_snapshot', { series_id: 0, seq: 4n, ts: 1_799_999_000n, spot: 110n * E7, mark: 12n * E7, ra: Array(16).fill(0n), smin: 1n, liq: 2n })
    const v = seriesFromAbi(0, s, snap)
    expect(v).toMatchObject({ id: 0, strike: 100n * E7, expiry: 1_800_000_000, settlementPrice: 120n * E7, closed: true, deficit: 20n })
    expect(v.snapshot).toEqual({ seriesId: 0, seq: 4, ts: 1_799_999_000, spot: 110n * E7, mark: 12n * E7 })
    const open = seriesFromAbi(1, roundTrip<AbiSeries>('get_series', { ...raw, settlement_price: undefined, closed: false }), null)
    expect(open.settlementPrice).toBeNull()
    expect(open.deficit).toBeNull()
  })

  it('decodes a vault-owned book and a claimed position', () => {
    const b = roundTrip<AbiBook>('get_book', { series_id: 0, owner: { tag: 'Vault', values: undefined }, qty: 10n, settled: true, due: 5n, from_owner: 2n, shortfall: 3n, reserve: 7n })
    expect(bookFromAbi(4, b)).toEqual({ id: 4, seriesId: 0, owner: VAULT, qty: 10n, settled: true, due: 5n, fromOwner: 2n, shortfall: 3n, reserve: 7n })
    const p = roundTrip<AbiPosition>('get_position', { series_id: 0, holder: H, book: 4, qty: 10n, settled: true, exercised: false, paid: 6n, deficit: 4n })
    expect(positionFromAbi(2, p, VAULT).claim).toEqual({ due: 10n, paid: 6n, deficit: 4n })
    const ex = roundTrip<AbiPosition>('get_position', { series_id: 0, holder: H, book: 4, qty: 10n, settled: true, exercised: true, paid: 9n, deficit: 0n })
    expect(positionFromAbi(2, ex, W).claim).toBeNull()
  })

  it('decodes the account shorts map', () => {
    const a = roundTrip<AbiAccount>('get_account', { cash: 1n, shorts: new Map([[2, 5n], [0, 0n], [1, 3n]]), books: [1], owed: 0n })
    expect(shortsFromAbi(a.shorts)).toEqual([
      { seriesId: 1, qty: 3n },
      { seriesId: 2, qty: 5n },
    ])
  })

  it('finds the Pro error code in a host error and skips SAC codes', () => {
    expect(proCodeOf('HostError: Error(Contract, #209)')).toBe(209)
    expect(proCodeOf('Error(Contract, #10) ... Error(Contract, #226)')).toBe(226)
    expect(proCodeOf('Error(Contract, #10)')).toBeNull()
    expect(failureOf(new ProCallError('x', 224))).toEqual({ ok: false, code: 224, name: 'LiquidateFirst' })
    const f = failureOf(new Error('Error(Contract, #10)'))
    expect(f.code).toBe(-1)
    expect(f.note).toMatch(/Insufficient token balance/)
  })
})

// ---------------------------------------------------------------- fake RPC

type Handler = (fn: string, args: xdr.ScVal[]) => xdr.ScVal | { error: number }

function simulation(retval: xdr.ScVal, write: boolean) {
  const data = new SorobanDataBuilder()
  if (write) data.setReadWrite([new Contract(CONTRACT).getFootprint()])
  return rpc.parseRawSimulation({
    id: '1',
    latestLedger: 100,
    minResourceFee: '100',
    transactionData: data.build().toXDR('base64'),
    results: [{ auth: [], xdr: retval.toXDR('base64') }],
    events: [],
  } as unknown as rpc.Api.RawSimulateTransactionResponse)
}

function fakeServer(handler: Handler, write = new Set<string>()) {
  const calls: string[] = []
  const sent: string[] = []
  const server = {
    getAccount: vi.fn(async (id: string) => new Account(id, '1')),
    simulateTransaction: vi.fn(async (tx: Any) => {
      const inv = tx.operations[0].func.invokeContract
      const fn = String(inv.functionName)
      calls.push(fn)
      const out = handler(fn, inv.args)
      if ('error' in out) {
        return rpc.parseRawSimulation({ id: '1', latestLedger: 100, error: `HostError: Error(Contract, #${out.error})`, events: [] } as unknown as rpc.Api.RawSimulateTransactionResponse)
      }
      return simulation(out, write.has(fn))
    }),
    sendTransaction: vi.fn(async (tx: { toXDR: () => string }) => {
      sent.push(tx.toXDR())
      return { status: 'PENDING', hash: 'ab'.repeat(32), latestLedger: 100, latestLedgerCloseTime: 0 }
    }),
    getTransaction: vi.fn(async () => ({ status: 'SUCCESS', returnValue: xdr.ScVal.scvVoid(), latestLedger: 101 })),
    getLatestLedger: vi.fn(async () => ({ sequence: 100 })),
  }
  return { server: server as unknown as rpc.Server, calls, sent, mock: server }
}

const NOW = 1_800_000_000
const CFG = { psr_bps: 1500, ext_mult: 3, short_min_bps: 1000, im_bps: 12000, max_age: 600n, max_series_oi: 10n ** 9n, max_writer_oi: 10n ** 8n, bonus_bps: 500, reserve_fee_bps: 100, settle_window: 86400n, exercise_max_age: 120n }
const REQ = { nlv: 900n * E7, liability: 10n, expired: 0n, scan: 20n, smin: 1n, liq: 2n, mm: 1000n * E7, im: 1200n * E7, worst: 14 }

/** One series, offers 0 (bought) and 1 (open), position 0 in book 0 that the vault took over from W. */
function chain(fn: string, args: xdr.ScVal[]): xdr.ScVal | { error: number } {
  const id = args[0] && typeOf(args[0]) === 'scvU32' ? (scValToNative(args[0]) as number) : null
  switch (fn) {
    case 'config':
      return ret(fn, CFG)
    case 'series_count':
      return ret(fn, 1)
    case 'quote':
      return ret(fn, QUOTE)
    case 'get_series':
      return ret(fn, { strike: 100n * E7, expiry: BigInt(NOW + 3600), settlement_price: undefined, oi: 1000n, open_books: 1, shortfall: 0n, vault_paid: 0n, pool: 0n, claimed: 0n, closed: false })
    case 'get_snapshot':
      return ret(fn, { series_id: 0, seq: 7n, ts: BigInt(NOW - 30), spot: 115n * E7, mark: 16n * E7, ra: Array(16).fill(0n), smin: 0n, liq: 0n })
    case 'get_offer':
      return id! < 2 ? ret(fn, { writer: W, series_id: 0, qty: 1000n, premium: 20n * E7, quote_expiry: BigInt(NOW + 600), open: id === 1 }) : { error: 202 }
    case 'get_position':
      return id === 0 ? ret(fn, { series_id: 0, holder: H, book: 0, qty: 1000n, settled: false, exercised: false, paid: 0n, deficit: 0n }) : { error: 202 }
    case 'get_book':
      return ret(fn, { series_id: 0, owner: { tag: 'Vault', values: undefined }, qty: 1000n, settled: false, due: 0n, from_owner: 0n, shortfall: 0n, reserve: 5n * E7 })
    case 'get_account': {
      const who = scValToNative(args[0]) as string
      return who === W ? ret(fn, { cash: 50n * E7, shorts: new Map(), books: [], owed: 3n * E7 }) : ret(fn, { cash: 0n, shorts: new Map(), books: [], owed: 0n })
    }
    case 'get_requirement':
      // The writer is priced; the holder's call fails like a stale snapshot would.
    {
      const [tag, who] = scValToNative(args[0]) as [string, string?]
      return tag === 'Vault' || who === W ? ret(fn, REQ) : { error: 207 }
    }
    case 'get_vault':
      return ret(fn, { cash: 500n * E7, shorts: new Map([[0, 1000n]]), reserved: 5n * E7 })
    case 'vault_value':
      return ret(fn, 480n * E7)
    case 'total_shares':
      return ret(fn, 500n * E7)
    case 'lp_shares':
      return ret(fn, 0n)
    case 'deposit':
      return ret(fn, null)
    case 'buy':
      return { error: 209 }
    default:
      throw new Error(`unexpected ${fn}`)
  }
}

const wallet = (address: string | null, sign = vi.fn(async (x: string) => x)) => ({ address, sign })

describe('SorobanProClient against a fake RPC', () => {
  it('reads the whole state through views', async () => {
    const f = fakeServer(chain)
    const c = new SorobanProClient(CONTRACT, { server: f.server, now: () => NOW, balanceOf: async (t, who) => (t === QUOTE && who === H ? 77n : 0n) })
    c.setWallet(wallet(H))
    await c.refresh()
    expect(c.getStatus().error).toBeNull()
    const m = c.getModel()
    expect(m.now).toBe(NOW)
    expect(m.config).toEqual({ maxAge: 600, exerciseMaxAge: 120, settleWindow: 86400, reserveFeeBps: 100, bonusBps: 500, imBps: 12000 })
    expect(m.series).toHaveLength(1)
    expect(m.series[0].snapshot?.spot).toBe(115n * E7)
    expect(m.offers.map((o) => [o.id, o.status])).toEqual([[1, 'open']])
    expect(m.books).toEqual([{ id: 0, seriesId: 0, owner: VAULT, qty: 1000n, settled: false, due: 0n, fromOwner: 0n, shortfall: 0n, reserve: 5n * E7 }])
    expect(m.positions[0]).toMatchObject({ id: 0, holder: H, book: 0, bookOwner: VAULT, claim: null })
    const w = m.accounts.find((a) => a.id === W)!
    expect(w.requirement?.mm).toBe(1000n * E7)
    expect(w.cushion).toBe(-100n * E7)
    expect(w.owed).toBe(3n * E7)
    // The holder has an empty account but is the connected wallet, so it is shown; get_requirement failed -> unknown.
    expect(m.accounts.find((a) => a.id === H)?.requirement).toBeNull()
    expect(c.getRequirement(W)?.nlv).toBe(900n * E7)
    expect(c.getRequirement(VAULT)?.worst).toBe(14)
    expect(m.vault).toMatchObject({ cash: 500n * E7, reserved: 5n * E7, value: 480n * E7, totalShares: 500n * E7, debtsOwed: 3n * E7 })
    expect(m.vault.shorts).toEqual([{ seriesId: 0, qty: 1000n }])
    expect(m.wallets).toEqual({ [H]: 77n })
    // Views are simulated from a null account: no getAccount, nothing signed or sent.
    expect(f.mock.getAccount).not.toHaveBeenCalled()
    expect(f.mock.sendTransaction).not.toHaveBeenCalled()
    // Probing stops at the first NotFound page.
    expect(f.calls.filter((x) => x === 'get_offer')).toHaveLength(10)
  })

  it('signs and sends a deposit, then re-reads', async () => {
    const f = fakeServer(chain, new Set(['deposit']))
    const sign = vi.fn(async (x: string) => x)
    const c = new SorobanProClient(CONTRACT, { server: f.server, now: () => NOW, balanceOf: async () => 0n })
    c.setWallet(wallet(W, sign))
    const r = await c.deposit(W, 25n * E7)
    expect(r).toEqual({ ok: true, value: null, note: `Transaction ${'ab'.repeat(32)}` })
    expect(sign).toHaveBeenCalledTimes(1)
    expect(f.sent).toHaveLength(1)
    const inv = (TransactionBuilder.fromXDR(f.sent[0], config.networkPassphrase).operations[0] as Any).func.invokeContract
    expect(String(inv.functionName)).toBe('deposit')
    expect(scValToNative(inv.args[0])).toBe(W)
    expect(typeOf(inv.args[1])).toBe('scvI128')
    expect(scValToNative(inv.args[1])).toBe(25n * E7)
    expect(c.getModel().history.at(-1)).toMatchObject({ op: 'deposit', actor: W, ok: true, code: null })
    // The confirmed deposit triggered a full re-read.
    expect(f.calls).toContain('get_vault')
  })

  it('returns the contract refusal without asking the wallet to sign', async () => {
    const f = fakeServer(chain, new Set(['buy']))
    const sign = vi.fn(async (x: string) => x)
    const c = new SorobanProClient(CONTRACT, { server: f.server, now: () => NOW, balanceOf: async () => 0n })
    c.setWallet(wallet(H, sign))
    const r = await c.buy(H, 1)
    expect(r).toEqual({ ok: false, code: 209, name: 'InsufficientMargin' })
    expect(sign).not.toHaveBeenCalled()
    expect(f.mock.sendTransaction).not.toHaveBeenCalled()
    expect(c.getModel().history).toEqual([{ index: 0, op: 'buy', actor: H, args: [H, 1], ok: false, code: 209, result: null }])
  })

  it('refuses writes without a wallet', async () => {
    const f = fakeServer(chain)
    const c = new SorobanProClient(CONTRACT, { server: f.server })
    const r = await c.deposit(W, 1n)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.note).toMatch(/Connect a wallet/)
  })
})
