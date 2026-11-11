import type { contract, rpc } from '@stellar/stellar-sdk'
import { config } from '../config'
import { TxError, errorMessage, isWalletRejection } from '../tx/errors'
import { notFoundStatus } from '../tx/machine'
import type { TxCheck, TxOptions } from '../tx/types'
import { describeError } from './errors'

// What a wallet gives a client: the address and the two signing functions (useWallet() returns a superset).
export interface WalletSigner {
  address: string | null
  sign: (xdr: string) => Promise<string>
  signAuthEntry?: (entryXdr: string) => Promise<string>
}

type ClientSigning = Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry' | 'publicKey'>

// Wallet failures are returned as `error` (the shape contract.Client expects) so the SDK raises them and
// errors.ts can decode the message. SEP-43 code -4 is "the user rejected"; anything else is an internal
// wallet error (-1), so a locked or missing wallet is not reported as a rejection.
function walletError(e: unknown) {
  return { message: e instanceof Error ? e.message : String(e), code: isWalletRejection(e) ? -4 : -1 }
}

// Options for contract.Client: { publicKey, signTransaction, signAuthEntry }.
export function clientSigning(wallet: WalletSigner): ClientSigning {
  const signAuth = wallet.signAuthEntry
  return {
    publicKey: wallet.address ?? undefined,
    signTransaction: async (xdr) => {
      try {
        return { signedTxXdr: await wallet.sign(xdr), signerAddress: wallet.address ?? undefined }
      } catch (e) {
        return { signedTxXdr: '', error: walletError(e) }
      }
    },
    signAuthEntry: signAuth
      ? async (entry) => {
          try {
            return { signedAuthEntry: await signAuth(entry), signerAddress: wallet.address ?? undefined }
          } catch (e) {
            return { signedAuthEntry: '', error: walletError(e) }
          }
        }
      : undefined,
  }
}

// Spread into contract.Client / Client.from options together with clientSigning(wallet).
export const baseClientOptions = {
  rpcUrl: config.rpcUrl,
  networkPassphrase: config.networkPassphrase,
}

/** The part of rpc.Server that sending and polling need (tests pass a fake). */
export type TxServer = Pick<rpc.Server, 'sendTransaction' | 'getTransaction'>

