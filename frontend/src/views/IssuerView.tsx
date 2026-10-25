import { IssuerConsole } from '../issuer/IssuerConsole'
import { PageHeader } from '../ui'

export interface IssuerViewProps {
  address: string | null
  sign: (xdr: string) => Promise<string>
  optionsContractId?: string
}

export function IssuerView({ address, sign, optionsContractId }: IssuerViewProps) {
  return (
    <>
      <PageHeader
        title="Issuer console"
        subtitle="Permissioned assets stay under their issuer's control. This console shows that control in action: who may hold FUND, and what happens when the issuer intervenes."
      />
      <IssuerConsole address={address} sign={sign} optionsContractId={optionsContractId} />
    </>
  )
}
