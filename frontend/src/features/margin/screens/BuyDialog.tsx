import { useMemo, useState } from 'react'
import { formatCountdown, formatNumber, formatUtc, secondsUntil } from '../../../core/format'
import type { OfferView } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { Button, Checkbox, Dialog, KeyValue, KeyValueItem, Slider } from '../../../ui'
import { Waterfall } from '../../../viz'
import { BUY_CONSENT, COVERAGE_CAPTION, PAYOUT_ORDER } from '../copy'
import { coverageAt, coverageInputs, coveredUpTo, priceRange, splitSentence } from '../../../core/pro/coverage'
import { QUOTE, lots, perLot, usdx } from '../model/money'
import { UNDERLYING, contractName } from '../model/names'
import { premiumPerLot } from '../model/write'
import { Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import css from './BuyDialog.module.css'

const money = (n: number) => formatNumber(n, { dp: 2 })

/**
 * Buying a call written on partial margin. The terms, then who pays the holder and in which order, drawn at
 * a settlement price the buyer assumes, then the sentence the buyer must tick before the action is available.
 */
export function BuyDialog({ offer, onClose }: { offer: OfferView | null; onClose: () => void }) {
  // The last offer stays mounted while the dialog closes, so focus and the exit transition have a dialog to leave.
  const [last, setLast] = useState<OfferView | null>(offer)
  if (offer && offer !== last) setLast(offer)
  const shown = offer ?? last
  if (!shown) return null
  return <BuyFlow key={shown.id} offer={shown} open={offer !== null} onClose={onClose} />
}

function PayoutOrder() {
  return (
    <ol className={css.order}>
      {PAYOUT_ORDER.map((line) => (
        <li key={line.source}>
          <span className={css.source}>{line.source}.</span> {line.rule}
        </li>
      ))}
    </ol>
  )
}

function BuyFlow({ offer, open, onClose }: { offer: OfferView; open: boolean; onClose: () => void }) {
  const { client, model, me, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const [understood, setUnderstood] = useState(false)
  const [assumed, setAssumed] = useState<number | null>(null)

  const series = model.series.find((s) => s.id === offer.seriesId)
  const inputs = useMemo(() => (series ? coverageInputs(model, offer, series) : null), [model, offer, series])
  const range = useMemo(() => (inputs ? priceRange(inputs) : null), [inputs])

  const left = series ? secondsUntil(series.expiry, model.now) : 0
  const each = premiumPerLot(offer.premium, offer.qty)
  const price = range ? Math.min(range.max, Math.max(range.min, assumed ?? range.start)) : 0
  const split = inputs ? coverageAt(inputs, price) : null
  const cover = inputs ? coveredUpTo(inputs) : null
  const own = offer.writer === me

  const buy = () => {
    onClose()
    void act({ label: 'Buy', done: 'Bought' }, (opts) => client.buy(me, offer.id, opts), (id) => (id === null ? [] : [{ label: 'Position', value: `No. ${id}` }]))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`Buy ${UNDERLYING} call`}
      description={series ? `${contractName(series)}, ${lots(offer.qty)} lots, expires ${formatUtc(series.expiry)}.` : undefined}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {canAct ? (
            <Button
              variant="primary"
              disabled={!understood || own || busy}
              disabledReason={own ? 'You cannot buy your own offer.' : !understood ? 'Tick the box above first.' : undefined}
              onClick={buy}
            >
              Buy for {usdx(offer.premium)} {QUOTE}
            </Button>
          ) : (
            <Button variant="primary" onClick={connect}>
              Connect wallet
            </Button>
          )}
        </>
      }
    >
      <div className={css.columns}>
        <section className={css.terms} aria-label="Terms">
          <KeyValue>
            <KeyValueItem label="Premium, paid now" hint={each !== null ? `${perLot(each)} ${QUOTE} per lot, to the writer.` : undefined} marked>
              <Usdx v={offer.premium} unit figure="serif" />
            </KeyValueItem>
            <KeyValueItem label="Contract" hint={`Series ${offer.seriesId}, offer ${offer.id}`}>
              {contractName(series)}
            </KeyValueItem>
            <KeyValueItem label="Quantity">{lots(offer.qty)} lots</KeyValueItem>
            <KeyValueItem label="Expiry" hint={series && left > 0 ? `${formatCountdown(left)} left` : undefined}>
              {series ? formatUtc(series.expiry) : 'Not available'}
            </KeyValueItem>
            <KeyValueItem label="Writer">
              <Who id={offer.writer} me={me} length="medium" />
            </KeyValueItem>
            <KeyValueItem label="Collateral" hint="The writer margin is checked when you buy.">
              Partial
            </KeyValueItem>
            <KeyValueItem label="Settlement" hint="At expiry, or earlier by exercise at a recent snapshot.">
              Cash, in {QUOTE}
            </KeyValueItem>
          </KeyValue>
        </section>

        <section className={css.payout} aria-label="Who pays you">
          <h3 className={css.heading}>Who pays you</h3>
          {inputs && range && split && cover !== null ? (
            <>
              <Slider
                label={`If ${UNDERLYING} settles at`}
                value={price}
                min={range.min}
                max={range.max}
                step={range.step}
                largeStep={range.step * 10}
                valueText={(v) => `${money(v)} ${QUOTE}`}
                onValueChange={setAssumed}
                marks={[
                  { value: range.min, label: `Strike ${money(range.min)}` },
                  { value: range.max, label: money(range.max) },
                ]}
              />
              <Waterfall
                heading={`Owed ${money(split.due)} ${QUOTE}`}
                label={`Hypothetical. ${splitSentence(money(split.due), money(split.fromWriter), money(split.fromVault), split.deficit > 0 ? money(split.deficit) : null, QUOTE)}`}
                paidLabel={split.due > 0 ? `Paid ${money(split.paid)} of ${money(split.due)}` : undefined}
                segments={[
                  { id: 'writer', label: 'Writer margin', value: split.fromWriter, valueLabel: money(split.fromWriter) },
                  { id: 'vault', label: 'Vault', value: split.fromVault, valueLabel: money(split.fromVault) },
                  { id: 'deficit', label: 'Deficit', value: split.deficit, valueLabel: money(split.deficit), kind: 'deficit' },
                ]}
              />
              <PayoutOrder />
              <p className={css.cover}>
                With {money(inputs.writerMargin)} {QUOTE} of writer cash and a vault of {money(inputs.vault)} {QUOTE}, the payout is covered in full up to a settlement price of {money(cover)} {QUOTE}.
                Above it, the rest is a deficit.
              </p>
              <p className={css.caption}>{COVERAGE_CAPTION}</p>
            </>
          ) : (
            <PayoutOrder />
          )}
        </section>
      </div>

      <div className={css.consent}>
        <Checkbox checked={understood} onCheckedChange={setUnderstood}>
          {BUY_CONSENT}
        </Checkbox>
      </div>
    </Dialog>
  )
}
