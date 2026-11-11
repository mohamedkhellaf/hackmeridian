// The issuer transactions against Stellar Testnet, with throwaway accounts made for the run.
//
// Skipped unless ISSUER_LIVE=1 (it needs the network and Friendbot, and takes about two minutes):
//
//   ISSUER_LIVE=1 npx vitest run src/features/issuer/actions.live.test.ts
//
// What it proves that the unit tests cannot: the transactions `sendIssuerAction` builds are accepted by Horizon
// and by the asset contract, the stages arrive in order, and the console's reads (`liveNet`) see the result.
// The keys are random and never leave this process; the asset is a fresh code under a fresh issuer, so nothing
// the team deployed is touched.
import { Asset, BASE_FEE, Contract, Horizon, Keypair, Networks, Operation, TransactionBuilder, nativeToScVal, rpc } from '@stellar/stellar-sdk'
import type { xdr } from '@stellar/stellar-sdk'
import { beforeAll, describe, expect, it } from 'vitest'
import { TxError } from '../../core/tx/errors'
import type { TxStage } from '../../core/tx/types'
import { sendIssuerAction } from './actions'
import { RESULT_CODE_TEXT } from './copy'
import { liveNet } from './net'
import type { ActionRequest } from './net'

const LIVE = process.env.ISSUER_LIVE === '1'
const HORIZON = 'https://horizon-testnet.stellar.org'
const RPC = 'https://soroban-testnet.stellar.org'
const U = 10_000_000n

const issuer = Keypair.random()
const holder = Keypair.random()
const stranger = Keypair.random()
const classic = new Asset('ISSR', issuer.publicKey())
const sacId = classic.contractId(Networks.TESTNET)
const asset = { contractId: sacId, code: 'ISSR', decimals: 7, issuer: issuer.publicKey() }
// A contract that certainly exists, to stand for "a contract that holds the asset": the native asset's contract.
const someContract = Asset.native().contractId(Networks.TESTNET)

const horizon = new Horizon.Server(HORIZON)
const soroban = new rpc.Server(RPC)

const signWith = (kp: Keypair) => async (envelope: string) => {
  const tx = TransactionBuilder.fromXDR(envelope, Networks.TESTNET)
  tx.sign(kp)
  return tx.toXDR()
}

