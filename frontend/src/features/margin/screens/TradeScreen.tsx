import { useMemo, useState } from 'react'
import { countOf, formatCountdown, formatUtc, secondsUntil } from '../../../core/format'
import { seriesStatus } from '../../../core/pro/helpers'
import type { OfferView, SeriesView } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { AmountField, Button, Callout, Card, EmptyNote, KeyValue, KeyValueItem, Link, Select, Tag, useIsPhone } from '../../../ui'
import type { TagAppearance } from '../../../ui'
import { AMOUNT_ERROR, LOTS_ERROR } from '../copy'
import { QUOTE, bpsPercent, lots, perLot, usdx, usdxExact } from '../model/money'
import { UNDERLYING, contractTitle, partyName } from '../model/names'
import { snapshotAge, spanText } from '../model/oracle'
import { parseLots, parseUsdx, premiumPerLot, writeDraft } from '../model/write'
import { DeskTable } from '../parts/DeskTable'
import type { DeskColumn } from '../parts/DeskTable'
import { NoValue, Sub, Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import { Section } from '../parts/Section'
import { useReplayable } from '../parts/useReplayable'
import { BuyDialog } from './BuyDialog'
import css from './TradeScreen.module.css'

const SERIES_LOOK: Record<string, TagAppearance> = { Live: 'live', Expired: 'ended', Settling: 'open', Closed: 'done' }

/** Series, open offers with the Buy dialog, and the form to write an uncovered call (in a rail from 1200 px). */
export function TradeScreen() {
  const { client, model, me, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
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
      { id: 'expiry', header: 'Expiry', cell: (s) => formatUtc(s.expiry) },
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
          return s.snapshot && age !== null ? <span className={css.wrap}>{`No. ${s.snapshot.seq}, ${spanText(age)} old`}</span> : <NoValue label="No snapshot" />
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
          <Button
            {...rowButton}
            disabled={busy}
            aria-label={`Cancel offer ${o.id}, ${contractTitle(seriesOf(o.seriesId))}`}
            onClick={() => void act({ label: 'Cancel offer', done: 'Offer cancelled' }, (opts) => client.cancelOffer(me, o.id, opts))}
          >
            Cancel offer
          </Button>
        ) : lapsed(o) ? (
          <span className={css.muted}>Quote expired</span>
        ) : !canAct ? (
          <Button {...rowButton} onClick={connect}>
            Connect wallet
          </Button>
        ) : (
          <Button {...rowButton} aria-label={`Buy offer ${o.id}: ${lots(o.qty)} lots of ${contractTitle(seriesOf(o.seriesId))} for ${usdx(o.premium)} ${QUOTE}`} onClick={() => setBuying(o)}>
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
            <>
              <span>{countOf(model.series.length, { one: 'series listed', other: 'series listed' })}</span>
              {live.length > 0 ? (
                <Link href="#write" className={css.toWrite}>
                  Write a call
                </Link>
              ) : null}
            </>
          }
          note={`${UNDERLYING} calls, cash-settled. 1 lot is 1 ${UNDERLYING}. Prices and marks are in ${QUOTE}.`}
        >
          <DeskTable caption={`${UNDERLYING} call series`} columns={seriesColumns} rows={model.series} rowKey={(s) => s.id} empty={null} />
        </Section>
      ) : null}

      <div className={live.length > 0 ? css.desk : undefined}>
        <div className={css.main}>
          <Section
            title="Open offers"
            aside={open.length > 0 ? countOf(open.length, { one: 'offer', other: 'offers' }) : undefined}
            note={`An offer here is an unfunded quote: the writer margin is checked when someone buys it. Premiums are in ${QUOTE}.`}
          >
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

/**
 * "Write an uncovered call": series, quantity and total premium, then the margin figures: after the fill when
 * the client has a preview (get_requirement, never computed here), the account as it stands otherwise.
 */
function WriteCall({ live }: { live: SeriesView[] }) {
  const { client, model, me, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const replay = useReplayable()
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [qty, setQty] = useState('1000')
  const [premium, setPremium] = useState('')

  const chosen = live.find((s) => String(s.id) === seriesId) ?? live[0]
  const draft = writeDraft({ writer: me, series: chosen, qty, premium })
  const preview = draft.params ? client.requirementAfterFill(draft.params) : null
  const now = model.accounts.find((a) => a.id === me)?.requirement ?? null
  const shown = preview ?? now
  const fee = model.config.reserveFeeBps
  const scripted = replay.can('create_offer', (args) => args[0] === me && args[1] === chosen?.id)

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
            label="Premium, total"
            unit={QUOTE}
            decimals={7}
            value={premium}
            onValueChange={setPremium}
            validate={(v) => (v.trim() === '' || (parseUsdx(v) ?? 0n) > 0n ? undefined : AMOUNT_ERROR)}
            hint={draft.floor !== null ? `At the latest mark a buy needs at least ${usdxExact(draft.floor)} ${QUOTE}.` : undefined}
          />
          <p className={css.muted}>
            You receive {bpsPercent(10_000 - fee)} of the premium when the offer is bought; {bpsPercent(fee)} goes to the vault as a reserve fee.
          </p>
          {draft.belowFloor && draft.floor !== null ? (
            <Callout variant="warning" title="A buy of this offer would be refused: PremiumBelowMark (222).">
              <p>
                The contract refuses a buy whose premium is below quantity times the latest mark: {lots(draft.qty)} lots at {perLot(chosen?.snapshot?.mark)} is {usdxExact(draft.floor)} {QUOTE}. Raise the
                premium, or wait for a lower mark.
              </p>
            </Callout>
          ) : null}
          {canAct ? (
            <Button
              variant="primary"
              disabled={!draft.params || !scripted || busy}
              disabledReason={!draft.params ? 'Enter a quantity and a premium first.' : !scripted ? replay.reason(`offer by ${partyName(me)} on this series`) : undefined}
              onClick={() =>
                draft.params &&
                void act({ label: 'Write call', done: 'Offer written' }, (opts) => client.createOffer(draft.params!, opts), (id) => ({
                  facts: [
                    ...(id === null ? [] : [{ label: 'Offer', value: `No. ${id}` }]),
                    { label: 'Contract', value: contractTitle(chosen) },
                    { label: 'Quantity', value: `${lots(draft.params!.qty)} lots` },
                    { label: 'Premium, total', value: draft.params!.premium },
                  ],
                }))
              }
            >
              Write call
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
              <Usdx v={chosen?.snapshot?.mark} perLot unit figure="serif" none="No snapshot" />
            </KeyValueItem>
            <KeyValueItem label="Opening requirement (IM)" hint={preview && now ? `Now ${usdx(now.im)} ${QUOTE}` : undefined}>
              <Usdx v={shown?.im} unit figure="serif" none="No requirement for this account" />
            </KeyValueItem>
            <KeyValueItem label="Account value (NLV)" hint={preview && now ? `Now ${usdx(now.nlv)} ${QUOTE}` : undefined}>
              <Usdx v={shown?.nlv} unit figure="serif" none="No requirement for this account" />
            </KeyValueItem>
          </KeyValue>
          <p className={css.muted}>
            Writing posts an unfunded quote. When someone buys it, the contract checks that your account value is at or above the opening requirement, and refuses the buy otherwise.
          </p>
        </section>
      </div>
    </Card>
  )
}
