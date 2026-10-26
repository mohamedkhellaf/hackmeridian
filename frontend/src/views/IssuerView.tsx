import { useState } from 'react'
import { IssuerConsole } from '../issuer/IssuerConsole'
import type { TokenInfo } from '../options/types'
import { Banner, PageHeader } from '../ui'

// Fallback when the app has no token list yet: the regulated underlyings issued by the Testnet issuer
// account (scripts/setup-testnet/02-assets.sh). The issuer is the connected account, so the code names the asset.
const FALLBACK_ASSETS: IssuerAsset[] = [{ code: 'RWA' }, { code: 'BOND' }, { code: 'EQTY' }]

export interface IssuerAsset {
  code: string
  /** SAC contract id, when the app knows it (the options contract allowlist). */
  contractId?: string
}

export interface IssuerViewProps {
  address: string | null
  sign: (xdr: string) => Promise<string>
  optionsContractId?: string
  /** Underlyings the rest of the app trades (contract allowlist, or the mock's list). */
  tokens?: TokenInfo[]
  /** No options contract configured: nothing here can be read or signed. */
  mock?: boolean
}

const keyOf = (a: IssuerAsset) => a.contractId ?? a.code

export function IssuerView({ address, sign, optionsContractId, tokens, mock = false }: IssuerViewProps) {
  const assets: IssuerAsset[] = tokens && tokens.length > 0 ? tokens.map((t) => ({ code: t.code, contractId: t.contractId })) : FALLBACK_ASSETS
  const [picked, setPicked] = useState<string | null>(null)
  // The token list can arrive after the first render; fall back to the first asset until a pick matches.
  const asset = assets.find((a) => keyOf(a) === picked) ?? assets[0]
  return (
    <>
      <PageHeader
        title="Issuer"
        actions={
          <select className="is-select" value={keyOf(asset)} onChange={(e) => setPicked(e.target.value)} aria-label="Asset">
            {assets.map((a) => (
              <option key={keyOf(a)} value={keyOf(a)}>
                {a.code}
              </option>
            ))}
          </select>
        }
      />
      {mock && <Banner className="is-top-banner">Issuer actions need a Testnet contract.</Banner>}
      <IssuerConsole code={asset.code} contractId={mock ? undefined : asset.contractId} mock={mock} address={address} sign={sign} optionsContractId={optionsContractId} />
    </>
  )
}
