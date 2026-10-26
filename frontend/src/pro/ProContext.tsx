import { useCallback, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { proErrorMessage } from './errors'
import type { FixtureProClient } from './FixtureProClient'
import { ProCtx } from './proCtx'
import type { Outcome, ProCtxValue } from './proCtx'
import type { CallResult, Party, ProClient } from './types'

export function ProProvider({ client, sim, defaultMe, children }: { client: ProClient; sim: FixtureProClient | null; defaultMe: Party; children: ReactNode }) {
  const model = useSyncExternalStore(client.subscribe.bind(client), () => client.getModel())
  const [me, setMe] = useState<Party>(defaultMe)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const run = useCallback(async <T,>(label: string, call: Promise<CallResult<T>>, okText = 'Done.') => {
    const r = await call
    setOutcome(
      r.ok
        ? { label, ok: true, text: okText, code: null, name: null, note: r.note ?? null }
        : {
            label,
            ok: false,
            text: r.code === 0 ? 'Not available in this simulation.' : proErrorMessage(r.code),
            code: r.code === 0 ? null : r.code,
            name: r.name,
            note: r.note ?? null,
          },
    )
    return r
  }, [])
  const value: ProCtxValue = { client, sim, model, me, setMe, outcome, clearOutcome: () => setOutcome(null), run }
  return <ProCtx.Provider value={value}>{children}</ProCtx.Provider>
}
