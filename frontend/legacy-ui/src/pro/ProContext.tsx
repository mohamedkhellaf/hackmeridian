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
            // code 0: no scripted step (fixtures); code < 0: not a contract refusal (wallet, network), the note says why.
            text: r.code === 0 ? 'Not available in this simulation.' : r.code < 0 ? (r.note ?? 'The transaction failed.') : proErrorMessage(r.code),
            code: r.code <= 0 ? null : r.code,
            name: r.code < 0 ? null : r.name,
            note: r.code < 0 ? null : (r.note ?? null),
          },
    )
    return r
  }, [])
  const value: ProCtxValue = { client, sim, model, me, setMe, outcome, clearOutcome: () => setOutcome(null), run }
  return <ProCtx.Provider value={value}>{children}</ProCtx.Provider>
}
