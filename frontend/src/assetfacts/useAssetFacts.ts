import { useEffect, useState } from 'react'
import { fetchAssetFacts, fetchHolderStatus } from './assetFacts'
import type { AssetFacts, HolderStatus } from './assetFacts'

export type Loadable<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T }

export function useAssetFacts(contractId: string, code: string): Loadable<AssetFacts> {
  const [res, setRes] = useState<{ key: string; v: Loadable<AssetFacts> } | null>(null)
  useEffect(() => {
    let live = true
    fetchAssetFacts(contractId, code).then(
      (data) => live && setRes({ key: contractId, v: { state: 'ready', data } }),
      (e) => live && setRes({ key: contractId, v: { state: 'error', message: e instanceof Error ? e.message : String(e) } }),
    )
    return () => {
      live = false
    }
  }, [contractId, code])
  return res?.key === contractId ? res.v : { state: 'loading' }
}

export function useHolderStatus(code: string, issuer: string | null, address: string | null): HolderStatus | 'error' | null {
  const [res, setRes] = useState<{ key: string; v: HolderStatus | 'error' } | null>(null)
  const key = `${code}:${issuer}:${address}`
  useEffect(() => {
    if (!issuer || !address) return
    let live = true
    fetchHolderStatus(code, issuer, address).then(
      (v) => live && setRes({ key, v }),
      () => live && setRes({ key, v: 'error' }),
    )
    return () => {
      live = false
    }
  }, [key, code, issuer, address])
  return issuer && address && res?.key === key ? res.v : null
}
