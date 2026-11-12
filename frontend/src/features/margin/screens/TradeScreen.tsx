import { useMemo, useState } from 'react'
import { countOf, formatCountdown, formatUtc, secondsUntil } from '../../../core/format'
import { seriesStatus } from '../../../core/pro/helpers'
import type { OfferView, SeriesView } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { AmountField, Button, Callout, Card, EmptyNote, KeyValue, KeyValueItem, Link, Select, Tag, useIsPhone } from '../../../ui'
import type { TagAppearance } from '../../../ui'
import { AMOUNT_ERROR, LOTS_ERROR } from '../copy'
import { QUOTE, bpsPercent, lots, perLot, perLotAtLeast, usdx, usdxExact, withUnit } from '../model/money'
import { UNDERLYING, contractTitle, numbered, partyName, runsFirstText } from '../model/names'
import { snapshotAge, spanText } from '../model/oracle'
import { exactPerLot, parseLots, parseUsdx, premiumFloor, premiumPerLot, writeDraft } from '../model/write'
import type { WriteDraft } from '../model/write'
import { DeskTable } from '../parts/DeskTable'
import type { DeskColumn } from '../parts/DeskTable'
import { NoValue, Sub, Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import { RecordedField } from '../parts/RecordedField'
import { RunsFirst } from '../parts/RunsFirst'
import { Section } from '../parts/Section'
import { useReplayable } from '../parts/useReplayable'
import type { RecordedStep } from '../parts/useReplayable'
import { BuyDialog } from './BuyDialog'
import css from './TradeScreen.module.css'

const SERIES_LOOK: Record<string, TagAppearance> = { Live: 'live', Expired: 'ended', Settling: 'open', Closed: 'done' }

/** Under the series table, once: the price is the publisher's and nothing of the token moves (ruling F11). */
export const SERIES_LINE = `Calls settled in ${QUOTE} on the publisher's ${UNDERLYING} price. No ${UNDERLYING} token changes hands.`

/** Series, open offers with the Buy dialog, and the form to write an uncovered call (in a rail from 1200 px). */
export function TradeScreen() {
  const { model, me } = usePro()
  const { canAct, connect } = useMarginUi()
  const [buying, setBuying] = useState<OfferView | null>(null)
  const [showLapsed, setShowLapsed] = useState(false)
  const phone = useIsPhone()
  const rowButton = { size: phone ? 'md' : 'sm', fullWidth: phone } as const
  const seriesOf = (id: number) => model.series.find((s) => s.id === id)
  const live = model.series.filter((s) => !s.closed && model.now < s.expiry)

  /** A quote past its own expiry, or on an expired series, cannot be bought any more. */
  const lapsed = (o: OfferView): boolean => {
    const s = seriesOf(o.seriesId)
    return model.now >= o.quoteExpiry || (s !== undefined && model.now >= s.expiry)
  }
  const listed = model.offers.filter((o) => o.status === 'open')
  const open = listed.filter((o) => !lapsed(o))
  const expired = listed.filter(lapsed)

  const seriesColumns = useMemo<ReadonlyArray<DeskColumn<SeriesView>>>(
    () => [
      {
        id: 'contract',
        header: 'Contract',
        rowHeader: true,
        phone: 'title',
        cell: (s) => (
          <>
            {contractTitle(s)} <Sub>Series {s.id}</Sub>
          </>
        ),
      },
      {
        id: 'state',
        header: 'State',
        phone: 'aside',
        cell: (s) => {
          const label = seriesStatus(s, model.now).label
          return <Tag state={label} appearance={SERIES_LOOK[label]} />
        },
      },
      { id: 'deadline', header: 'Deadline', cell: (s) => formatUtc(s.expiry) },
      {
        id: 'left',
        header: 'Time left',
        cell: (s) => (model.now < s.expiry ? formatCountdown(secondsUntil(s.expiry, model.now)) : 'None'),
        phoneSkip: (s) => model.now >= s.expiry,
      },
      { id: 'mark', header: 'Mark per lot', numeric: true, cell: (s) => <Usdx v={s.snapshot?.mark} perLot none="No snapshot" /> },
      { id: 'oi', header: 'Open interest (lots)', numeric: true, cell: (s) => lots(s.oi) },
      { id: 'price', header: 'Publisher price', numeric: true, cell: (s) => <Usdx v={s.snapshot?.spot} none="No snapshot" /> },
      {
        id: 'snapshot',
        header: 'Snapshot',
        cell: (s) => {
          const age = snapshotAge(model, s)
          return s.snapshot && age !== null ? <span className={css.wrap}>{`${numbered(s.snapshot.seq)}, ${spanText(age)} old`}</span> : <NoValue label="No snapshot" />
        },
      },
      {
        id: 'settlement',
        header: 'Settlement price',
        numeric: true,
        cell: (s) => <Usdx v={s.settlementPrice} none="Not published" />,
        phoneSkip: (s) => s.settlementPrice == null && model.now < s.expiry,
      },
    ],
    [model],
  )

  const offerColumns: ReadonlyArray<DeskColumn<OfferView>> = [
    {
      id: 'contract',
      header: 'Contract',
      rowHeader: true,
      phone: 'title',
      cell: (o) => (
        <>
          {contractTitle(seriesOf(o.seriesId))} <Sub>Offer {o.id}</Sub>
        </>
      ),
    },
    { id: 'qty', header: 'Lots', numeric: true, cell: (o) => lots(o.qty) },
    { id: 'premium', header: 'Premium', numeric: true, cell: (o) => <Usdx v={o.premium} /> },
    { id: 'each', header: 'Per lot', numeric: true, cell: (o) => <Usdx v={premiumPerLot(o.premium, o.qty)} perLot /> },
    { id: 'mark', header: 'Mark per lot', numeric: true, cell: (o) => <Usdx v={seriesOf(o.seriesId)?.snapshot?.mark} perLot none="No snapshot" /> },
    { id: 'writer', header: 'Writer', cell: (o) => <Who id={o.writer} me={me} /> },
    {
      id: 'action',
      header: 'Action',
      hideHeader: true,
      pinned: true,
      phone: 'actions',
      cell: (o) =>
        o.writer === me && canAct ? (
          <CancelOffer offer={o} />
        ) : lapsed(o) ? (
          <span className={css.muted}>Quote expired</span>
        ) : !canAct ? (
          <Button {...rowButton} onClick={connect}>
            Connect wallet
          </Button>
        ) : (
          <Button {...rowButton} aria-label={`Buy offer ${o.id}: ${lots(o.qty)} lots of ${contractTitle(seriesOf(o.seriesId))} for ${withUnit(usdx(o.premium))}`} onClick={() => setBuying(o)}>
            Buy
          </Button>
        ),
    },
  ]

  return (
    <div className={css.root}>
      {live.length === 0 ? (
        <p className={css.dormant}>
          {model.series.length === 0 ? 'No series is listed.' : 'No series is live.'} Nothing can be written or bought until the admin lists one.
        </p>
      ) : null}

      {model.series.length > 0 ? (
        <Section
          title="Series"
          aside={
            live.length > 0 ? (
              <Link href="#write" className={css.toWrite}>
                Write a call
              </Link>
            ) : undefined
          }
          note={SERIES_LINE}
        >
          <DeskTable caption={`${UNDERLYING} call series`} columns={seriesColumns} rows={model.series} rowKey={(s) => s.id} empty={null} />
        </Section>
      ) : null}

      <div className={live.length > 0 ? css.desk : undefined}>
        <div className={css.main}>
          <Section title="Open offers" aside={open.length > 0 ? countOf(open.length, { one: 'offer', other: 'offers' }) : undefined}>
            <DeskTable caption="Open offers" columns={offerColumns} rows={open} rowKey={(o) => o.id} empty={<EmptyNote size="sm" title="No open offers." />} />
            {expired.length > 0 ? (
              <div className={css.lapsed}>
                <Button size="sm" variant="quiet" aria-expanded={showLapsed} onClick={() => setShowLapsed(!showLapsed)}>
                  {showLapsed ? 'Hide expired quotes' : `Expired quotes (${expired.length})`}
                </Button>
                {showLapsed ? <DeskTable caption="Expired quotes" columns={offerColumns} rows={expired} rowKey={(o) => o.id} empty={null} /> : null}
              </div>
            ) : null}
          </Section>
        </div>

        {live.length > 0 ? <WriteCall live={live} /> : null}
      </div>

      <BuyDialog offer={buying} onClose={() => setBuying(null)} />
    </div>
  )
}

/** The writer's own offer: Cancel, and on fixtures the recorded steps a press runs first, if any. */
function CancelOffer({ offer }: { offer: OfferView }) {
  const { client, model, me, busy } = usePro()
  const { act } = useMarginUi()
  const replay = useReplayable()
  const phone = useIsPhone()
  const step = replay.next('cancel_offer', (args) => args[0] === me && args[1] === offer.id)
  const button = (
    <Button
      size={phone ? 'md' : 'sm'}
      fullWidth={phone}
      disabled={busy}
      aria-label={`Cancel offer ${offer.id}, ${contractTitle(model.series.find((s) => s.id === offer.seriesId))}`}
      onClick={() => void act({ label: 'Cancel offer', done: 'Offer cancelled' }, (opts) => client.cancelOffer(me, offer.id, opts))}
    >
      Cancel offer
    </Button>
  )
  if (!step || step.before.length === 0) return button
  return (
    <span className={css.act}>
      {button}
      <RunsFirst step={step} />
    </span>
  )
}

/** A replayed offer's terms, read from its recorded step: the replay sends these, whatever a field held. */
function recordedDraft(step: RecordedStep, writer: string, series: SeriesView | undefined): WriteDraft {
  const qty = BigInt(step.args[2] as number)
  const premium = BigInt(step.args[3] as number)
  const floor = premiumFloor(qty, series)
  return {
    params: { writer, seriesId: step.args[1] as number, qty, premium, quoteExpiry: step.args[4] as number },
    qty,
    each: premiumPerLot(premium, qty),
    premium,
    floor,
    belowFloor: floor !== null && premium < floor,
  }
}

/**
 * "Write an uncovered call": series, quantity and the premium per lot, with the exact total the contract gets,
 * then the margin figures: after the fill when the client has a preview (get_requirement, never computed here),
 * the account as it stands otherwise. On fixtures the quantity and premium are those of the recorded step the
 * press replays, locked.
 */
function WriteCall({ live }: { live: SeriesView[] }) {
  const { client, model, me, busy, simulated } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const replay = useReplayable()
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [qty, setQty] = useState('1,000')
  const [each, setEach] = useState('')

  const chosen = live.find((s) => String(s.id) === seriesId) ?? live[0]
  const recorded = simulated ? replay.next('create_offer', (args) => args[0] === me && args[1] === chosen?.id) : null
  const draft = recorded ? recordedDraft(recorded, me, chosen) : writeDraft({ writer: me, series: chosen, qty, perLot: each })
  const preview = draft.params ? client.requirementAfterFill(draft.params) : null
  const now = model.accounts.find((a) => a.id === me)?.requirement ?? null
  const shown = preview ?? now
  const fee = model.config.reserveFeeBps
  const mark = chosen?.snapshot?.mark ?? null
  const atLeast = mark !== null ? `A buy needs at least ${withUnit(perLotAtLeast(mark))} per lot at the latest mark.` : null
  const recordedAt = replay.requirementAt(me)
  const noRequirement = recordedAt !== null ? `The scenario records ${partyName(me)}'s margin requirement at step ${recordedAt}.` : `The scenario records no margin requirement for ${partyName(me)} after step ${replay.position}.`

  const write = () => {
    const params = draft.params
    if (!params) return
    void act({ label: 'Write call', done: 'Offer written' }, (opts) => client.createOffer(params, opts), (id, step) => {
      // The receipt states the replayed step's own terms; on the contract, what was signed.
      const terms = step ? { seriesId: step.args[1] as number, qty: BigInt(step.args[2] as number), premium: BigInt(step.args[3] as number) } : params
      return {
        facts: [
          ...(id === null ? [] : [{ label: 'Offer', value: numbered(id) }]),
          { label: 'Contract', value: contractTitle(model.series.find((x) => x.id === terms.seriesId)) },
          { label: 'Quantity', value: `${lots(terms.qty)} lots` },
          { label: 'Premium, total', value: terms.premium },
        ],
      }
    })
  }

  return (
    <Card title="Write an uncovered call" headingLevel={2} id="write" className={css.write}>
      <div className={css.writeGrid}>
        <div className={css.form}>
          <Select
            label="Series"
            value={chosen ? String(chosen.id) : null}
            onValueChange={setSeriesId}
            options={live.map((s) => ({ value: String(s.id), label: contractTitle(s), detail: `Series ${s.id}` }))}
          />
          {simulated ? (
            <>
              <RecordedField label="Quantity" unit="lots" value={recorded ? lots(draft.qty) : ''} hint={undefined} />
              <RecordedField
                label="Premium per lot"
                unit={QUOTE}
                value={recorded && draft.premium !== null && draft.qty !== null ? (exactPerLot(draft.premium, draft.qty) ?? perLot(draft.each)) : ''}
                hint={
                  recorded
                    ? [`Recorded amounts for step ${recorded.number}.`, runsFirstText(recorded.before), atLeast].filter(Boolean).join(' ')
                    : replay.reason(`offer by ${partyName(me)} on this series`)
                }
              />
            </>
          ) : (
            <>
              <AmountField
                label="Quantity"
                unit="lots"
                decimals={0}
                placeholder="0"
                value={qty}
                onValueChange={setQty}
                validate={(v) => (v.trim() === '' || parseLots(v) !== null ? undefined : LOTS_ERROR)}
              />
              <AmountField
                label="Premium per lot"
                unit={QUOTE}
                decimals={7}
                value={each}
                onValueChange={setEach}
                validate={(v) => (v.trim() === '' || (parseUsdx(v) ?? 0n) > 0n ? undefined : AMOUNT_ERROR)}
                hint={atLeast ?? undefined}
              />
            </>
          )}
          {simulated && !recorded ? null : (
            <KeyValue>
              <KeyValueItem label="Premium, total">
                <Usdx v={draft.premium} unit figure="serif" none="Enter a quantity and a premium per lot" />
              </KeyValueItem>
            </KeyValue>
          )}
          <p className={css.muted}>
            You receive {bpsPercent(10_000 - fee)} of the premium when the offer is bought; {bpsPercent(fee)} goes to the vault as a reserve fee.
          </p>
          {draft.belowFloor && draft.floor !== null ? (
            <Callout variant="warning" title="A buy of this offer would be refused: PremiumBelowMark (222).">
              <p>
                The contract refuses a buy whose premium is below quantity times the latest mark: {lots(draft.qty)} lots at {perLot(mark)} is {withUnit(usdxExact(draft.floor))}. Raise the
                premium, or wait for a lower mark.
              </p>
            </Callout>
          ) : null}
          {canAct ? (
            <Button
              variant="primary"
              disabled={!draft.params || busy}
              disabledReason={!draft.params ? (simulated ? replay.reason(`offer by ${partyName(me)} on this series`) : 'Enter a quantity and a premium first.') : undefined}
              onClick={write}
            >
              {recorded && draft.premium !== null ? `Write call for ${withUnit(usdx(draft.premium))}` : 'Write call'}
            </Button>
          ) : (
            <Button variant="primary" onClick={connect}>
              Connect wallet
            </Button>
          )}
        </div>

        <section className={css.preview} aria-label={preview ? 'Margin after the fill' : 'Your margin now'}>
          <h3 className={css.previewTitle}>{preview ? 'Margin after the fill' : 'Your margin now'}</h3>
          <KeyValue>
            <KeyValueItem label="Mark per lot">
              <Usdx v={mark} perLot unit figure="serif" none="No snapshot" />
            </KeyValueItem>
            {shown || !simulated ? (
              <>
                <KeyValueItem label="Opening requirement (IM)" hint={preview && now ? `Now ${withUnit(usdx(now.im))}` : undefined}>
                  <Usdx v={shown?.im} unit figure="serif" none="No requirement for this account" />
                </KeyValueItem>
                <KeyValueItem label="Account value (NLV)" hint={preview && now ? `Now ${withUnit(usdx(now.nlv))}` : undefined}>
                  <Usdx v={shown?.nlv} unit figure="serif" none="No requirement for this account" />
                </KeyValueItem>
              </>
            ) : null}
          </KeyValue>
          {!shown && simulated ? <p className={css.muted}>{noRequirement}</p> : null}
          <p className={css.muted}>
            Writing posts an unfunded quote. When someone buys it, the contract checks that your account value is at or above the opening requirement, and refuses the buy otherwise.
          </p>
        </section>
      </div>
    </Card>
  )
}
