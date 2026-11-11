// The three issuer transactions, sent with the stages the shared transaction machine expects (core/tx).
//
// This module reaches the Stellar SDK through core/stellar (rawTx, issuerTx), which import it statically: load
// it only through `import('./actions')` (see net.ts).
//
// The transactions themselves are the ones of the previous console (core/issuer/issuerTx):
//   - an account (`G...`) is authorized or frozen with a classic SetTrustLineFlags operation and clawed back with
//     a classic Clawback operation, both submitted to Horizon;
//   - a contract (`C...`) goes through the asset contract: `set_authorized` and `clawback`, simulated and sent
//     through the RPC.
// What is new is that each step is reported (`checking`, `signing`, `submitting`, `pending`) and that every
// failure is a `TxError` saying where it stopped: nothing was sent, the outcome is unknown, or the fee was charged.
import { config } from '../../core/config'
import { formatExact } from '../../core/format'
import { describeError } from '../../core/stellar/errors'
import { fetchAccount } from '../../core/stellar/horizon'
import { buildClawbackTx, buildSacTx, buildSetAuthorizedTx, sacClawbackOp, sacSetAuthorizedOp } from '../../core/stellar/issuerTx'
import { classicAsset, maxTimeOf, sourceAccount, submitToHorizon, transactionFromXdr, transactionHash } from '../../core/stellar/rawTx'
import type { Account, Transaction } from '../../core/stellar/rawTx'
import { TxError, isWalletRejection } from '../../core/tx/errors'
import type { TxCheck, TxOptions, TxReceipt } from '../../core/tx/types'
import { COPY, RESULT_CODE_TEXT } from './copy'
import { classifySubmitError, targetKind } from './model'
import type { ActionRequest, Sign } from './net'

/** What a submission through the RPC answered. */
export interface RpcSent {
  status: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR'
  hash?: string
  /** For `ERROR`: the result code in Horizon's spelling (`tx_bad_auth`), when the answer carries one. */
  code?: string | null
}

/** `txBadAuth` (the XDR name of a rejected send) as `tx_bad_auth`, the spelling the result-code table uses. */
export function resultCodeOf(errorResult: unknown): string | null {
  try {
    const raw = (errorResult as { result?: unknown } | undefined)?.result
    const v = (typeof raw === 'function' ? (raw as () => unknown).call(errorResult) : raw) as { type?: unknown; switch?: () => { name?: unknown } } | undefined
    const name = v?.type ?? v?.switch?.().name
    return typeof name === 'string' ? name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) : null
  } catch {
    return null
  }
}

/** Everything the sender needs from the network. The live set is below; tests pass fakes. */
export interface ActionDeps {
  passphrase: string
  /** The current sequence number of an account, or null when the account does not exist. */
  loadSequence(account: string): Promise<string | null>
  /** Classic: resolves once a ledger included the transaction; rejects with Horizon's error otherwise. */
  submitClassic(signed: Transaction): Promise<{ hash?: string; ledger?: number | null }>
  /** Contract call: simulates and attaches the footprint and the resource fee. */
  prepare(tx: Transaction): Promise<Transaction>
  /** Contract call: hands the signed transaction to the network. */
  sendRpc(signed: Transaction): Promise<RpcSent>
  /** Looks a transaction up once. */
  check(hash: string, maxTime: number | null): Promise<TxCheck>
  sleep(ms: number): Promise<void>
  now(): number
  /** How long to look for a contract transaction before reporting `unknown`. */
  pollTimeoutMs: number
}

