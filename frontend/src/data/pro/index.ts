// Margin bindings in one import: `import { ProLoader, usePro } from '../../data/pro'`.
// The Margin routes are the only caller. `MarginProvider` and `useMargin` are the same things under the name the
// section has in the app (the code name `pro` is kept for the contract, the client and the fixtures).
export { ProProvider, ProProvider as MarginProvider, ProLoader, ProLoader as MarginLoader } from './ProContext'
export type { ProProviderProps, ProLoaderProps } from './ProContext'
export { usePro, usePro as useMargin, outcomeOf, notStarted } from './proCtx'
export type { ProCtxValue, Outcome, ProCall } from './proCtx'
export { useProClient } from './useProClient'
export type { ProClientState } from './useProClient'
