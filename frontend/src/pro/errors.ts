// Strata Pro contract errors 201..226 (docs/pro-v0-brief-dev2.md, packages/risk fixtures `errors`) in plain words.

export interface ProErrorInfo {
  code: number
  name: string
  message: string
}

const list: [number, string, string][] = [
  [201, 'InvalidArgs', 'Some inputs are not valid. Check the amounts and try again.'],
  [202, 'NotFound', 'That item does not exist.'],
  [203, 'Unauthorized', 'Only the holder of this position can do this.'],
  [204, 'WrongState', 'This was already done, or it is not in the right state for this action.'],
  [205, 'SeriesExpired', 'This series has expired. Trading, early exercise and withdrawals that depend on it stop; settle it instead.'],
  [206, 'NotExpired', 'This series has not expired yet.'],
  [207, 'StaleSnapshot', 'The latest price snapshot is too old. Early exercise needs one that is at most 120 seconds old; wait for the publisher to post a new one.'],
  [208, 'BadSnapshot', 'The publisher snapshot failed the contract consistency checks and was rejected.'],
  [209, 'InsufficientMargin', 'Not enough margin: after this action the account would be below its initial margin (IM).'],
  [210, 'OiCapExceeded', 'This would exceed the open-interest cap for the series or the writer.'],
  [211, 'NotLiquidable', 'This account cannot be taken over: it is not below maintenance margin, or it has no live positions.'],
  [212, 'VaultCapacity', 'The vault value is too low to accept new LP deposits right now.'],
  [213, 'NoSettlementPrice', 'The settlement price for this series is not published yet.'],
  [214, 'SettlementWindowClosed', 'The settlement window for this series has closed.'],
  [215, 'WithdrawLocked', 'LP capital cannot be withdrawn in this version.'],
  [216, 'TooManySeries', 'Too many live series. Wait for one to close.'],
  [217, 'SelfTrade', 'You cannot buy your own offer.'],
  [218, 'InsolventTakeover', 'A private takeover is refused when the takeover price is more than the writer cash can pay. The vault can take it over instead.'],
  [219, 'Overflow', 'A number in this operation is too large.'],
  [220, 'TooManyPositions', 'This account already holds the maximum number of books.'],
  [221, 'RoleNotAllowed', 'The admin and publisher accounts cannot trade, take over or provide LP capital.'],
  [222, 'PremiumBelowMark', 'The premium is below quantity times the latest mark, so the order is refused.'],
  [223, 'OutOfTheMoney', 'Out of the money at the latest snapshot (spot is not above the strike): exercising now would pay nothing.'],
  [224, 'LiquidateFirst', 'The writer is below maintenance margin and must be taken over first. Early exercise is refused until then.'],
  [225, 'SettlementPending', 'The writer has expired positions still waiting for a settlement price. Early exercise and LP deposits wait until it is published.'],
  [226, 'NoEarlyExercise', 'This position is owned by the vault and settles at expiry.'],
]

export const PRO_ERRORS: Record<number, ProErrorInfo> = Object.fromEntries(
  list.map(([code, name, message]) => [code, { code, name, message }]),
)

export const PRO_ERROR_CODES = list.map(([code]) => code)

export function proErrorName(code: number): string {
  return PRO_ERRORS[code]?.name ?? `Error${code}`
}

/** Plain message for a contract error code; unknown codes get a generic line that still shows the number. */
export function proErrorMessage(code: number): string {
  return PRO_ERRORS[code]?.message ?? `The contract refused this action (error ${code}).`
}

/** Extracts a Pro error code from a Soroban failure text such as "Error(Contract, #226)". */
export function parseProErrorCode(text: string): number | null {
  const m = /#(\d{3})\b/.exec(text)
  if (!m) return null
  const code = Number(m[1])
  return PRO_ERRORS[code] ? code : null
}
