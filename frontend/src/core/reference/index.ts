// The reference price model (brief D12): honest labels, the two providers that exist tonight, and exact
// moneyness helpers. Nothing here is a market price, and nothing here reaches a transaction.
export { REFERENCE_LABEL, REFERENCE_NOTE } from './types'
export type { ReferenceKind, ReferencePrice } from './types'
export { DEMO_PRICES, DEMO_SOURCE, FAUCET_PRICE, FAUCET_SOURCE, noReference, demoPerUnit, demoReference, faucetReference, referenceFor } from './providers'
export type { ReferenceSubject } from './providers'
export { priceOf, moneyness, optionMoneyness, intrinsicPerUnit, exerciseValue, distancePct, describeReference } from './moneyness'
export type { PriceInput, Moneyness, ExerciseTerms, DescribeOptions } from './moneyness'
