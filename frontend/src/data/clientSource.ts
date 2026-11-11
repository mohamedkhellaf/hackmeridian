// A lazily created, session-long client. Framework-free so it can be tested without a DOM.
//
// The client is created on the first `get()` (a dynamic import of the mock market or of the Soroban client and
// the Stellar SDK), so the shell paints without it. A failed load is not cached: the next `get()` tries again.

export interface ClientSource<C> {
  /** Resolves with the client. Safe to call from every query function: all callers share one load. */
  get(): Promise<C>
  /** The client once loaded, else null. */
  peek(): C | null
  /** The message of the last failed load, cleared by the next attempt. */
  error(): string | null
  subscribe(listener: () => void): () => void
}

export function createClientSource<C>(create: () => Promise<C>): ClientSource<C> {
  let pending: Promise<C> | null = null
  let client: C | null = null
  let error: string | null = null
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const l of listeners) l()
  }
  return {
    get() {
      if (pending) return pending
      const attempt = (pending = Promise.resolve()
        .then(create)
        .then(
          (c) => {
            client = c
            error = null
            notify()
            return c
          },
          (e: unknown) => {
            // Forget the failed load so a retry (the query's own, or the user's) starts a new one.
            if (pending === attempt) pending = null
            error = e instanceof Error ? e.message : String(e)
            notify()
            throw e
          },
        ))
      if (error !== null) {
        error = null
        notify()
      }
      return attempt
    },
    peek: () => client,
    error: () => error,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** What a client needs from a wallet (`WalletSigner` of core/stellar/signer, with both signing functions). */
export interface SignerLike {
  address: string | null
  sign: (xdr: string) => Promise<string>
  signAuthEntry: (entryXdr: string) => Promise<string>
}

/**
 * One long-lived signer over a wallet that changes. A client keeps the signer; `set` swaps the wallet behind it.
 * `address` is read at call time, so a write always signs as the wallet that is connected when it is made.
 */
export function bindSigner(initial: SignerLike): { signer: SignerLike; set: (wallet: SignerLike) => void } {
  let current = initial
  const signer: SignerLike = {
    get address() {
      return current.address
    },
    sign: (xdr) => current.sign(xdr),
    signAuthEntry: (entry) => current.signAuthEntry(entry),
  }
  return {
    signer,
    set(wallet) {
      current = wallet
    },
  }
}
