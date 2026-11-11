import { Address, Keypair, contract, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import { describeError } from '../stellar/errors'
import type { TokenInfo } from '../options/types'
import { bidFromAbi, bidStateFromAbi } from './abi'
import type { AbiBid } from './abi'

// The v1.5 bid functions as the contract lane specified them (no compiled v1.5 spec yet), encoded and decoded
// through the SDK's contract.Spec: the same path the generated client uses.
const T = xdr.ScSpecTypeDef
const udt = (name: string) => T.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name }))
const input = (name: string, type: xdr.ScSpecTypeDef) => new xdr.ScSpecFunctionInputV0({ doc: '', name, type })
const errUdt = udt('Error')
const result = (okType: xdr.ScSpecTypeDef) => T.scSpecTypeResult(new xdr.ScSpecTypeResult({ okType, errorType: errUdt }))
const fn = (name: string, inputs: xdr.ScSpecFunctionInputV0[], outputs: xdr.ScSpecTypeDef[]) =>
  xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ doc: '', name, inputs, outputs }))
const voidUnion = (name: string, cases: string[]) =>
  xdr.ScSpecEntry.scSpecEntryUdtUnionV0(
    new xdr.ScSpecUdtUnionV0({
      doc: '', lib: '', name,
      cases: cases.map((c) => xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(new xdr.ScSpecUdtUnionCaseVoidV0({ doc: '', name: c }))),
    }),
  )
const field = (name: string, type: xdr.ScSpecTypeDef) => new xdr.ScSpecUdtStructFieldV0({ doc: '', name, type })
const bidType = udt('Bid')
const u32 = T.scSpecTypeU32()
const addr = T.scSpecTypeAddress()
const i128T = T.scSpecTypeI128()

const spec = new contract.Spec([
  xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
    new xdr.ScSpecUdtErrorEnumV0({
      doc: '', lib: '', name: 'Error',
      cases: [
        ['BidNotOpen', 122],
        ['NotBidder', 123],
        ['BidBookFull', 124],
        ['BuyerOpenLimit', 125],
      ].map(([name, value]) => new xdr.ScSpecUdtErrorEnumCaseV0({ doc: '', name: name as string, value: value as number })),
    }),
  ),
  voidUnion('OptionKind', ['Put', 'Call']),
  voidUnion('BidState', ['Open', 'Filled', 'Cancelled', 'Expired']),
  // Struct map keys are sorted.
  xdr.ScSpecEntry.scSpecEntryUdtStructV0(
    new xdr.ScSpecUdtStructV0({
      doc: '', lib: '', name: 'Bid',
      fields: [
        field('buyer', addr),
        field('expiry', T.scSpecTypeU64()),
        field('id', u32),
        field('kind', udt('OptionKind')),
        field('option_id', T.scSpecTypeOption(new xdr.ScSpecTypeOption({ valueType: u32 }))),
        field('premium_total', i128T),
        field('qty', i128T),
        field('quote', addr),
        field('state', udt('BidState')),
        field('strike_total', i128T),
        field('underlying', addr),
      ],
    }),
  ),
  fn(
    'create_bid',
    [
      input('buyer', addr),
      input('kind', udt('OptionKind')),
      input('underlying', addr),
      input('quote', addr),
      input('qty', i128T),
      input('strike_total', i128T),
      input('premium_total', i128T),
      input('expiry', T.scSpecTypeU64()),
    ],
    [result(u32)],
  ),
  fn('cancel_bid', [input('buyer', addr), input('id', u32)], [result(T.scSpecTypeVoid())]),
  fn('fill_bid', [input('writer', addr), input('id', u32)], [result(u32)]),
  fn('prune_bids', [input('pruner', addr), input('ids', T.scSpecTypeVec(new xdr.ScSpecTypeVec({ elementType: u32 })))], [result(u32)]),
  fn('get_bid', [input('id', u32)], [result(bidType)]),
  fn('get_bids', [input('from', u32), input('limit', u32)], [T.scSpecTypeVec(new xdr.ScSpecTypeVec({ elementType: bidType }))]),
  fn('bid_count', [], [u32]),
])

const BUYER = Keypair.random().publicKey()
const WRITER = Keypair.random().publicKey()
const UNDERLYING = 'CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U'
const QUOTE = 'CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU'
const b64 = (v: xdr.ScVal) => v.toXDR('base64')
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' })
const tokens = new Map<string, TokenInfo>([
  [UNDERLYING, { contractId: UNDERLYING, code: 'RWA', decimals: 7 }],
  [QUOTE, { contractId: QUOTE, code: 'USDx', decimals: 7 }],
])

