import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk'
import type { Transaction } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import { TxError } from '../../core/tx/errors'
import type { TxCheck, TxStage } from '../../core/tx/types'
import { resultCodeOf, sendIssuerAction } from './actions'
import type { ActionDeps, RpcSent } from './actions'
import { COPY, RESULT_CODE_TEXT } from './copy'
import type { ActionRequest } from './net'

// Throwaway keys made for each run: nothing here is a real account and nothing reaches a network.
const issuer = Keypair.random()
const holder = Keypair.random().publicKey()
const CONTRACT = 'CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6'
const SAC = 'CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP'
const asset = { contractId: SAC, code: 'BOND', decimals: 7 }

const signWith = (kp: Keypair) => async (xdr: string) => {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET)
  tx.sign(kp)
  return tx.toXDR()
}

interface Recorded {
  stages: TxStage[]
  submitted: Transaction[]
  prepared: Transaction[]
  sentRpc: Transaction[]
  checks: number
}

function harness(over: Partial<ActionDeps> = {}) {
  const rec: Recorded = { stages: [], submitted: [], prepared: [], sentRpc: [], checks: 0 }
  let clock = 0
  const deps: ActionDeps = {
    passphrase: Networks.TESTNET,
    loadSequence: async () => '100',
    submitClassic: async (signed) => {
      rec.submitted.push(signed)
      return { hash: 'from-horizon', ledger: 77 }
    },
    prepare: async (tx) => {
      rec.prepared.push(tx)
      return tx
    },
    sendRpc: async (signed): Promise<RpcSent> => {
      rec.sentRpc.push(signed)
      return { status: 'PENDING', hash: 'from-rpc' }
    },
    check: async (): Promise<TxCheck> => {
      rec.checks++
      return { status: 'confirmed', ledger: 99 }
    },
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
    pollTimeoutMs: 5_000,
    ...over,
  }
  const opts = { onStage: (s: TxStage) => rec.stages.push(s) }
  return { rec, deps, opts }
}

const names = (rec: Recorded) => rec.stages.map((s) => s.stage)

/** The contract function a transaction calls and how many arguments it passes (SDK 17 exposes XDR arms as properties). */
function invoked(tx: Transaction): { name: string; args: number } {
  const op = tx.operations[0] as unknown as { func: { invokeContract: { functionName: unknown; args: unknown[] } } }
  return { name: String(op.func.invokeContract.functionName), args: op.func.invokeContract.args.length }
}
const request = (over: Partial<ActionRequest>): ActionRequest => ({ kind: 'freeze', asset, issuer: issuer.publicKey(), target: holder, ...over })

async function rejection(p: Promise<unknown>): Promise<TxError> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(TxError)
    return e as TxError
  }
  throw new Error('expected a rejection')
}

