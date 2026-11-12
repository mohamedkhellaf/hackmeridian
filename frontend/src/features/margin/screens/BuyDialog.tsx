import { useId, useMemo, useState } from 'react'
import { formatCountdown, formatNumber, formatUtc, secondsUntil } from '../../../core/format'
import type { OfferView } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { Button, Dialog, Drawer, KeyValue, KeyValueItem, Slider, SwipeIgnore, useIsPhone } from '../../../ui'
import { Waterfall } from '../../../viz'
import { BUY_PAYOUT_LINE, PAYOUT_ORDER } from '../copy'
import { coverageAt, coverageInputs, coveredUpTo, priceRange, splitSentence } from '../../../core/pro/coverage'
import { QUOTE, bpsPercent, lots, perLot, usdx, withUnit } from '../model/money'
import { UNDERLYING, contractTitle, numbered, partyName } from '../model/names'
import { breakevenPerLot } from '../model/payout'
import { premiumPerLot } from '../model/write'
import { Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import { UNSETTLED_REASON, UnsettledNote } from '../parts/UnsettledNote'
import { RunsFirst } from '../parts/RunsFirst'
import { useReplayable } from '../parts/useReplayable'
import css from './BuyDialog.module.css'

const money = (n: number) => formatNumber(n, { dp: 2 })

/**
 * Buying a call written on partial margin. The terms with what the buy costs at most and where it breaks even,
 * then who pays the holder and in which order, drawn at a settlement price the buyer assumes. The sentence of
 * what is agreed to sits directly above the action; the wallet signature is the consent. A full page on phones.
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
  const { client, model, me, busy, canCheckAgain } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const replay = useReplayable()
  const phone = useIsPhone()
  const lineId = useId()
  const [assumed, setAssumed] = useState<number | null>(null)

  const series = model.series.find((s) => s.id === offer.seriesId)
  const inputs = useMemo(() => (series ? coverageInputs(model, offer, series) : null), [model, offer, series])
  const range = useMemo(() => (inputs ? priceRange(inputs) : null), [inputs])

  const left = series ? secondsUntil(series.expiry, model.now) : 0
  const each = premiumPerLot(offer.premium, offer.qty)
  const breakeven = series ? breakevenPerLot(series.strike, offer.premium, offer.qty) : null
  const price = range ? Math.min(range.max, Math.max(range.min, assumed ?? range.start)) : 0
  const split = inputs ? coverageAt(inputs, price) : null
  const cover = inputs ? coveredUpTo(inputs) : null
  const own = offer.writer === me
  const scripted = replay.can('buy', (args) => args[1] === offer.id)
  const fee = model.config.reserveFeeBps

  const buy = () => {
    onClose()
    void act({ label: 'Buy', done: 'Bought' }, (opts) => client.buy(me, offer.id, opts), (id, step) => ({
      facts: [
        // The replay plays the recorded buy of this offer: its buyer is named when it is another account.
        ...(step && step.args[0] !== me ? [{ label: 'Buyer', value: partyName(String(step.args[0])) }] : []),
        { label: 'Premium paid', value: offer.premium },
        { label: 'Contract', value: contractTitle(series) },
        { label: 'Quantity', value: `${lots(offer.qty)} lots` },
        ...(series ? [{ label: 'Deadline', value: formatUtc(series.expiry), hint: left > 0 ? `${formatCountdown(left)} left` : undefined }] : []),
        ...(id === null ? [] : [{ label: 'Position', value: numbered(id) }]),
      ],
      next: { label: 'View your positions', to: '/margin/positions' },
    }))
  }
  // Fixtures: the recorded buy of this offer. When another account made it, the action says so before the press.
  const recorded = replay.next('buy', (args) => args[1] === offer.id)
  const recordedBuyer = recorded && typeof recorded.args[0] === 'string' && recorded.args[0] !== me ? partyName(recorded.args[0]) : null

  // On a phone the page has its close button at the top; the bar at the bottom carries the one action.
  const footer = (
    <>
      {phone ? null : <Button onClick={onClose}>Cancel</Button>}
      {canAct ? (
        <Button
          variant="primary"
          disabled={own || !scripted || busy || canCheckAgain}
          disabledReason={own ? 'You cannot buy your own offer.' : !scripted ? replay.reason('buy of this offer') : canCheckAgain ? UNSETTLED_REASON : undefined}
          aria-describedby={lineId}
          onClick={buy}
        >
          Buy for {withUnit(usdx(offer.premium))}
          {recordedBuyer ? ` as ${recordedBuyer}` : ''}
        </Button>
      ) : (
        <Button variant="primary" onClick={connect}>
          Connect wallet
        </Button>
      )}
      <div className={css.line}>
        <p id={lineId}>{BUY_PAYOUT_LINE}</p>
        <RunsFirst step={recorded} />
      </div>
    </>
  )

  const body = (
    <>
      <UnsettledNote />
      <div className={css.columns}>
        <section className={css.terms} aria-label="Terms">
          <KeyValue>
            <KeyValueItem label="Premium, paid now" hint={each !== null ? `${withUnit(perLot(each))} per lot. ${bpsPercent(fee)} goes to the vault as a reserve fee, the rest to the writer.` : undefined}>
              <Usdx v={offer.premium} unit figure="serif" />
            </KeyValueItem>
            <KeyValueItem label="Contract">{contractTitle(series)}</KeyValueItem>
            <KeyValueItem label="Quantity">{lots(offer.qty)} lots</KeyValueItem>
            <KeyValueItem label="Deadline" hint={series && left > 0 ? `${formatCountdown(left)} left` : undefined}>
              {series ? formatUtc(series.expiry) : 'Not available'}
            </KeyValueItem>
            <KeyValueItem label="Breakeven">
              <Usdx v={breakeven} perLot unit figure="serif" none="Not available" />
            </KeyValueItem>
            <KeyValueItem label="Most you can lose">
              <Usdx v={offer.premium} unit figure="serif" />
            </KeyValueItem>
            <KeyValueItem label="Writer">
              <Who id={offer.writer} me={me} length="medium" />
            </KeyValueItem>
            <KeyValueItem label="Collateral" hint="The writer margin is checked when you buy.">
              Partial
            </KeyValueItem>
            <KeyValueItem label="Settlement">Cash, in {QUOTE}</KeyValueItem>
          </KeyValue>
        </section>

        <section className={css.payout} aria-label="Who pays you">
          <h3 className={css.heading}>Who pays you</h3>
          {inputs && range && split && cover !== null ? (
            <>
              <SwipeIgnore>
                <Slider
                  label={`If ${UNDERLYING} settles at`}
                  value={price}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  largeStep={range.step * 10}
                  valueText={(v) => withUnit(money(v))}
                  onValueChange={setAssumed}
                  marks={[{ value: range.min, label: `Strike ${money(range.min)}` }]}
                />
              </SwipeIgnore>
              {/* Reserves the height of the tallest drawing, so the dialog does not move under the pointer. */}
              <div className={css.figure}>
                <Waterfall
                  heading={`Owed ${withUnit(money(split.due))}`}
                  label={`Hypothetical. ${splitSentence(money(split.due), money(split.fromWriter), money(split.fromVault), split.deficit > 0 ? money(split.deficit) : null, QUOTE)}`}
                  paidLabel={split.due > 0 ? `Paid ${money(split.paid)} of ${money(split.due)}` : undefined}
                  segments={[
                    { id: 'writer', label: 'Writer margin', value: split.fromWriter, valueLabel: money(split.fromWriter) },
                    { id: 'vault', label: 'Vault', value: split.fromVault, valueLabel: money(split.fromVault) },
                    { id: 'deficit', label: 'Deficit', value: split.deficit, valueLabel: money(split.deficit), kind: 'deficit' },
                  ]}
                />
              </div>
              <PayoutOrder />
              <p className={css.cover}>
                Hypothetical, at today&apos;s figures ({withUnit(money(inputs.writerMargin))} of writer cash, {withUnit(money(inputs.vault))} in the vault): a deficit starts above a settlement price
                of {withUnit(money(cover))}, or lower if the vault also pays other positions or the writer&apos;s cash falls.
              </p>
            </>
          ) : (
            <PayoutOrder />
          )}
        </section>
      </div>
    </>
  )

  const title = `Buy ${UNDERLYING} call`
  const onOpenChange = (next: boolean) => {
    if (!next) onClose()
  }
  return phone ? (
    <Drawer presentation="page" open={open} onOpenChange={onOpenChange} title={title} footer={footer} className={css.page}>
      {body}
    </Drawer>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="lg" footer={footer} className={css.dialog}>
      {body}
    </Dialog>
  )
}
