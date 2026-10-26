import { IssuerConsole } from '../issuer/IssuerConsole'
import { PageHero } from '../ui'

export interface IssuerViewProps {
  address: string | null
  sign: (xdr: string) => Promise<string>
  optionsContractId?: string
}

export function IssuerView({ address, sign, optionsContractId }: IssuerViewProps) {
  return (
    <>
      <PageHero
        eyebrow="Issuer console · FUND"
        title="The asset stays under its issuer's control."
        lede="Permissioned assets stay under their issuer's control. This console shows that control in action: who may hold FUND, and what happens to open options when the issuer intervenes. Strata does not hide this; it shows it."
        sediment={{ seed: 'issuer', captionLabel: 'Issuer powers', caption: 'Authorize, freeze, clawback' }}
      />
      <IssuerConsole address={address} sign={sign} optionsContractId={optionsContractId} />
    </>
  )
}