export function liveDeps(): ActionDeps {
  return {
    passphrase: config.networkPassphrase,
    async loadSequence(account) {
      const doc = await fetchAccount(account)
      return doc ? (doc.sequence ?? null) : null
    },
    submitClassic: submitToHorizon,
    async prepare(tx) {
      const { server } = await import('../../core/stellar/rpc')
      return server.prepareTransaction(tx)
    },
    async sendRpc(signed) {
      const { server } = await import('../../core/stellar/rpc')
      const sent = await server.sendTransaction(signed)
      return { status: sent.status, hash: sent.hash, code: sent.status === 'ERROR' ? resultCodeOf(sent.errorResult) : null }
    },
    async check(hash, maxTime) {
      const [{ checkTransaction }, { server }] = await Promise.all([import('../../core/stellar/signer'), import('../../core/stellar/rpc')])
      const r = await checkTransaction(server, hash, maxTime)
      if (r.status === 'confirmed') return { status: 'confirmed', ledger: r.ledger }
      if (r.status === 'failed') return { status: 'failed', message: r.message }
      return { status: r.status }
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: Date.now,
    pollTimeoutMs: 60_000,
  }
}

/** The unsigned transaction of a request. A contract target is simulated here, which can refuse it. */
async function build(request: ActionRequest, source: Account, deps: ActionDeps): Promise<Transaction> {
  const { kind, asset, issuer, target } = request
  if (kind === 'clawback' && (request.units === undefined || request.units <= 0n)) {
    throw new TxError('refused', COPY.clawback.invalidAmount(asset.decimals))
  }
  if (targetKind(target) === 'account') {
    const classic = classicAsset(asset.code, issuer)
    if (kind === 'clawback') {
      // Classic amounts are decimal strings with at most 7 fraction digits; this one is exact by construction.
      return buildClawbackTx(source, classic, target, formatExact(request.units!, asset.decimals, { minDp: 0, group: false }), deps.passphrase)
    }
    return buildSetAuthorizedTx(source, classic, target, kind === 'authorize', deps.passphrase)
  }
  const op = kind === 'clawback' ? sacClawbackOp(asset.contractId, target, request.units!) : sacSetAuthorizedOp(asset.contractId, target, kind === 'authorize')
  try {
    return await deps.prepare(buildSacTx(source, op, deps.passphrase))
  } catch (e) {
    throw new TxError('refused', describeError(e), { cause: e })
  }
}

/**
 * Builds, signs and sends one issuer action. Resolves with the hash once a ledger included it; rejects with a
 * `TxError`. A transaction that was sent and is not found is `unknown`, never a failure.
 */
export async function sendIssuerAction(request: ActionRequest, sign: Sign, opts: TxOptions = {}, deps: ActionDeps = liveDeps()): Promise<TxReceipt> {
  const stage = opts.onStage ?? (() => {})
  if (!targetKind(request.target)) throw new TxError('refused', COPY.add.invalid)

  // ---- check: nothing has been sent, whatever happens here
  stage({ stage: 'checking' })
  let sequence: string | null
  try {
    sequence = await deps.loadSequence(request.issuer)
  } catch (e) {
    throw new TxError('refused', COPY.tx.noSource, { cause: e })
  }
  if (sequence === null) throw new TxError('refused', COPY.powers.missing)
  const unsigned = await build(request, sourceAccount(request.issuer, sequence), deps)

  // ---- sign
  stage({ stage: 'signing' })
  let signed: Transaction
  try {
    const xdr = await sign(unsigned.toXDR())
    if (!xdr) throw new Error(COPY.tx.noSigned)
    signed = transactionFromXdr(xdr, deps.passphrase)
  } catch (e) {
    throw new TxError(isWalletRejection(e) ? 'declined' : 'refused', describeError(e), { cause: e })
  }
  const hash = transactionHash(signed)
  const maxTime = maxTimeOf(signed)

  // ---- send
  stage({ stage: 'submitting' })
  if (targetKind(request.target) === 'account') {
    // Horizon answers once a ledger closed with the transaction in it, or says why not.
    try {
      const r = await deps.submitClassic(signed)
      return { hash: r.hash || hash, ledger: r.ledger ?? null }
    } catch (e) {
      const failure = classifySubmitError(e)
      throw new TxError(failure.kind, failure.message, { hash, maxTime, cause: e })
    }
  }

  let sent: RpcSent
  try {
    sent = await deps.sendRpc(signed)
  } catch (e) {
    // The request may or may not have reached the network.
    throw new TxError('unknown', COPY.tx.sentNotConfirmed, { hash, maxTime, cause: e })
  }
  if (sent.status === 'TRY_AGAIN_LATER') throw new TxError('refused', COPY.tx.busy, { hash, maxTime })
  if (sent.status === 'ERROR') {
    const known = sent.code ? RESULT_CODE_TEXT[sent.code] : undefined
    throw new TxError('refused', known ?? (sent.code ? COPY.tx.rejectedWith(sent.code) : COPY.tx.notAccepted), { hash, maxTime })
  }
  const sentHash = sent.hash || hash
  stage({ stage: 'pending', hash: sentHash, maxTime })

  // ---- wait for a ledger
  const deadline = deps.now() + deps.pollTimeoutMs
  let wait = 1000
  for (;;) {
    const check = await deps.check(sentHash, maxTime).catch((): TxCheck => ({ status: 'unknown' }))
    if (check.status === 'confirmed') return { hash: sentHash, ledger: check.ledger }
    if (check.status === 'failed') throw new TxError('failed', check.message, { hash: sentHash, maxTime })
    if (check.status === 'expired') throw new TxError('expired', COPY.tx.neverIncluded, { hash: sentHash, maxTime })
    if (deps.now() >= deadline) throw new TxError('unknown', COPY.tx.sentNotConfirmed, { hash: sentHash, maxTime })
    await deps.sleep(wait)
    wait = Math.min(Math.round(wait * 1.5), 3000)
  }
}
