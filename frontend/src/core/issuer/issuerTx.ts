import { Account, Asset, BASE_FEE, Contract, Operation, StrKey, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk'
import type { Transaction, xdr } from '@stellar/stellar-sdk'

// Pure transaction builders for the issuer console. No network access here: callers pass in
// a loaded source Account and the network passphrase, so everything is unit-testable.

export const STROOPS_DECIMALS = 7 // classic assets and their SACs always use 7 decimals
const TIMEOUT = 180

export const isAccountId = (s: string) => StrKey.isValidEd25519PublicKey(s)
export const isContractId = (s: string) => StrKey.isValidContract(s)
export const isValidAssetCode = (s: string) => /^[A-Za-z0-9]{1,12}$/.test(s)

export function sacContractId(code: string, issuer: string, networkPassphrase: string): string {
  return new Asset(code, issuer).contractId(networkPassphrase)
}

function base(source: Account, networkPassphrase: string) {
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase })
}

// Classic: authorize (true) or revoke (false) a holder's trustline.
// Revoking needs AUTH_REVOCABLE on the issuer; authorizing needs the trustline to exist.
export function buildSetAuthorizedTx(
  source: Account,
  asset: Asset,
  trustor: string,
  authorized: boolean,
  networkPassphrase: string,
): Transaction {
  return base(source, networkPassphrase)
    .addOperation(Operation.setTrustLineFlags({ trustor, asset, flags: { authorized } }))
    .setTimeout(TIMEOUT)
    .build()
}

// Classic clawback. `amount` is a decimal string with up to 7 fraction digits.
export function buildClawbackTx(
  source: Account,
  asset: Asset,
  from: string,
  amount: string,
  networkPassphrase: string,
): Transaction {
  return base(source, networkPassphrase)
    .addOperation(Operation.clawback({ asset, from, amount }))
    .setTimeout(TIMEOUT)
    .build()
}

const addr = (a: string) => nativeToScVal(a, { type: 'address' })

// SAC set_authorized(id, authorize). Must be invoked by the SAC admin (the issuer).
export function sacSetAuthorizedOp(sacId: string, id: string, authorize: boolean): xdr.Operation {
  return new Contract(sacId).call('set_authorized', addr(id), nativeToScVal(authorize, { type: 'bool' }))
}

// SAC clawback(from, amount). `amount` is an i128 in stroops.
export function sacClawbackOp(sacId: string, from: string, amount: bigint): xdr.Operation {
  return new Contract(sacId).call('clawback', addr(from), nativeToScVal(amount, { type: 'i128' }))
}

// Contract-call tx; run it through rpc.Server.prepareTransaction before signing.
export function buildSacTx(source: Account, op: xdr.Operation, networkPassphrase: string): Transaction {
  return base(source, networkPassphrase).addOperation(op).setTimeout(TIMEOUT).build()
}

// Read-only simulation source: any valid account works, nothing is signed or submitted.
export function buildSacAuthorizedQuery(sacId: string, id: string, networkPassphrase: string): Transaction {
  const dummy = new Account(StrKey.encodeEd25519PublicKey(new Uint8Array(32)), '0')
  return buildSacTx(dummy, new Contract(sacId).call('authorized', addr(id)), networkPassphrase)
}

// ---- Horizon account state parsing (pure) ----

export type TrustStatus = 'none' | 'authorized' | 'maintain-liabilities' | 'not-authorized'

interface BalanceLike {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance?: string
  is_authorized?: boolean
  is_authorized_to_maintain_liabilities?: boolean
}

export function trustStatus(balances: BalanceLike[], code: string, issuer: string): { status: TrustStatus; balance?: string } {
  const line = balances.find((b) => b.asset_code === code && b.asset_issuer === issuer)
  if (!line) return { status: 'none' }
  if (line.is_authorized) return { status: 'authorized', balance: line.balance }
  if (line.is_authorized_to_maintain_liabilities) return { status: 'maintain-liabilities', balance: line.balance }
  return { status: 'not-authorized', balance: line.balance }
}

export interface IssuerFlags {
  auth_required?: boolean
  auth_revocable?: boolean
  auth_clawback_enabled?: boolean
}

export function missingFlags(flags: IssuerFlags): string[] {
  const out: string[] = []
  if (!flags.auth_required) out.push('AUTH_REQUIRED')
  if (!flags.auth_revocable) out.push('AUTH_REVOCABLE')
  if (!flags.auth_clawback_enabled) out.push('AUTH_CLAWBACK_ENABLED')
  return out
}
