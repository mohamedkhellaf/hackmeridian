import type { IssuerFlags, TrustStatus } from './issuerTx'

// Pure view helpers for the issuer console (no network, no React).

export type AuthState = 'authorized' | 'partial' | 'unauthorized' | 'no-trustline' | 'unknown'

export function authStateFromTrust(s: TrustStatus): AuthState {
  switch (s) {
    case 'authorized':
      return 'authorized'
    case 'maintain-liabilities':
      return 'partial'
    case 'not-authorized':
      return 'unauthorized'
    default:
      return 'no-trustline'
  }
}

export function authStateFromSac(authorized: boolean): AuthState {
  return authorized ? 'authorized' : 'unauthorized'
}

// Only the relevant action is enabled. Unknown state (still loading, read failed) leaves both
// available so the issuer is never locked out. A missing trustline can be neither authorized nor frozen.
export function actionsFor(state: AuthState): { authorize: boolean; freeze: boolean } {
  switch (state) {
    case 'authorized':
      return { authorize: false, freeze: true }
    case 'partial':
      return { authorize: true, freeze: true }
    case 'unauthorized':
      return { authorize: true, freeze: false }
    case 'no-trustline':
      return { authorize: false, freeze: false }
    default:
      return { authorize: true, freeze: true }
  }
}

export function stateTone(state: AuthState): 'ok' | 'warn' | 'danger' | 'neutral' {
  switch (state) {
    case 'authorized':
      return 'ok'
    case 'partial':
    case 'no-trustline':
      return 'warn'
    case 'unauthorized':
      return 'danger'
    default:
      return 'neutral'
  }
}

export interface FlagItem {
  label: string
  ok: boolean
}

export function flagItems(flags: IssuerFlags): FlagItem[] {
  return [
    { label: 'Authorization required', ok: !!flags.auth_required },
    { label: 'Authorization revocable', ok: !!flags.auth_revocable },
    { label: 'Clawback enabled', ok: !!flags.auth_clawback_enabled },
  ]
}

// Horizon answers 404 for an account that does not exist (never funded, so never an issuer).
export function isNotFound(message: string): boolean {
  return /not found|404/i.test(message)
}

export function targetKindLabel(kind: 'account' | 'contract' | null): string | null {
  return kind === 'account' ? 'Account' : kind === 'contract' ? 'Contract' : null
}