describe('an account (classic operations through Horizon)', () => {
  it('freezes with SetTrustLineFlags, signed by the issuer, and reports check, sign, submit', async () => {
    const { rec, deps, opts } = harness()
    const receipt = await sendIssuerAction(request({ kind: 'freeze' }), signWith(issuer), opts, deps)
    expect(receipt).toEqual({ hash: 'from-horizon', ledger: 77 })
    expect(names(rec)).toEqual(['checking', 'signing', 'submitting'])
    expect(rec.prepared).toHaveLength(0)
    expect(rec.sentRpc).toHaveLength(0)
    const tx = rec.submitted[0]
    expect(tx.source).toBe(issuer.publicKey())
    expect(tx.sequence).toBe('101')
    expect(tx.signatures).toHaveLength(1)
    expect(tx.operations).toHaveLength(1)
    const op = tx.operations[0] as { type: string; trustor?: string; asset?: { code: string; issuer: string }; flags?: { authorized?: boolean } }
    expect(op.type).toBe('setTrustLineFlags')
    expect(op.trustor).toBe(holder)
    expect(op.asset).toMatchObject({ code: 'BOND', issuer: issuer.publicKey() })
    expect(op.flags?.authorized).toBe(false)
  })

  it('authorizes with the same operation and the flag set', async () => {
    const { rec, deps, opts } = harness()
    await sendIssuerAction(request({ kind: 'authorize' }), signWith(issuer), opts, deps)
    const op = rec.submitted[0].operations[0] as { type: string; flags?: { authorized?: boolean } }
    expect(op.type).toBe('setTrustLineFlags')
    expect(op.flags?.authorized).toBe(true)
  })

  it('claws back the exact amount with a Clawback operation', async () => {
    const { rec, deps, opts } = harness()
    await sendIssuerAction(request({ kind: 'clawback', units: 12_345_678n }), signWith(issuer), opts, deps)
    const op = rec.submitted[0].operations[0] as { type: string; from?: string; amount?: string; asset?: { code: string } }
    expect(op.type).toBe('clawback')
    expect(op.from).toBe(holder)
    expect(op.amount).toBe('1.2345678')
    expect(op.asset?.code).toBe('BOND')
  })

  it('refuses a clawback without a positive amount before anything is read or signed', async () => {
    const { rec, deps, opts } = harness()
    let asked = false
    const e = await rejection(sendIssuerAction(request({ kind: 'clawback', units: 0n }), async (x) => ((asked = true), x), opts, deps))
    expect(e.kind).toBe('refused')
    expect(asked).toBe(false)
    expect(rec.submitted).toHaveLength(0)
  })

  it('reads a wallet rejection as declined: nothing was sent', async () => {
    const { rec, deps, opts } = harness()
    const e = await rejection(sendIssuerAction(request({}), async () => Promise.reject(new Error('User rejected the request')), opts, deps))
    expect(e.kind).toBe('declined')
    expect(names(rec)).toEqual(['checking', 'signing'])
    expect(rec.submitted).toHaveLength(0)
  })

  it('reads any other wallet failure as refused, not as a rejection', async () => {
    const { deps, opts } = harness()
    const e = await rejection(sendIssuerAction(request({}), async () => Promise.reject(new Error('Wallet is locked')), opts, deps))
    expect(e.kind).toBe('refused')
  })

  it('refuses when the issuer account does not exist or cannot be read', async () => {
    const missing = harness({ loadSequence: async () => null })
    expect((await rejection(sendIssuerAction(request({}), signWith(issuer), missing.opts, missing.deps))).message).toBe(COPY.flags.missing)
    const down = harness({ loadSequence: async () => Promise.reject(new Error('Horizon 503')) })
    const e = await rejection(sendIssuerAction(request({}), signWith(issuer), down.opts, down.deps))
    expect(e.kind).toBe('refused')
    expect(e.message).toBe(COPY.tx.noSource)
    expect(names(down.rec)).toEqual(['checking'])
  })

  it('reads tx_failed as included and charged, with the hash of the signed transaction', async () => {
    const error = { response: { status: 400, data: { extras: { result_codes: { transaction: 'tx_failed', operations: ['op_cant_revoke'] } } } } }
    const { rec, deps, opts } = harness({ submitClassic: async (signed) => (rec.submitted.push(signed), Promise.reject(error)) })
    const e = await rejection(sendIssuerAction(request({}), signWith(issuer), opts, deps))
    expect(e.kind).toBe('failed')
    expect(e.message).toBe(RESULT_CODE_TEXT.op_cant_revoke)
    expect(e.hash).toBe(Buffer.from(rec.submitted[0].hash()).toString('hex'))
    expect(e.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(e.maxTime).toBeGreaterThan(0)
  })

  it('reads a bad signature as refused before any ledger', async () => {
    const error = { response: { status: 400, data: { extras: { result_codes: { transaction: 'tx_bad_auth' } } } } }
    const { deps, opts } = harness({ submitClassic: async () => Promise.reject(error) })
    const e = await rejection(sendIssuerAction(request({}), signWith(Keypair.random()), opts, deps))
    expect(e.kind).toBe('refused')
    expect(e.message).toBe(RESULT_CODE_TEXT.tx_bad_auth)
  })

  it('reads a timeout as an unknown outcome that can be looked up by hash', async () => {
    const { deps, opts } = harness({ submitClassic: async () => Promise.reject(new Error('timeout of 60000ms exceeded')) })
    const e = await rejection(sendIssuerAction(request({}), signWith(issuer), opts, deps))
    expect(e.kind).toBe('unknown')
    expect(e.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(e.message).toBe(COPY.tx.sentNotConfirmed)
  })
})

describe('a contract (the asset contract through the RPC)', () => {
  it('freezes with set_authorized, simulated first, and reports all four stages', async () => {
    const { rec, deps, opts } = harness()
    const receipt = await sendIssuerAction(request({ kind: 'freeze', target: CONTRACT }), signWith(issuer), opts, deps)
    expect(receipt).toEqual({ hash: 'from-rpc', ledger: 99 })
    expect(names(rec)).toEqual(['checking', 'signing', 'submitting', 'pending'])
    expect(rec.stages[3]).toMatchObject({ stage: 'pending', hash: 'from-rpc' })
    expect(rec.submitted).toHaveLength(0)
    expect(rec.prepared).toHaveLength(1)
    const op = rec.sentRpc[0].operations[0]
    expect(op.type).toBe('invokeHostFunction')
    expect(invoked(rec.sentRpc[0])).toEqual({ name: 'set_authorized', args: 2 })
    expect(rec.sentRpc[0].signatures).toHaveLength(1)
  })

  it('claws back with the asset contract function', async () => {
    const { rec, deps, opts } = harness()
    await sendIssuerAction(request({ kind: 'clawback', target: CONTRACT, units: 50_000_000n }), signWith(issuer), opts, deps)
    expect(invoked(rec.sentRpc[0])).toEqual({ name: 'clawback', args: 2 })
  })

  it('refuses when the simulation fails: nothing was signed', async () => {
    let asked = false
    const { rec, deps, opts } = harness({ prepare: async () => Promise.reject(new Error('HostError: Error(Contract, #13)')) })
    const e = await rejection(sendIssuerAction(request({ target: CONTRACT }), async (x) => ((asked = true), x), opts, deps))
    expect(e.kind).toBe('refused')
    expect(asked).toBe(false)
    expect(names(rec)).toEqual(['checking'])
  })

  it('reads a rejected send as refused, with the reason when the network gives one', async () => {
    const bad = harness({ sendRpc: async () => ({ status: 'ERROR', code: 'tx_bad_auth' }) })
    const e = await rejection(sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), bad.opts, bad.deps))
    expect(e.kind).toBe('refused')
    expect(e.message).toBe(RESULT_CODE_TEXT.tx_bad_auth)
    expect(names(bad.rec)).toEqual(['checking', 'signing', 'submitting'])

    const plain = harness({ sendRpc: async () => ({ status: 'ERROR' }) })
    expect((await rejection(sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), plain.opts, plain.deps))).message).toBe(COPY.tx.notAccepted)

    const busy = harness({ sendRpc: async () => ({ status: 'TRY_AGAIN_LATER' }) })
    expect((await rejection(sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), busy.opts, busy.deps))).message).toBe(COPY.tx.busy)
  })

  it('reads a send that threw as unknown: it may have reached the network', async () => {
    const { deps, opts } = harness({ sendRpc: async () => Promise.reject(new Error('fetch failed')) })
    const e = await rejection(sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), opts, deps))
    expect(e.kind).toBe('unknown')
    expect(e.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reads a transaction the contract refused in a ledger as failed, fee charged', async () => {
    const { deps, opts } = harness({ check: async () => ({ status: 'failed', message: 'The contract refused it.' }) })
    const e = await rejection(sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), opts, deps))
    expect(e.kind).toBe('failed')
    expect(e.hash).toBe('from-rpc')
  })

  it('keeps looking until a ledger answers', async () => {
    let n = 0
    const { rec, deps, opts } = harness({ check: async () => (++n < 3 ? { status: 'unknown' } : { status: 'confirmed', ledger: 5 }) })
    const receipt = await sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), opts, deps)
    expect(receipt.ledger).toBe(5)
    expect(n).toBe(3)
    expect(names(rec)).toContain('pending')
  })

  it('gives up as unknown, never as failed, when no ledger answers in time', async () => {
    const { deps, opts } = harness({ check: async () => ({ status: 'unknown' }) })
    const e = await rejection(sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), opts, deps))
    expect(e.kind).toBe('unknown')
    expect(e.hash).toBe('from-rpc')
  })

  it('reads a transaction that can no longer be included as expired', async () => {
    const { deps, opts } = harness({ check: async () => ({ status: 'expired' }) })
    expect((await rejection(sendIssuerAction(request({ target: CONTRACT }), signWith(issuer), opts, deps))).kind).toBe('expired')
  })
})

describe('guards', () => {
  it('refuses a target that is neither an account nor a contract before any read', async () => {
    let read = false
    const { deps, opts } = harness({ loadSequence: async () => ((read = true), '1') })
    const e = await rejection(sendIssuerAction(request({ target: 'GABC' }), signWith(issuer), opts, deps))
    expect(e.kind).toBe('refused')
    expect(read).toBe(false)
  })

  it('spells a rejected send the way the result-code table does', () => {
    expect(resultCodeOf({ result: () => ({ switch: () => ({ name: 'txBadAuth' }) }) })).toBe('tx_bad_auth')
    expect(resultCodeOf({ result: { type: 'txInsufficientFee' } })).toBe('tx_insufficient_fee')
    expect(resultCodeOf(undefined)).toBeNull()
    expect(resultCodeOf({ result: () => { throw new Error('x') } })).toBeNull()
  })
})
