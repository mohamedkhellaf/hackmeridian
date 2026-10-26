import { Address, Keypair, contract, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import { describeError } from '../stellar/errors'
import { askFromAbi, askTotalFromAbi } from './abi'
import type { AbiAsk } from './abi'

// The v1.4 resale functions as the contract lane specified them (no compiled v1.4 spec exists yet), encoded
// and decoded through the SDK's contract.Spec: the same path the generated client uses.
const T = xdr.ScSpecTypeDef
const input = (name: string, type: xdr.ScSpecTypeDef) => new xdr.ScSpecFunctionInputV0({ doc: '', name, type })
const errUdt = T.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: 'Error' }))
const resultVoid = T.scSpecTypeResult(new xdr.ScSpecTypeResult({ okType: T.scSpecTypeVoid(), errorType: errUdt }))
const fn = (name: string, inputs: xdr.ScSpecFunctionInputV0[], outputs: xdr.ScSpecTypeDef[]) =>
  xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ doc: '', name, inputs, outputs }))
const askType = T.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: 'Ask' }))

const spec = new contract.Spec([
  xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
    new xdr.ScSpecUdtErrorEnumV0({
      doc: '', lib: '', name: 'Error',
      cases: [
        new xdr.ScSpecUdtErrorEnumCaseV0({ doc: 'This option is not for sale.', name: 'NoAsk', value: 120 }),
        new xdr.ScSpecUdtErrorEnumCaseV0({ doc: 'The ask is above max_total.', name: 'PriceMoved', value: 121 }),
      ],
    }),
  ),
  xdr.ScSpecEntry.scSpecEntryUdtStructV0(
    new xdr.ScSpecUdtStructV0({
      doc: '', lib: '', name: 'Ask',
      fields: [
        new xdr.ScSpecUdtStructFieldV0({ doc: '', name: 'ask_total', type: T.scSpecTypeI128() }),
        new xdr.ScSpecUdtStructFieldV0({ doc: '', name: 'holder', type: T.scSpecTypeAddress() }),
        new xdr.ScSpecUdtStructFieldV0({ doc: '', name: 'id', type: T.scSpecTypeU32() }),
      ],
    }),
  ),
  fn('list_for_sale', [input('holder', T.scSpecTypeAddress()), input('id', T.scSpecTypeU32()), input('ask_total', T.scSpecTypeI128())], [resultVoid]),
  fn('cancel_sale', [input('holder', T.scSpecTypeAddress()), input('id', T.scSpecTypeU32())], [resultVoid]),
  fn('buy_resale', [input('buyer', T.scSpecTypeAddress()), input('id', T.scSpecTypeU32()), input('max_total', T.scSpecTypeI128())], [resultVoid]),
  fn('get_ask', [input('id', T.scSpecTypeU32())], [T.scSpecTypeOption(new xdr.ScSpecTypeOption({ valueType: T.scSpecTypeI128() }))]),
  fn('list_asks', [input('from', T.scSpecTypeU32()), input('limit', T.scSpecTypeU32())], [T.scSpecTypeVec(new xdr.ScSpecTypeVec({ elementType: askType }))]),
])

const HOLDER = Keypair.random().publicKey()
const b64 = (v: xdr.ScVal) => v.toXDR('base64')
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' })

describe('v1.4 resale ABI encoding', () => {
  it('list_for_sale(holder, id: u32, ask_total: i128)', () => {
    const [h, id, ask] = spec.funcArgsToScVals('list_for_sale', { holder: HOLDER, id: 7, ask_total: 25_000_000n })
    expect(Address.fromScVal(h).toString()).toBe(HOLDER)
    expect(b64(id)).toBe(b64(xdr.ScVal.scvU32(7)))
    expect(b64(ask)).toBe(b64(i128(25_000_000n)))
  })

  it('cancel_sale(address, u32) and buy_resale(address, u32, max_total: i128)', () => {
    const want = [new Address(HOLDER).toScVal(), xdr.ScVal.scvU32(1)].map(b64)
    expect(spec.funcArgsToScVals('cancel_sale', { holder: HOLDER, id: 1 }).map(b64)).toEqual(want)
    expect(spec.funcArgsToScVals('buy_resale', { buyer: HOLDER, id: 1, max_total: 25_000_000n }).map(b64)).toEqual([
      ...want,
      b64(i128(25_000_000n)),
    ])
  })
})

describe('v1.4 resale ABI decoding', () => {
  it('get_ask: Some(i128) -> bigint, None -> null', () => {
    const some = spec.funcResToNative('get_ask', i128(30_000_000n))
    expect(askTotalFromAbi(some as bigint)).toBe(30_000_000n)
    const none = spec.funcResToNative('get_ask', xdr.ScVal.scvVoid())
    expect(askTotalFromAbi(none as bigint | null | undefined)).toBeNull()
  })

  it('list_asks: Vec<Ask> -> Ask[] with bigint ids and amounts', () => {
    const vecType = T.scSpecTypeVec(new xdr.ScSpecTypeVec({ elementType: askType }))
    const native: AbiAsk[] = [
      { id: 3, holder: HOLDER, ask_total: 12_000_000n },
      { id: 41, holder: HOLDER, ask_total: 1n },
    ]
    const scv = spec.nativeToScVal(native, vecType)
    const decoded = spec.funcResToNative('list_asks', scv) as AbiAsk[]
    expect(decoded.map(askFromAbi)).toEqual([
      { id: 3n, holder: HOLDER, askTotal: 12_000_000n },
      { id: 41n, holder: HOLDER, askTotal: 1n },
    ])
    expect(spec.funcResToNative('list_asks', spec.nativeToScVal([], vecType))).toEqual([])
  })

  it('PriceMoved (#121) decodes to the re-price message', () => {
    expect(describeError(new Error('Error(Contract, #121)'))).toBe('The seller changed the price. Review the new price before buying.')
  })

  it('NoAsk (#120) decodes to the resale message', () => {
    expect(describeError(new Error('HostError: Error(Contract, #120)'))).toMatch(/no longer for sale/)
    // The decoded message must survive a second pass (it does not read as a wallet rejection).
    expect(describeError(new Error(describeError(new Error('Error(Contract, #120)'))))).toMatch(/no longer for sale/)
  })
})
