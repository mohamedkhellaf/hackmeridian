import { config } from '../config'

// Latest ledger over a plain JSON-RPC `fetch`, so the shell's network chip never loads the Stellar SDK.

export interface LatestLedger {
  sequence: number
  /** Close time of that ledger in unix seconds, when the RPC reports it. */
  closeTime: number | null
}

/** RPC `getLatestLedger`. Throws when the RPC is unreachable or answers with an error. */
export async function readLatestLedger(rpcUrl: string = config.rpcUrl): Promise<LatestLedger> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger' }),
  })
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  return parseLatestLedger(await res.json())
}

export function parseLatestLedger(json: unknown): LatestLedger {
  const body = json as { result?: { sequence?: unknown; closeTime?: unknown }; error?: { message?: string } } | null
  if (body?.error) throw new Error(body.error.message ?? 'RPC error')
  const sequence = Number(body?.result?.sequence)
  if (!Number.isInteger(sequence) || sequence <= 0) throw new Error('RPC returned no ledger')
  const close = Number(body?.result?.closeTime)
  return { sequence, closeTime: Number.isFinite(close) && close > 0 ? close : null }
}
