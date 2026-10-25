import { TransactionBuilder, rpc, scValToNative } from '@stellar/stellar-sdk'
import type { Horizon, Transaction } from '@stellar/stellar-sdk'
import { buildSacAuthorizedQuery } from './issuerTx'

// Network helpers for the issuer console. Servers and passphrase are injected (no config import)
// so the same code runs in the browser and in a Node verification script.

export type Signer = (xdr: string) => Promise<string>

// Horizon rejections hide the useful part in extras.result_codes; surface it for describeError.
export function horizonError(e: unknown): Error {
  const codes = (e as { response?: { data?: { extras?: { result_codes?: unknown } } } })?.response?.data?.extras?.result_codes
  if (codes) return new Error(`Transaction rejected: ${JSON.stringify(codes)}`)
  return e instanceof Error ? e : new Error(String(e))
}

export async function submitClassic(
  horizon: Horizon.Server,
  tx: Transaction,
  sign: Signer,
  networkPassphrase: string,
): Promise<string> {
  const signed = TransactionBuilder.fromXDR(await sign(tx.toXDR()), networkPassphrase)
  try {
    return (await horizon.submitTransaction(signed)).hash
  } catch (e) {
    throw horizonError(e)
  }
}

export async function submitSoroban(
  server: rpc.Server,
  tx: Transaction,
  sign: Signer,
  networkPassphrase: string,
): Promise<string> {
  const prepared = await server.prepareTransaction(tx)
  const signed = TransactionBuilder.fromXDR(await sign(prepared.toXDR()), networkPassphrase)
  const sent = await server.sendTransaction(signed)
  if (sent.status === 'ERROR') throw new Error(`Submission failed: ${sent.errorResult?.toXDR('base64') ?? 'unknown'}`)
  const done = await server.pollTransaction(sent.hash, { attempts: 30 })
  if (done.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(`Transaction ${done.status}: ${sent.hash}`)
  return sent.hash
}

export async function readSacAuthorized(
  server: rpc.Server,
  sacId: string,
  id: string,
  networkPassphrase: string,
): Promise<boolean> {
  const sim = await server.simulateTransaction(buildSacAuthorizedQuery(sacId, id, networkPassphrase))
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error)
  if (!sim.result) throw new Error('No result from simulation')
  return Boolean(scValToNative(sim.result.retval))
}
