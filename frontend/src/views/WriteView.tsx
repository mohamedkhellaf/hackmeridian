import { WriteOfferForm } from '../maker/WriteOfferForm'
import type { OptionsClient } from '../options/client'
import type { NewOffer, SupportedAssets } from '../options/types'
import { Banner, PageHeader } from '../ui'

export interface WriteViewProps {
  assets: SupportedAssets | null
  client: OptionsClient
  me: string | null
  busy: boolean
  onSubmit: (offer: NewOffer) => Promise<boolean>
}

export function WriteView({ assets, client, me, busy, onSubmit }: WriteViewProps) {
  return (
    <div className="wr-stack">
      <PageHeader title="Write an option" subtitle="Lock collateral, publish an offer, and earn the premium when a buyer takes it." />
      {!me && <Banner tone="info">Connect Freighter to write an option. You can fill in the form first.</Banner>}
      {assets && <WriteOfferForm assets={assets} client={client} me={me} disabled={!me || busy} onSubmit={onSubmit} />}
    </div>
  )
}
