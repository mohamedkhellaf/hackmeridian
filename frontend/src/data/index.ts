// Public surface of the data layer: React bindings over src/core. Features and the shell import from here.
// See README.md for every hook with its signature.

// Providers and the client
export { DataProvider, OptionsClientProvider } from './providers'
export type { DataProviderProps } from './providers'
export { useOptionsClient, useMe } from './useOptionsClient'
export type { OptionsClientHandle } from './useOptionsClient'
export { queryClient, createQueryClient, POLL_MS, STALE_MS } from './queryClient'
export type { Cadence } from './queryClient'
export { keys, makeKeys, idKey } from './keys'
export { useNowSec } from './clock'

// Reads
export {
  useAssets,
  useOptions,
  useAsks,
  useBids,
  useCollateral,
  useHealth,
  useBalances,
  useBalancesById,
  useEligibility,
  useOption,
  useBid,
  useAsk,
  useWriterOpenCount,
  useBuyerOpenCount,
  useLedger,
  useAssetFacts,
  useReference,
  referenceMode,
} from './queries'
export type { ReadOptions } from './queries'
export { useNetworkStatus, NETWORK_STATE_LABEL } from './network'
export type { NetworkState, NetworkStatus } from './network'

// Derived views
export { useMarket, useMarketsIndex, useBook, useGuidedMatch, usePositions, usePosition, useTodo, useActionsWaiting, usePortfolioKpis, optionReference } from './derived'
export type { Derived, ViewOptions, PortfolioOptions, PositionDetail } from './derived'
export type { MarketView, ExpiryColumn, GridRow, GridCell, OtherOrder, MarketSummary, BookView, BookEntry, MarketIndexRow, MarketSource } from './derived/market'
export type { PositionView, PositionsView, TodoView, TodoTone } from './derived/positions'
export type { GuidedMatch, GuidedAlternative, GuidedTermsInput } from './derived/guided'

// Transactions
export { useTx, useTxBusy, useSubjectBusy } from './tx/useTx'
export type { TxController, TxDescription, UseTxOptions } from './tx/useTx'
export type { TxRun, TxMeta } from './tx/runner'
export { useActivity } from './tx/useActivity'
export type { ActivityView } from './tx/useActivity'
export { canCheckEntry, isOpenEntry, entryState } from './tx/activityStore'
export type { ActivityEntry, ActivityPhase, ActivityProduct } from './tx/activityStore'
export { TX_PHASE_LABEL, TX_PHASE_HELP, TX_EFFECT_TEXT, describeTx } from './tx/copy'
export type { TxSummary } from './tx/copy'
export { optionSubject, bidSubject } from './tx/invalidation'
export type { CoveredAction } from './tx/invalidation'
export {
  useBuy,
  useExercise,
  useClaimDelivery,
  useReclaim,
  useCancelOffer,
  useWriteOffer,
  useListForSale,
  useCancelSale,
  useBuyResale,
  useCreateBid,
  useCancelBid,
  useFillBid,
} from './mutations'
export type { CoveredTx, MutationOptions } from './mutations'
export { usePreTrade } from './usePreTrade'
export type { PreTradeOptions, PreTradeView } from './usePreTrade'

// Settings
export { useSettings, useDefaultMode, settingsStore, applySettings, DEFAULT_SETTINGS, MODE_CHOICES, SETTINGS_STORAGE_KEY } from './settings'
export type { Settings, SettingsHandle, DefaultMode, ThemeChoice, DensityChoice, PnlScheme } from './settings'

// Margin
export { ProProvider, ProLoader } from './pro/ProContext'
export type { ProProviderProps, ProLoaderProps } from './pro/ProContext'
export { usePro } from './pro/proCtx'
export type { ProCtxValue, Outcome, ProCall } from './pro/proCtx'
export { useProClient } from './pro/useProClient'
export type { ProClientState } from './pro/useProClient'
