import { describeError } from '../stellar/errors'

// Pure helpers for the multi-wallet flow (no kit import, so they are unit-testable in node).

export const WALLET_STORAGE_KEY = 'strata.wallet'

// Wallets we never list: hardware wallets need extra setup. WalletConnect is added by kit.ts only
// when VITE_WALLETCONNECT_PROJECT_ID is set, so it simply is not in the kit's list otherwise.
const HIDDEN_WALLET_IDS = new Set(['ledger', 'trezor'])

export interface WalletInfo {
  id: string
  name: string
  isAvailable: boolean
  url: string
  /** Short caption under the name, e.g. "Browser extension". */
  kind: string
}

interface SupportedWalletLike {
  id: string
  name: string
  type: string
  isAvailable: boolean
  url: string
}

const KIND: Record<string, string> = {
  HOT_WALLET: 'Browser extension or web wallet',
  BRIDGE_WALLET: 'Mobile via WalletConnect',
  HW_WALLET: 'Hardware wallet',
  AIR_GAPED_WALLET: 'Air-gapped wallet',
}

export function toWalletInfos(list: SupportedWalletLike[]): WalletInfo[] {
  return list
    .filter((w) => !HIDDEN_WALLET_IDS.has(w.id) && w.type !== 'HW_WALLET')
    .map((w) => ({ id: w.id, name: w.name, isAvailable: w.isAvailable, url: w.url, kind: KIND[w.type] ?? 'Wallet' }))
}

export function splitWallets(list: WalletInfo[]): { installed: WalletInfo[]; more: WalletInfo[] } {
  return { installed: list.filter((w) => w.isAvailable), more: list.filter((w) => !w.isAvailable) }
}

export function initials(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9]/g, '')
  return letters.length <= 2 ? letters : letters[0].toUpperCase() + letters[1].toLowerCase()
}

export type WalletErrorKind = 'rejected' | 'not-installed' | 'other'

function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return ''
}

export function walletErrorKind(e: unknown): WalletErrorKind {
  const msg = rawMessage(e).toLowerCase()
  const code = e && typeof e === 'object' && 'code' in e ? Number((e as { code: unknown }).code) : NaN
  if (/not installed|not connected|not available|no wallet/.test(msg)) return 'not-installed'
  // SEP-43 code -4 is "user rejected"; wallets also word it as closed/cancelled/denied.
  if (code === -4 || /reject|denied|declin|cancel|closed|dismiss/.test(msg)) return 'rejected'
  return 'other'
}

export function describeWalletError(e: unknown, walletName = 'Your wallet'): string {
  switch (walletErrorKind(e)) {
    case 'not-installed':
      return `${walletName} is not installed or not reachable. Install it, unlock it, then try again.`
    case 'rejected':
      return `You rejected the request in ${walletName}.`
    default:
      return describeError(e)
  }
}

export function wrongNetworkMessage(walletName: string | null): string {
  return `${walletName ?? 'Your wallet'} is not on Testnet. Switch the network in the wallet.`
}

/** null = the wallet could not report its network: never block on that. */
export function isWrongNetwork(reported: string | null, expected: string): boolean {
  return reported !== null && reported !== expected
}

interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

function store(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readStoredWalletId(s: StorageLike | null = store()): string | null {
  try {
    return s?.getItem(WALLET_STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function writeStoredWalletId(id: string | null, s: StorageLike | null = store()): void {
  try {
    if (id) s?.setItem(WALLET_STORAGE_KEY, id)
    else s?.removeItem(WALLET_STORAGE_KEY)
  } catch {
    /* storage unavailable: session just won't persist */
  }
}
