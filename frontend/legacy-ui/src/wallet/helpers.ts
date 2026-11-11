import { describeError } from '../stellar/errors'

// Pure helpers for the multi-wallet flow (no kit import, so they are unit-testable in node).

export const WALLET_STORAGE_KEY = 'strata.wallet'

// Wallets we never list: hardware wallets need extra setup. WalletConnect is added by kit.ts only
// when VITE_WALLETCONNECT_PROJECT_ID is set, so it simply is not in the kit's list otherwise.
const HIDDEN_WALLET_IDS = new Set(['ledger', 'trezor'])

/**
 * How a wallet is reachable right now:
 * - installed: a browser extension that responded (shown as "Detected")
 * - web: works without an extension (web app, popup or QR); never claims to be detected
 * - missing: an extension that is not present
 */
export type WalletAvailability = 'installed' | 'web' | 'missing'

export interface WalletInfo {
  id: string
  name: string
  availability: WalletAvailability
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

/** Browser-only facts the kit does not expose. */
export interface WalletProbe {
  /** The xBull extension injected window.xBullSDK. */
  xbullExtension: boolean
}

// The kit's isAvailable() is unconditionally true for these (no extension needed): Albedo is a pure
// web wallet, and the xBull module always returns true because xBullWalletConnect falls back to a
// popup at wallet.xbull.app when window.xBullSDK (the extension) is absent.
const ALWAYS_WEB_IDS = new Set(['albedo'])
const XBULL_ID = 'xbull'

const KIND: Record<string, string> = {
  HOT_WALLET: 'Browser extension or web wallet',
  BRIDGE_WALLET: 'Mobile via WalletConnect',
  HW_WALLET: 'Hardware wallet',
  AIR_GAPED_WALLET: 'Air-gapped wallet',
}

export function walletAvailability(w: SupportedWalletLike, probe: WalletProbe): WalletAvailability {
  if (ALWAYS_WEB_IDS.has(w.id) || w.type === 'BRIDGE_WALLET') return 'web'
  if (w.id === XBULL_ID) return probe.xbullExtension ? 'installed' : 'web'
  return w.isAvailable ? 'installed' : 'missing'
}

export function toWalletInfos(list: SupportedWalletLike[], probe: WalletProbe = { xbullExtension: false }): WalletInfo[] {
  return list
    .filter((w) => !HIDDEN_WALLET_IDS.has(w.id) && w.type !== 'HW_WALLET')
    .map((w) => ({
      id: w.id,
      name: w.name,
      availability: walletAvailability(w, probe),
      url: w.url,
      kind: KIND[w.type] ?? 'Wallet',
    }))
}

/** Installed extensions first; everything else (web wallets and missing extensions) under "more". */
export function splitWallets(list: WalletInfo[]): { installed: WalletInfo[]; more: WalletInfo[] } {
  return {
    installed: list.filter((w) => w.availability === 'installed'),
    more: list.filter((w) => w.availability !== 'installed'),
  }
}

/** Isolated browser probing for extensions the kit cannot report on. Safe outside a browser. */
export function probeWallets(): WalletProbe {
  try {
    return { xbullExtension: typeof window !== 'undefined' && !!(window as unknown as { xBullSDK?: unknown }).xBullSDK }
  } catch {
    return { xbullExtension: false }
  }
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
