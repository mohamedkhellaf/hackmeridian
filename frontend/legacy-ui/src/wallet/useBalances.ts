import { useCallback, useEffect, useMemo, useState } from 'react'
import { readBalances, type TokenBalance, type TokenRef } from '../stellar/tokens'

// Read-only SAC balances for `address`. Never signs. Mock token IDs resolve to status 'mock'.
export function useBalances(address: string | null, tokens: TokenRef[]) {
  const [balances, setBalances] = useState<Record<string, TokenBalance>>({})
  const [loading, setLoading] = useState(false)
  // Stable key so callers can pass an inline array without refetch loops.
  const key = useMemo(() => tokens.map((t) => `${t.contractId}|${t.code ?? ''}|${t.issuer ?? ''}`).join(','), [tokens])

  const refresh = useCallback(async () => {
    if (!address) {
      setBalances({})
      return
    }
    setLoading(true)
    try {
      const list = await readBalances(tokens, address)
      setBalances(Object.fromEntries(list.map((b) => [b.contractId, b])))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, key])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { balances, loading, refresh }
}
