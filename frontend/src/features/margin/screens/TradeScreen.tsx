import { useMemo, useState } from 'react'
import { countOf, formatCountdown, formatUtc, secondsUntil } from '../../../core/format'
import { seriesStatus } from '../../../core/pro/helpers'
import type { OfferView, SeriesView } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { AmountField, Button, Callout, Card, EmptyNote, KeyValue, KeyValueItem, Link, Select, Tag, useIsPhone } from '../../../ui'
import type { TagAppearance } from '../../../ui'
import { AMOUNT_ERROR, LOTS_ERROR, NO_VALUE_NOTE, REPLAY_NOTE } from '../copy'
import { QUOTE, lots, perLot, usdx, usdxExact } from '../model/money'
import { UNDERLYING, contractName, contractTitle, scenarioCopy } from '../model/names'
import { snapshotAge, spanText } from '../model/oracle'
import { parseLots, parseUsdx, premiumPerLot, writeDraft } from '../model/write'
import { DeskTable } from '../parts/DeskTable'
import type { DeskColumn } from '../parts/DeskTable'
import { NoValue, Sub, Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import { Footnote, Section } from '../parts/Section'
import { BuyDialog } from './BuyDialog'
import css from './TradeScreen.module.css'

const SERIES_LOOK: Record<string, TagAppearance> = { Live: 'live', Expired: 'ended', Settling: 'open', Closed: 'done' }

/** Series, open offers with the Buy dialog, and the form to write an uncovered call. */
export function TradeScreen() {
  const { client, model, me, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const [buying, setBuying] = useState<OfferView | null>(null)
  const phone = useIsPhone()
  const rowButton = { size: phone ? 'md' : 'sm', fullWidth: phone } as const
  const seriesOf = (id: number) => model.series.find((s) => s.id === id)
  const open = model.offers.filter((o) => o.status === 'open')

  const seriesColumns = useMemo<ReadonlyArray<DeskColumn<SeriesView>>>(
    () => [
      {
        id: 'contract',
        header: 'Contract',
        rowHeader: true,
        phone: 'title',
        cell: (s) => (
          <>
            {contractName(s)} <Sub>Series {s.id}</Sub>
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
      { id: 'mark', header: 'Mark per lot', numeric: true, cell: (s) => (s.snapshot ? perLot(s.snapshot.mark) : <NoValue />) },
      { id: 'oi', header: 'Open interest (lots)', numeric: true, cell: (s) => lots(s.oi) },
      { id: 'price', header: 'Publisher price', numeric: true, cell: (s) => (s.snapshot ? <Usdx v={s.snapshot.spot} /> : <NoValue />) },
      {
        id: 'snapshot',
        header: 'Snapshot',
        cell: (s) => {
          const age = snapshotAge(model, s)
          return s.snapshot && age !== null ? `No. ${s.snapshot.seq}, ${spanText(age)} old` : <NoValue label="No snapshot" />
        },
      },
      {
        id: 'settlement',
        header: 'Settlement price',
        numeric: true,
        cell: (s) => (s.settlementPrice != null ? <Usdx v={s.settlementPrice} /> : <NoValue label="Not published" />),
        phoneSkip: (s) => s.settlementPrice == null && model.now < s.expiry,
      },
    ],
    [model],
  )

  /** A quote past its own expiry, or on an expired series, cannot be bought any more. */
  const lapsed = (o: OfferView): boolean => {
    const s = seriesOf(o.seriesId)
    return model.now >= o.quoteExpiry || (s !== undefined && model.now >= s.expiry)
  }

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
    { id: 'qty', header: 'Quantity (lots)', numeric: true, cell: (o) => lots(o.qty) },
    { id: 'premium', header: 'Premium', numeric: true, cell: (o) => <Usdx v={o.premium} /> },
    { id: 'each', header: 'Premium per lot', numeric: true, cell: (o) => perLot(premiumPerLot(o.premium, o.qty)) },
    { id: 'mark', header: 'Mark per lot', numeric: true, cell: (o) => perLot(seriesOf(o.seriesId)?.snapshot?.mark) },
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
      <Section title="Series" aside={countOf(model.series.length, { one: 'series listed', other: 'series listed' })} note={`${UNDERLYING} calls, cash-settled. Prices and marks are in ${QUOTE}.`}>
        <DeskTable
          caption={`${UNDERLYING} call series`}
          columns={seriesColumns}
          rows={model.series}
          rowKey={(s) => s.id}
          empty={<EmptyNote size="sm" title="No series is listed yet." hint="The admin account lists series. Nothing can be written or bought until one exists." />}
        />
        {model.series.some((s) => !s.snapshot) ? <Footnote>{NO_VALUE_NOTE}</Footnote> : null}
      </Section>

      <Section title="Open offers" aside={open.length > 0 ? countOf(open.length, { one: 'offer', other: 'offers' }) : undefined} note={`An offer here is an unfunded quote: the writer margin is checked when someone buys it. Premiums are in ${QUOTE}.`}>
        <DeskTable
          caption="Open offers"
          columns={offerColumns}
          rows={open}
          rowKey={(o) => o.id}
          empty={<EmptyNote size="sm" title="No open offers." hint="A writer can post one with the form below." action={<Link href="#write">Write an uncovered call</Link>} />}
        />
      </Section>

      <WriteCall />

      <BuyDialog offer={buying} onClose={() => setBuying(null)} />
    </div>
  )
}

/**
 * "Write an uncovered call": series, quantity and total premium, with the requirement after the fill as the
 * client returns it (get_requirement, never computed here) and the mark floor.
 */
function WriteCall() {
  const { client, model, me, simulated, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const live = model.series.filter((s) => !s.closed && model.now < s.expiry)
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [qty, setQty] = useState('1000')
  const [premium, setPremium] = useState('')

  const chosen = live.find((s) => String(s.id) === seriesId) ?? live[0]
  const draft = writeDraft({ writer: me, series: chosen, qty, premium })
  const preview = draft.params ? client.requirementAfterFill(draft.params) : null
  const now = model.accounts.find((a) => a.id === me)?.requirement ?? null

  return (
    <Card title="Write an uncovered call" headingLevel={2} id="write" className={css.write}>
      {live.length === 0 ? (
        <p className={css.muted}>No series is live, so no call can be written.</p>
      ) : (
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
            {draft.belowFloor && draft.floor !== null ? (
              <Callout variant="warning" label="Below the mark floor" title={`A buy of this offer would be refused: PremiumBelowMark (222).`}>
                <p>
                  The contract refuses a buy whose premium is below quantity times the latest mark: {lots(draft.qty)} lots at {perLot(chosen?.snapshot?.mark)} is {usdxExact(draft.floor)} {QUOTE}. Raise the
                  premium, or wait for a lower mark.
                </p>
              </Callout>
            ) : null}
            {canAct ? (
              <Button
                variant="primary"
                disabled={!draft.params || busy}
                disabledReason={!draft.params ? 'Enter a quantity and a premium first.' : undefined}
                onClick={() =>
                  draft.params &&
                  void act({ label: 'Write call', done: 'Offer written' }, (opts) => client.createOffer(draft.params!, opts), (id) => (id === null ? [] : [{ label: 'Offer', value: `No. ${id}` }]))
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

          <section className={css.preview} aria-label="Margin after the fill">
            <h3 className={css.previewTitle}>Margin after the fill</h3>
            <KeyValue>
              <KeyValueItem label="Mark per lot">{chosen?.snapshot ? `${perLot(chosen.snapshot.mark)} ${QUOTE}` : <NoValue />}</KeyValueItem>
              <KeyValueItem label="Opening requirement (IM)" hint={now ? `Now ${usdx(now.im)} ${QUOTE}` : undefined}>
                {preview ? <Usdx v={preview.im} unit figure="serif" /> : <NoValue label="No preview for this order" />}
              </KeyValueItem>
              <KeyValueItem label="Account value (NLV)" hint={now ? `Now ${usdx(now.nlv)} ${QUOTE}` : undefined}>
                {preview ? <Usdx v={preview.nlv} unit figure="serif" /> : <NoValue label="No preview for this order" />}
              </KeyValueItem>
            </KeyValue>
            {!preview ? (
              <p className={css.muted}>
                {!draft.params
                  ? 'Enter a quantity and a premium to see the requirement after the fill.'
                  : simulated
                    ? `The recorded scenario has no requirement for this exact order. The scenario "${scenarioCopy('happy_path_otm').title}" has one at step 4, for 1,000 lots.`
                    : 'The contract has no view that previews a fill, so nothing is shown here. The check runs when someone buys.'}
              </p>
            ) : null}
            <p className={css.rule}>
              Writing posts an unfunded quote. When someone buys it, the contract checks that your account value is at or above the opening requirement, and refuses the buy otherwise. These figures
              come from the contract, never from this page.
            </p>
            {simulated ? <p className={css.replay}>{REPLAY_NOTE}</p> : null}
          </section>
        </div>
      )}
    </Card>
  )
}