describe('v1.5 bid ABI encoding', () => {
  it('create_bid(buyer, kind, underlying, quote, qty, strike_total, premium_total, expiry)', () => {
    const args = spec.funcArgsToScVals('create_bid', {
      buyer: BUYER,
      kind: { tag: 'Call', values: undefined },
      underlying: UNDERLYING,
      quote: QUOTE,
      qty: 50_000_000n,
      strike_total: 500_000_000n,
      premium_total: 20_000_000n,
      expiry: 1_800_000_000n,
    })
    expect(args).toHaveLength(8)
    expect(Address.fromScVal(args[0]).toString()).toBe(BUYER)
    expect(b64(args[1])).toBe(b64(xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Call')])))
    expect(Address.fromScVal(args[2]).toString()).toBe(UNDERLYING)
    expect(Address.fromScVal(args[3]).toString()).toBe(QUOTE)
    expect(args.slice(4, 7).map(b64)).toEqual([i128(50_000_000n), i128(500_000_000n), i128(20_000_000n)].map(b64))
    expect(b64(args[7])).toBe(b64(nativeToScVal(1_800_000_000n, { type: 'u64' })))
  })

  it('cancel_bid(buyer, id: u32) and fill_bid(writer, id: u32)', () => {
    expect(spec.funcArgsToScVals('cancel_bid', { buyer: BUYER, id: 3 }).map(b64)).toEqual(
      [new Address(BUYER).toScVal(), xdr.ScVal.scvU32(3)].map(b64),
    )
    expect(spec.funcArgsToScVals('fill_bid', { writer: WRITER, id: 0 }).map(b64)).toEqual(
      [new Address(WRITER).toScVal(), xdr.ScVal.scvU32(0)].map(b64),
    )
  })

  it('prune_bids(pruner, ids: Vec<u32>) and get_bids(from, limit)', () => {
    const [p, ids] = spec.funcArgsToScVals('prune_bids', { pruner: WRITER, ids: [1, 7] })
    expect(Address.fromScVal(p).toString()).toBe(WRITER)
    expect(b64(ids)).toBe(b64(xdr.ScVal.scvVec([xdr.ScVal.scvU32(1), xdr.ScVal.scvU32(7)])))
    expect(spec.funcArgsToScVals('get_bids', { from: 50, limit: 50 }).map(b64)).toEqual([xdr.ScVal.scvU32(50), xdr.ScVal.scvU32(50)].map(b64))
  })

  it('fill_bid returns the new option id (u32)', () => {
    const r = spec.funcResToNative('fill_bid', xdr.ScVal.scvU32(9)) as { unwrap: () => number }
    expect(r.unwrap()).toBe(9)
  })
})

describe('v1.5 Bid decoding', () => {
  const raw = (over: Partial<AbiBid> = {}): AbiBid => ({
    id: 4,
    buyer: BUYER,
    kind: { tag: 'Put', values: undefined },
    underlying: UNDERLYING,
    quote: QUOTE,
    qty: 50_000_000n,
    strike_total: 500_000_000n,
    premium_total: 20_000_000n,
    expiry: 2_000_000_000n,
    state: { tag: 'Open', values: undefined },
    option_id: undefined,
    ...over,
  })
  const roundTrip = (b: AbiBid) => (spec.funcResToNative('get_bids', spec.nativeToScVal([b], T.scSpecTypeVec(new xdr.ScSpecTypeVec({ elementType: bidType })))) as AbiBid[])[0]

  it('Open bid with option_id None -> open, optionId null, bigint amounts', () => {
    const b = bidFromAbi(roundTrip(raw()), tokens, 1_900_000_000)
    expect(b).toMatchObject({
      id: 4n,
      buyer: BUYER,
      kind: 'put',
      underlyingQty: 50_000_000n,
      totalStrike: 500_000_000n,
      totalPremium: 20_000_000n,
      expiry: 2_000_000_000,
      state: 'open',
      optionId: null,
    })
    expect(b.underlying.code).toBe('RWA')
    expect(b.quote.code).toBe('USDx')
  })

  it('Filled bid with option_id Some(u32) -> filled, optionId bigint', () => {
    const b = bidFromAbi(roundTrip(raw({ kind: { tag: 'Call', values: undefined }, state: { tag: 'Filled', values: undefined }, option_id: 12 })), tokens, 1_900_000_000)
    expect(b.kind).toBe('call')
    expect(b.state).toBe('filled')
    expect(b.optionId).toBe(12n)
  })

  it('get_bid: Result<Bid> decodes through the struct', () => {
    const scv = spec.nativeToScVal(raw({ state: { tag: 'Cancelled', values: undefined } }), bidType)
    const r = spec.funcResToNative('get_bid', scv) as { unwrap: () => AbiBid }
    expect(bidFromAbi(r.unwrap(), tokens, 0).state).toBe('cancelled')
  })

  it('BidState mapping: Open past expiry derives expired; Expired (pruned) maps to pruned', () => {
    expect(bidStateFromAbi('Open', 100, 99)).toBe('open')
    expect(bidStateFromAbi('Open', 100, 100)).toBe('expired')
    expect(bidStateFromAbi('Filled', 100, 200)).toBe('filled')
    expect(bidStateFromAbi('Cancelled', 100, 0)).toBe('cancelled')
    expect(bidStateFromAbi('Expired', 100, 200)).toBe('pruned')
  })

  it('an unknown token is a config mismatch', () => {
    expect(() => bidFromAbi(raw({ underlying: 'COTHER' }), tokens, 0)).toThrow(/unknown token/)
  })

  it('bid error codes 122-125 decode', () => {
    expect(describeError(new Error('Error(Contract, #122)'))).toBe('This request is no longer open (filled, withdrawn or expired).')
    expect(describeError(new Error('Error(Contract, #123)'))).toMatch(/Only the buyer/)
    expect(describeError(new Error('Error(Contract, #124)'))).toMatch(/request book is full/)
    expect(describeError(new Error('Error(Contract, #125)'))).toBe('You already have 50 open requests on this asset.')
  })
})