export interface SendOptions extends TxOptions {
  /** Defaults to the transaction's own server, else the shared one from ./rpc. */
  server?: TxServer
  /** How long to look for the transaction after it was accepted before reporting `unknown`. Default 60 s. */
  pollTimeoutMs?: number
  /** First delay between two looks; grows by half each time up to 3 s. Default 1 s. */
  pollIntervalMs?: number
  /** Delay before resending after TRY_AGAIN_LATER. Default 2 s. */
  resendDelayMs?: number
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** What the signed transaction looks like to this module (a Transaction or a FeeBumpTransaction). */
interface SignedLike {
  hash(): ArrayLike<number>
  timeBounds?: { maxTime?: string | number } | null
  innerTransaction?: { timeBounds?: { maxTime?: string | number } | null }
}

function maxTimeOf(signed: SignedLike): number | null {
  const raw = signed.timeBounds?.maxTime ?? signed.innerTransaction?.timeBounds?.maxTime
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Hex of the transaction hash. SDK 17 returns a Uint8Array, whose own toString is not hex. */
const toHex = (bytes: ArrayLike<number>): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** `txBadSeq`, `txTooLate`... from a rejected send. SDK 17 exposes union arms as properties (`result.type`). */
function sendErrorName(errorResult: unknown): string | null {
  try {
    const raw = (errorResult as { result?: unknown } | undefined)?.result
    const v = (typeof raw === 'function' ? (raw as () => unknown).call(errorResult) : raw) as { type?: unknown; switch?: () => { name?: unknown } } | undefined
    const name = v?.type ?? v?.switch?.().name
    return typeof name === 'string' ? name : null
  } catch {
    return null
  }
}

/**
 * `Error(Contract, #N)` for each contract error in the diagnostic events of a failed transaction, so errors.ts can
 * name the refusal. In SDK 17 an XDR ScError serialises as `{"error":{"contract":N}}`.
 */
export function failureText(resp: unknown): string {
  try {
    const events = (resp as { diagnosticEventsXdr?: unknown }).diagnosticEventsXdr
    const text = JSON.stringify(events ?? null, (_k, v) => (typeof v === 'bigint' ? v.toString() : (v as unknown))) ?? ''
    const codes = [...text.matchAll(/"error":\{"contract":(\d+)\}/g)].map((m) => `Error(Contract, #${m[1]})`)
    if (codes.length) return codes.join(' ')
  } catch {
    // Not decodable: fall through to the generic text.
  }
  return 'The network included the transaction but the contract refused it.'
}

const MAX_UNBOUNDED_RESENDS = 30
const SENT_NOT_CONFIRMED = 'Not confirmed yet. The transaction was sent and can still be included; check again before sending another.'
const NEVER_INCLUDED = 'The transaction expired without being included. Nothing was charged.'

/**
 * Looks a transaction up once. `unknown` while it is not found and its time bound has not passed; `expired`
 * only once a ledger has closed after `maxTime`.
 */
export async function checkTransaction(server: TxServer, hash: string, maxTime: number | null): Promise<TxCheck & { returnValue?: unknown }> {
  let resp: Awaited<ReturnType<TxServer['getTransaction']>>
  try {
    resp = await server.getTransaction(hash)
  } catch {
    return { status: 'unknown' }
  }
  if (resp.status === 'SUCCESS') return { status: 'confirmed', ledger: typeof resp.ledger === 'number' ? resp.ledger : null, returnValue: resp.returnValue }
  if (resp.status === 'FAILED') return { status: 'failed', message: describeError(failureText(resp)) }
  return { status: notFoundStatus(resp.latestLedgerCloseTime, maxTime) }
}

/**
 * Sign, send and wait for one AssembledTransaction, reporting each stage:
 *   signing     before the wallet is asked
 *   submitting  once signed, before `sendTransaction`
 *   pending     once the network accepted it (PENDING or DUPLICATE): the hash is known here
 * Resolves with the hash, the decoded result and the ledger once a ledger includes it. Rejects with a `TxError`
 * whose `kind` says where it stopped (declined, refused, failed, unknown, expired). A transaction that was sent
 * and is not found is `unknown`, never a failure: it can still be included until a ledger closes after its
 * time bound.
 */
export async function signAndSend<T>(tx: contract.AssembledTransaction<T>, opts: SendOptions = {}): Promise<{ hash: string; result: T; ledger: number | null }> {
  const sleep = opts.sleep ?? realSleep
  const now = opts.now ?? Date.now
  const stage = opts.onStage ?? (() => {})

  // ---- sign: nothing has been sent, whatever happens here
  stage({ stage: 'signing' })
  try {
    await tx.sign()
  } catch (e) {
    // The wallet layer already words its failures for the user and names the wallet: keep that sentence.
    const raw = errorMessage(e)
    const declined = isWalletRejection(e)
    const message = declined && /^You rejected the request in /.test(raw) ? raw : describeError(e)
    throw new TxError(declined ? 'declined' : 'refused', message, { cause: e })
  }
  const signed = tx.signed as unknown as (SignedLike & Parameters<TxServer['sendTransaction']>[0]) | undefined
  if (!signed) throw new TxError('refused', 'The wallet returned no signed transaction.')
  const maxTime = maxTimeOf(signed)
  let hash = toHex(signed.hash())

  // ---- send
  stage({ stage: 'submitting' })
  const server: TxServer = opts.server ?? (tx.options.server as TxServer | undefined) ?? (await import('./rpc')).server
  const resendDelay = opts.resendDelayMs ?? 2000
  let resends = 0
  for (;;) {
    let sent: Awaited<ReturnType<TxServer['sendTransaction']>>
    try {
      sent = await server.sendTransaction(signed)
    } catch (e) {
      // The request may or may not have reached the network: the outcome is not known.
      throw new TxError('unknown', SENT_NOT_CONFIRMED, { hash, maxTime, cause: e })
    }
    if (sent.status === 'PENDING' || sent.status === 'DUPLICATE') {
      hash = sent.hash || hash
      break
    }
    if (sent.status === 'TRY_AGAIN_LATER') {
      // The node is busy. Resend the same signed transaction while it can still be included.
      if (notFoundStatus(sent.latestLedgerCloseTime, maxTime) === 'expired' || (maxTime !== null && now() / 1000 > maxTime + 60))
        throw new TxError('expired', NEVER_INCLUDED, { hash, maxTime })
      // Without a time bound there is no natural end: stop after a minute of refusals. No node ever accepted it.
      if (maxTime === null && ++resends >= MAX_UNBOUNDED_RESENDS) throw new TxError('refused', 'The network is busy and did not accept the transaction. Nothing was charged; send it again later.', { hash })
      await sleep(resendDelay)
      continue
    }
    // ERROR: the node rejected it before any ledger. Nothing was sent on.
    const name = sendErrorName(sent.errorResult)
    const known = name ? describeError(name) : null
    const message = known && known !== name ? known : `The network did not accept the transaction${name ? ` (${name})` : ''}. Nothing was charged.`
    throw new TxError('refused', message, { hash, maxTime })
  }
  stage({ stage: 'pending', hash, maxTime })

  // ---- wait for a ledger
  const deadline = now() + (opts.pollTimeoutMs ?? 60_000)
  let wait = opts.pollIntervalMs ?? 1000
  for (;;) {
    const check = await checkTransaction(server, hash, maxTime)
    if (check.status === 'confirmed') {
      let result: T
      try {
        result = tx.options.parseResultXdr(check.returnValue as Parameters<typeof tx.options.parseResultXdr>[0])
      } catch (e) {
        // Included, but its return value could not be decoded here. That is not a failure of the transaction:
        // report it as not settled, so a later check (which needs no return value) confirms it.
        throw new TxError('unknown', `The transaction was included, but its result could not be read (${errorMessage(e)}). Check again.`, { hash, maxTime, cause: e })
      }
      return { hash, result, ledger: check.ledger }
    }
    if (check.status === 'failed') throw new TxError('failed', check.message, { hash, maxTime })
    if (check.status === 'expired') throw new TxError('expired', NEVER_INCLUDED, { hash, maxTime })
    if (now() >= deadline) throw new TxError('unknown', SENT_NOT_CONFIRMED, { hash, maxTime })
    await sleep(wait)
    wait = Math.min(Math.round(wait * 1.5), 3000)
  }
}
