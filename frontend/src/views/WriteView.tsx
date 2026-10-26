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
      <PageHeader title="Write" />
      {!me && <Banner tone="neutral">Connect a wallet to write an offer.</Banner>}
      {assets && <WriteOfferForm assets={assets} client={client} me={me} disabled={!me || busy} onSubmit={onSubmit} />}
    </div>
  )
}
