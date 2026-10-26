import { useState } from 'react'
import { WriteOfferForm } from '../maker/WriteOfferForm'
import type { OptionsClient } from '../options/client'
import { formatDisplay, shortAddress } from '../options/format'
import type { NewOffer, OptionKind, SupportedAssets } from '../options/types'
import { FillDialog } from '../requests/RequestsMarket'
import { RequestDialog } from '../requests/RequestDialog'
import type { NewBid } from '../requests/types'
import type { TxOutcome } from '../state/runTx'
import { Button, Dialog, Mono, Segmented, Tag } from '../ui'
import { PRO_ENABLED } from '../layout/routes'
import type { BookRow } from './book'
import { MARGIN_TRADE_HREF } from './marginAck'
import { CollateralChoiceCards, MarginWarningDialog } from './MarginWarning'
import type { CollateralChoice } from './MarginWarning'
import { formatCountdown } from './series'

export type Prefill = Partial<{ kind: OptionKind; underlyingId: string; qty: string; strike: string; premium: string; expiryMs: number }>

const amt = (units: bigint, t: { decimals: number; code: string }) => `${formatDisplay(units, t.decimals)} ${t.code}`

/**
 * Buy or Sell on one series. Each tab reuses an existing flow: take the best offer (buy / buy_resale),
 * post a bid (create_bid), fill the best bid (fill_bid) or post an offer (create_offer).
 */
export function TradeDialog({
  mode,
  series,
  best,
  bidsEnabled,
  initial,
  assets,
  client,
  me,
  busy,
  onTake,
  onCreateBid,
  onFillBid,
  onWriteOffer,
  onOutcomeShown,
  onClose,
}: {
  mode: 'buy' | 'sell'
  /** "FUND 10.00 put" */
  series: string
  /** Best row on the opposite side that is not the wallet's own (offer for buy, bid for sell). */
  best: BookRow | undefined
  bidsEnabled: boolean
  initial: Prefill
  assets: SupportedAssets
  client: OptionsClient
  me: string
  busy: boolean
  /** Opens the existing confirmation flow for this offer row. */
  onTake: (row: BookRow) => void
  onCreateBid: (bid: NewBid) => Promise<TxOutcome>
  onFillBid: (row: BookRow) => Promise<TxOutcome>
  onWriteOffer: (offer: NewOffer) => Promise<boolean>
  onOutcomeShown?: () => void
  onClose: () => void
}) {
  const takeLabel = mode === 'buy' ? 'Take best offer' : 'Fill best bid'
  const postLabel = mode === 'buy' ? 'Post a bid at my price' : 'Post an offer at my price'
  const tabs = [
    ...(mode === 'buy' || bidsEnabled ? [{ value: 'take' as const, label: takeLabel }] : []),
    ...(mode === 'sell' || bidsEnabled ? [{ value: 'post' as const, label: postLabel }] : []),
  ]
  const [tab, setTab] = useState<'take' | 'post'>(tabs[0].value)
  // Sell / post only, and only when the margin section is built in. Full collateral is the default.
  const [collateral, setCollateral] = useState<CollateralChoice>('full')
  const title = `${mode === 'buy' ? 'Buy' : 'Sell'} ${series}`
  const header = tabs.length > 1 ? <Segmented label={`${mode === 'buy' ? 'Buy' : 'Sell'} mode`} options={tabs} value={tab} onChange={setTab} /> : null

  if (mode === 'buy' && tab === 'post')
    return <RequestDialog title={title} header={header} initial={initial} assets={assets} client={client} me={me} busy={busy} onSubmit={onCreateBid} onClose={onClose} />

  if (mode === 'sell' && tab === 'take' && best?.bid)
    return (
      <FillDialog
        key={best.key}
        title={title}
        header={header}
        bid={best.bid}
        client={client}
        me={me}
        busy={busy}
        onConfirm={() => onFillBid(best)}
        onClose={onClose}
        onOutcomeShown={onOutcomeShown}
      />
    )

  if (mode === 'sell' && tab === 'post' && PRO_ENABLED && collateral === 'margin')
    return (
      <MarginWarningDialog
        onCancel={() => setCollateral('full')}
        onContinue={() => {
          onClose()
          window.location.hash = MARGIN_TRADE_HREF
        }}
      />
    )

  if (mode === 'sell' && tab === 'post')
    return (
      <Dialog title={title} width={560} onClose={onClose}>
        {header}
        {PRO_ENABLED && <CollateralChoiceCards value={collateral} onChange={setCollateral} />}
        <WriteOfferForm
          plain
          initial={initial}
          assets={assets}
          client={client}
          me={me}
          disabled={busy}
          onSubmit={async (o) => {
            const ok = await onWriteOffer(o)
            if (ok) onClose()
            return ok
          }}
        />
      </Dialog>
    )

  // Take best offer (buy), or no bid to fill (sell).
  return (
    <Dialog
      title={title}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {mode === 'buy' && best && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                onClose()
                onTake(best)
              }}
            >
              {best.source === 'resale' ? 'Review resale purchase' : 'Review purchase'}
            </Button>
          )}
        </>
      }
    >
      {header}
      {!best ? (
        <p className="mk-empty">{mode === 'buy' ? 'No offers yet.' : 'No bids yet.'}</p>
      ) : (
        <dl className="ui-kv" data-testid="best-offer">
          <div>
            <dt>Best offer</dt>
            <dd>
              {best.source === 'resale' ? <Tag tone="neutral">resale</Tag> : <Tag tone="neutral">maker</Tag>} <Mono>{shortAddress(best.counterparty)}</Mono>
            </dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{amt(best.underlyingQty, best.underlying)}</dd>
          </div>
          <div>
            <dt>Premium</dt>
            <dd className="num">
              {amt(best.totalPremium, best.quote)}            </dd>
          </div>
          <div>
            <dt>Expiry</dt>
            <dd>{formatCountdown(best.expiry)}</dd>
          </div>
        </dl>
      )}
    </Dialog>
  )
}
