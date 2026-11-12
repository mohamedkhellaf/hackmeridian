// The console's access to Testnet, behind one interface so the hook can be driven by a fake in tests and specimens.
//
// Reads go to Horizon over `fetch` (core/stellar/horizon) and never load the Stellar SDK, except for a contract
// row, whose authorization is read from the asset contract. Writes live in ./actions.ts, which is loaded on the
// first action: a visitor who only reads the page never downloads the transaction builders.
import { parseAssetsResponse, parseIssuerAccount } from '../../core/assetfacts/assetFacts'
import type { AssetRecordFacts, IssuerFacts } from '../../core/assetfacts/assetFacts'
import { config } from '../../core/config'
import { describeError } from '../../core/stellar/errors'
import { getJson, horizonUrl } from '../../core/stellar/horizon'
import { readBalance } from '../../core/stellar/tokens'
import type { TxOptions, TxReceipt } from '../../core/tx/types'
import { UNKNOWN_READ, contractRead, parseHolderDocument, parseHoldersPage, targetKind } from './model'
import type { HolderRead, IssuerActionKind, IssuerAsset } from './model'

/** How many trustlines one read of the holder list asks Horizon for. */
export const HOLDERS_PAGE = 50

export interface HoldersPage {
  rows: { address: string; read: HolderRead }[]
  /** True when Horizon filled the page: there may be more trustlines than are shown. */
  more: boolean
}

export interface ActionRequest {
  kind: IssuerActionKind
  asset: Pick<IssuerAsset, 'contractId' | 'code' | 'decimals'>
  /** The issuer account: the source and the signer of the transaction. */
  issuer: string
  /** The account (`G...`) or contract (`C...`) acted on. */
  target: string
  /** Clawback only: exact units. */
  units?: bigint
}

export type Sign = (xdr: string) => Promise<string>

export interface IssuerNet {
  /** Flags, home domain and signer state of the issuer account. Null when the account does not exist. */
  readIssuer(issuer: string): Promise<IssuerFacts | null>
  /** Trustline counts of the asset. Null when Horizon has no record of it. */
  readRecord(code: string, issuer: string): Promise<AssetRecordFacts | null>
  /** The first page of accounts with a trustline for the asset. */
  readHolders(asset: IssuerAsset, issuer: string): Promise<HoldersPage>
  /** One account or contract. Never rejects: a failed read is a row in the `unknown` state with its reason. */
  readTarget(asset: IssuerAsset, issuer: string, target: string): Promise<HolderRead>
  /** Whether `account` is the classic issuer behind the asset contract, for an asset whose issuer was not read. */
  isIssuerOf(asset: IssuerAsset, account: string): Promise<boolean>
  /** Builds, signs and sends one action, reporting its stages. Rejects with a `TxError`. */
  send(request: ActionRequest, sign: Sign, opts?: TxOptions): Promise<TxReceipt>
}

export const liveNet: IssuerNet = {
  async readIssuer(issuer) {
    const json = await getJson(horizonUrl(`/accounts/${issuer}`))
    return json === null ? null : parseIssuerAccount(json)
  },

  async readRecord(code, issuer) {
    const query = new URLSearchParams({ asset_code: code, asset_issuer: issuer })
    return parseAssetsResponse(await getJson(horizonUrl(`/assets?${query}`)))
  },

  async readHolders(asset, issuer) {
    const query = new URLSearchParams({ asset: `${asset.code}:${issuer}`, limit: String(HOLDERS_PAGE), order: 'asc' })
    const json = await getJson(horizonUrl(`/accounts?${query}`))
    const records = (json as { _embedded?: { records?: unknown[] } } | null)?._embedded?.records
    return { rows: parseHoldersPage(json, asset, issuer), more: Array.isArray(records) && records.length >= HOLDERS_PAGE }
  },

  async readTarget(asset, issuer, target) {
    const kind = targetKind(target) ?? 'account'
    try {
      if (kind === 'account') {
        // A 404 is an answer (the account was never funded), not a failure.
        return parseHolderDocument(await getJson(horizonUrl(`/accounts/${target}`)), asset, issuer, target)
      }
      const [{ readSacAuthorized }, { server }] = await Promise.all([import('../../core/stellar/issuerNet'), import('../../core/stellar/rpc')])
      const [authorized, balance] = await Promise.all([
        readSacAuthorized(server, asset.contractId, target, config.networkPassphrase),
        // A contract that never held the asset has no balance entry; the authorization still reads.
        readBalance(asset.contractId, target).catch(() => null),
      ])
      return contractRead(authorized, balance)
    } catch (e) {
      return UNKNOWN_READ(kind, describeError(e))
    }
  },

  async isIssuerOf(asset, account) {
    const { sacContractId } = await import('../../core/stellar/issuerTx')
    return sacContractId(asset.code, account, config.networkPassphrase) === asset.contractId
  },

  async send(request, sign, opts) {
    const { sendIssuerAction } = await import('./actions')
    return sendIssuerAction(request, sign, opts)
  },
}
