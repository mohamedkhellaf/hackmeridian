// Pure helpers of the connect dialog and the wallet menu (no React), unit-tested in wallet.test.ts.
import { formatExact } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'
import type { TokenBalance } from '../../core/stellar/tokens'
import { splitWallets } from '../../wallet'
import type { WalletInfo } from '../../wallet'
import { BALANCE_REASON } from './copy'

// ---- Connect dialog ----------------------------------------------------------------------------------------

export type WalletRowStatus = 'Waiting' | 'Detected' | 'Web' | 'Install'

/** The word at the end of a wallet row: what choosing it does, or that it is being asked now. */
export function walletStatus(wallet: WalletInfo, busyId: string | null): WalletRowStatus {
  if (wallet.availability === 'missing') return 'Install'
  if (busyId === wallet.id) return 'Waiting'
  return wallet.availability === 'installed' ? 'Detected' : 'Web'
}

/** The order of the list: installed extensions first, then web wallets and the ones still to install. */
export function walletRows(wallets: WalletInfo[]): WalletInfo[] {
  const { installed, more } = splitWallets(wallets)
  return [...installed, ...more]
}

// ---- Wallet menu -------------------------------------------------------------------------------------------

export interface BalanceRow {
  token: TokenInfo
  /** The exact amount with every digit, or null when there is no figure. */
  amount: string | null
  /** Why there is no figure, or why the figure cannot move. */
  reason: string | null
}

/** One row per token of the contract, in the order given (the quote token first). */
export function balanceRows(tokens: readonly TokenInfo[], balances: readonly TokenBalance[] | undefined): BalanceRow[] {
  const byId = new Map((balances ?? []).map((b) => [b.contractId, b]))
  return tokens.map((token) => {
    const b = byId.get(token.contractId)
    if (!b) return { token, amount: null, reason: BALANCE_REASON.error }
    if (b.balance !== null) {
      // A frozen trustline still holds a balance: show the figure and say why it cannot move.
      return { token, amount: formatExact(b.balance, token.decimals), reason: b.status === 'ok' ? null : BALANCE_REASON[b.status] }
    }
    return { token, amount: null, reason: b.status === 'ok' ? BALANCE_REASON.error : BALANCE_REASON[b.status] }
  })
}

/** The balances as one sentence, for the accessible name of the group: `USDx 2,500.00, FUND 120.00`. */
export function balancesSentence(rows: readonly BalanceRow[]): string {
  return rows.map((row) => `${row.token.code} ${[row.amount, row.reason].filter((part) => part !== null).join(', ')}`).join(', ')
}

/** What the Activity link says about transactions that are not settled yet. Null when there is nothing to say. */
export function activityNote(inFlight: number, unknown: number): string | null {
  if (unknown > 0) return `${unknown} to check`
  if (inFlight > 0) return `${inFlight} in progress`
  return null
}

/** Copies text to the clipboard. Resolves false when the browser refuses (insecure context, denied permission). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