async function friendbot(account: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${account}`)
  if (!res.ok) throw new Error(`Friendbot ${res.status}`)
}

/** Setup only: a classic transaction signed and submitted directly. */
async function classicTx(source: Keypair, ...ops: xdr.Operation[]): Promise<void> {
  const account = await horizon.loadAccount(source.publicKey())
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  for (const op of ops) builder.addOperation(op)
  const tx = builder.setTimeout(120).build()
  tx.sign(source)
  await horizon.submitTransaction(tx, { skipMemoRequiredCheck: true })
}

/** Setup only: a contract transaction, simulated, signed, sent and awaited. */
async function contractTx(source: Keypair, op: xdr.Operation): Promise<void> {
  const account = await soroban.getAccount(source.publicKey())
  const tx = await soroban.prepareTransaction(new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(op).setTimeout(120).build())
  tx.sign(source)
  const sent = await soroban.sendTransaction(tx)
  if (sent.status === 'ERROR') throw new Error(`setup send failed: ${sent.status}`)
  const done = await soroban.pollTransaction(sent.hash, { attempts: 40 })
  if (done.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(`setup transaction ${done.status}`)
}

async function act(request: Omit<ActionRequest, 'asset' | 'issuer'>, signer: Keypair = issuer) {
  const stages: TxStage[] = []
  const receipt = await sendIssuerAction({ ...request, asset, issuer: issuer.publicKey() }, signWith(signer), { onStage: (s) => stages.push(s) })
  return { receipt, stages: stages.map((s) => s.stage) }
}

describe.skipIf(!LIVE)('issuer actions on Testnet (throwaway accounts)', { timeout: 240_000 }, () => {
  beforeAll(async () => {
    await Promise.all([friendbot(issuer.publicKey()), friendbot(holder.publicKey()), friendbot(stranger.publicKey())])
    // The three flags the console needs, then a trustline that starts unauthorized.
    await classicTx(issuer, Operation.setOptions({ setFlags: (1 | 2 | 8) as never }))
    await classicTx(holder, Operation.changeTrust({ asset: classic }))
    await contractTx(issuer, Operation.createStellarAssetContract({ asset: classic }))
  }, 180_000)

  it('reads the flags, the record and an unauthorized trustline', async () => {
    const facts = await liveNet.readIssuer(issuer.publicKey())
    expect(facts?.flags).toMatchObject({ authRequired: true, authRevocable: true, clawback: true, authImmutable: false })
    expect(facts?.locked).toBe(false)
    expect(await liveNet.readTarget(asset, issuer.publicKey(), holder.publicKey())).toEqual({ kind: 'account', state: 'unauthorized', balance: 0n, clawback: true })
    expect((await liveNet.readTarget(asset, issuer.publicKey(), stranger.publicKey())).state).toBe('no-trustline')
    expect((await liveNet.readTarget(asset, issuer.publicKey(), Keypair.random().publicKey())).state).toBe('unfunded')
    expect((await liveNet.readTarget(asset, issuer.publicKey(), issuer.publicKey())).state).toBe('issuer')
    expect(await liveNet.readIssuer(Keypair.random().publicKey())).toBeNull()
    expect(await liveNet.isIssuerOf({ ...asset, issuer: undefined }, issuer.publicKey())).toBe(true)
    expect(await liveNet.isIssuerOf({ ...asset, issuer: undefined }, holder.publicKey())).toBe(false)
  })

  it('authorizes, freezes and claws back an account through Horizon', async () => {
    const authorized = await act({ kind: 'authorize', target: holder.publicKey() })
    expect(authorized.stages).toEqual(['checking', 'signing', 'submitting'])
    expect(authorized.receipt.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(authorized.receipt.ledger).toBeGreaterThan(0)
    expect((await liveNet.readTarget(asset, issuer.publicKey(), holder.publicKey())).state).toBe('authorized')

    await classicTx(issuer, Operation.payment({ destination: holder.publicKey(), asset: classic, amount: '100' }))

    const holders = await liveNet.readHolders(asset, issuer.publicKey())
    expect(holders.more).toBe(false)
    expect(holders.rows).toEqual([{ address: holder.publicKey(), read: { kind: 'account', state: 'authorized', balance: 100n * U, clawback: true } }])
    const record = await liveNet.readRecord('ISSR', issuer.publicKey())
    expect(record?.trustlines).toMatchObject({ authorized: 1, unauthorized: 0 })

    await act({ kind: 'freeze', target: holder.publicKey() })
    expect((await liveNet.readTarget(asset, issuer.publicKey(), holder.publicKey())).state).toBe('unauthorized')

    await act({ kind: 'clawback', target: holder.publicKey(), units: 40n * U + 1n })
    expect((await liveNet.readTarget(asset, issuer.publicKey(), holder.publicKey())).balance).toBe(60n * U - 1n)
  })

  it('reports a transaction that fails in a ledger as failed, and a wrong signer as refused', async () => {
    // More than the balance: the transaction is included and the operation fails there.
    const failed = await act({ kind: 'clawback', target: holder.publicKey(), units: 1_000n * U }).catch((e: unknown) => e)
    expect(failed).toBeInstanceOf(TxError)
    expect((failed as TxError).kind).toBe('failed')
    expect((failed as TxError).message).toBe(RESULT_CODE_TEXT.op_underfunded)
    expect((failed as TxError).hash).toMatch(/^[0-9a-f]{64}$/)

    const refused = await act({ kind: 'freeze', target: holder.publicKey() }, stranger).catch((e: unknown) => e)
    expect((refused as TxError).kind).toBe('refused')
    expect((refused as TxError).message).toBe(RESULT_CODE_TEXT.tx_bad_auth)
  })

  it('authorizes, claws back and freezes a contract through the asset contract', async () => {
    expect((await liveNet.readTarget(asset, issuer.publicKey(), someContract)).state).toBe('unauthorized')

    const authorized = await act({ kind: 'authorize', target: someContract })
    expect(authorized.stages).toEqual(['checking', 'signing', 'submitting', 'pending'])
    expect(authorized.receipt.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await liveNet.readTarget(asset, issuer.publicKey(), someContract)).toMatchObject({ kind: 'contract', state: 'authorized' })

    const addr = (a: string) => nativeToScVal(a, { type: 'address' })
    await contractTx(issuer, new Contract(sacId).call('mint', addr(someContract), nativeToScVal(50n * U, { type: 'i128' })))
    expect((await liveNet.readTarget(asset, issuer.publicKey(), someContract)).balance).toBe(50n * U)

    await act({ kind: 'clawback', target: someContract, units: 20n * U })
    expect((await liveNet.readTarget(asset, issuer.publicKey(), someContract)).balance).toBe(30n * U)

    await act({ kind: 'freeze', target: someContract })
    expect(await liveNet.readTarget(asset, issuer.publicKey(), someContract)).toMatchObject({ kind: 'contract', state: 'unauthorized', balance: 30n * U })

    const refused = await act({ kind: 'authorize', target: someContract }, stranger).catch((e: unknown) => e)
    expect((refused as TxError).kind).toBe('refused')
  })
})
