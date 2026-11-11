// Public surface of the data layer: React bindings over src/core. Features and the shell import from here.
// See README.md for every hook with its signature.

// Providers and the client
export { DataProvider, OptionsClientProvider } from './providers'
export type { DataProviderProps } from './providers'
export { useOptionsClient, useMe, useIsMock } from './useOptionsClient'
export type { OptionsClientHandle } from './useOptionsClient'
export { queryClient, createQueryClient, POLL_MS, STALE_MS } from './queryClient'
export type { Cadence } from './queryClient'
export { keys, makeKeys, idKey } from './keys'
export { useNowSec, useLedgerNowMs, useLedgerOffsetMs } from './clock'

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
  useHolderStatus,
  useReference,
  referenceMode,
} from './queries'
export type { ReadOptions } from './queries'
export { useNetworkStatus, NETWORK_STATE_LABEL } from './network'
export type { NetworkState, NetworkStatus } from './network'

// Derived views
export { useAsset, useMarket, useMarketsIndex, useBook, useGuidedMatch, usePositions, usePosition, useTodo, useRequestTodo, useActionsWaiting, usePortfolioKpis, optionReference, isNotFoundMessage } from './derived'
export type { Derived, ViewOptions, PortfolioOptions, PositionDetail, AssetRoute } from './derived'
export { LADDER_ROWS } from './derived/market'
export type { MarketView, ExpiryColumn, GridRow, GridCell, OtherOrder, MarketSummary, BookView, BookEntry, MarketIndexRow, MarketSource } from './derived/market'
export type { PositionView, PositionsView, TodoView, TodoTone, RequestTodoView } from './derived/positions'
export type { GuidedMatch, GuidedAlternative, GuidedTermsInput } from './derived/guided'

// Transactions
export { useTx, useTxBusy, useSubjectBusy, STOP_WAITING_AFTER_MS } from './tx/useTx'
export { useUnsettledTx } from './tx/useUnsettledTx'
export type { UnsettledTx } from './tx/useUnsettledTx'
export type { TxController, TxDescription, UseTxOptions } from './tx/useTx'
export type { TxRun, TxMeta } from './tx/runner'
export { useActivity } from './tx/useActivity'
export type { ActivityView } from './tx/useActivity'
export { activityStore, canCheckEntry, isOpenEntry, entryState } from './tx/activityStore'
export type { ActivityEntry, ActivityPhase, ActivityProduct } from './tx/activityStore'
export { TX_PHASE_LABEL, TX_PHASE_HELP, TX_EFFECT_TEXT, TX_REFUSED_ON_SEND, describeTx, txEffectText } from './tx/copy'
export type { TxSummary } from './tx/copy'
export { optionSubject, bidSubject, isIssuerAction, issuerActionName, issuerSubject, parseIssuerSubject } from './tx/invalidation'
export type { IssuerActionKind } from './tx/invalidation'
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
export { initSettings, useSettings, useDefaultMode, settingsStore, applySettings, DEFAULT_SETTINGS, MODE_CHOICES, SETTINGS_STORAGE_KEY } from './settings'
export type { Settings, SettingsHandle, DefaultMode, ThemeChoice, DensityChoice, PnlScheme } from './settings'

// The welcome guide: what this browser has seen, and the request to run it
export { useGuide, useModeNoteOffer, guideStore, GUIDE_STORAGE_KEY } from './guide'
export type { GuideHandle, GuideOrigin, GuideRun, GuideState } from './guide'

// Margin (also importable as a folder: `../data/pro`)
export { ProProvider, MarginProvider, ProLoader, MarginLoader, usePro, useMargin, useProClient } from './pro'
export type { ProProviderProps, ProLoaderProps, ProCtxValue, Outcome, ProCall, ProClientState } from './pro'
