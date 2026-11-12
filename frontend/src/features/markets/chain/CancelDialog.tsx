// Cancelling the wallet's own offer or request from the book: one short confirmation that says what comes back,
// then the transaction's stages in the same dialog. The outcome is also recorded in Activity by the data layer.
import { explorerTx } from '../../../core/explorer'
import { formatExact, formatUnits, formatUtc } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import { seriesRefOf } from '../../../core/market/selection'
import { requiredCollateral } from '../../../core/options/types'
import { stoppedStage } from '../../../core/tx/machine'
import { describeTx, useCancelBid, useCancelOffer, useOptionsClient, useUnsettledTx } from '../../../data'
import { Amount, Button, Dialog, KeyValue, KeyValueItem, TxLink, TxStepper, UnsettledNotice } from '../../../ui'
import { COPY } from './copy'
import { strikeText } from './model'
import styles from './CancelDialog.module.css'

export interface CancelDialogProps {
  /** The wallet's own offer or bid, or null while closed. */
  row: BookRow | null
  onClose: () => void
}

export function CancelDialog({ row, onClose }: CancelDialogProps) {
  return row ? <CancelBody key={row.key} row={row} onClose={onClose} /> : null
}

function CancelBody({ row, onClose }: { row: BookRow; onClose: () => void }) {
  const { isMock } = useOptionsClient()
  const cancelOffer = useCancelOffer()
  const cancelBid = useCancelBid()
  const isBid = row.source === 'bid'
  const tx = isBid ? cancelBid : cancelOffer
  const { state } = tx
  const idle = state.phase === 'idle'
  // An earlier transaction of this wallet with an unknown outcome: this one waits for it.
  const unsettled = useUnsettledTx()
  const ref = seriesRefOf(row)
  const back = isBid ? { amount: row.totalPremium, token: row.quote } : requiredCollateral(row)

  const run = () => {
    if (row.bid) void cancelBid.run(row.bid)
    else if (row.offer) void cancelOffer.run(row.offer)
  }
  const again = () => {
    tx.reset()
    run()
  }

  const summary = describeTx(state)
  const canRetry = state.phase === 'failed' || state.phase === 'declined' || state.phase === 'expired'

  const footer = idle ? (
    <>
      <Button onClick={onClose}>{isBid ? COPY.keepBid : COPY.keepOffer}</Button>
      <Button variant="primary" onClick={run} disabled={unsettled !== null} disabledReason={unsettled?.reason}>
        {isBid ? COPY.cancelBidAction : COPY.cancelOfferAction}
      </Button>
    </>
  ) : (
    <>
      {tx.canCheckAgain ? <Button onClick={() => void tx.checkAgain()}>{COPY.checkAgain}</Button> : null}
      {canRetry ? <Button onClick={again}>{COPY.tryAgain}</Button> : null}
      <Button variant={state.phase === 'confirmed' ? 'primary' : 'secondary'} onClick={onClose}>
        {state.phase === 'confirmed' ? COPY.done : COPY.close}
      </Button>
    </>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="sm"
      title={isBid ? COPY.cancelBidTitle : COPY.cancelOfferTitle}
      description={state.phase === 'confirmed' ? (isBid ? COPY.cancelBidDone : COPY.cancelOfferDone) : isBid ? COPY.cancelBidBody : COPY.cancelOfferBody}
      footer={footer}
    >
      <KeyValue variant="ruled">
        <KeyValueItem label="Series">
          {ref ? `${row.underlying.code} ${strikeText(ref.strikePerUnit, row.quote.decimals)} ${row.kind}` : `${row.underlying.code} ${row.kind}`}
        </KeyValueItem>
        <KeyValueItem label="Quantity">
          <Amount value={formatUnits(row.underlyingQty, row.underlying.decimals)} exact={formatExact(row.underlyingQty, row.underlying.decimals)} unit={row.underlying.code} />
        </KeyValueItem>
        <KeyValueItem label="Deadline">{formatUtc(row.expiry)}</KeyValueItem>
        <KeyValueItem label={isBid ? COPY.premiumRefunded : COPY.collateralReturned} marked>
          <Amount value={formatUnits(back.amount, back.token.decimals)} exact={formatExact(back.amount, back.token.decimals)} unit={back.token.code} />
        </KeyValueItem>
      </KeyValue>
      {idle && unsettled ? <UnsettledNotice onCheck={unsettled.check}>{unsettled.reason}</UnsettledNotice> : null}
      {state.phase !== 'idle' ? (
        <div className={styles.progress}>
          <TxStepper state={state.phase} failedAt={stoppedStage(state)} hash={state.hash ? <TxLink hash={state.hash} explorerUrl={isMock ? undefined : explorerTx(state.hash)} copy /> : undefined}>
            {summary?.detail}
          </TxStepper>
        </div>
      ) : null}
    </Dialog>
  )
}
