// Pure view helpers for the issuer console (no network, no React).

export type AuthState = 'authorized' | 'partial' | 'unauthorized' | 'no-trustline' | 'unknown'

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
