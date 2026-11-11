import { useState } from 'react'
import { PRO_ERRORS } from '../../../core/pro/errors'
import { seriesStatus } from '../../../core/pro/helpers'
import type { BookView, SeriesView } from '../../../core/pro/types'
import { VAULT } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { AmountField, Button, Callout, Card, EmptyNote, KeyValue, KeyValueItem, Stat, Tag } from '../../../ui'
import type { TagAppearance } from '../../../ui'
import { Waterfall } from '../../../viz'
import { AMOUNT_ERROR, LP_LOCK_NOTE } from '../copy'
import { QUOTE, bpsPercent, lots, toChartNumber, usdx } from '../model/money'
import { contractTitle, partyName } from '../model/names'
import { splitSentence } from '../../../core/pro/coverage'
import { oracleView } from '../model/oracle'
import { seriesSettlements } from '../model/settlement'
import { parseUsdx } from '../model/write'
import { ConfirmDialog } from '../parts/ConfirmDialog'
import { DeskTable } from '../parts/DeskTable'
import type { DeskColumn } from '../parts/DeskTable'
import { Sub, Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import { Footnote, Section } from '../parts/Section'
import { useReplayable } from '../parts/useReplayable'
import css from './VaultScreen.module.css'

const SERIES_LOOK: Record<string, TagAppearance> = { Live: 'live', Expired: 'ended', Settling: 'open', Closed: 'done' }

interface ShareRow {
  lp: string
  shares: bigint
  /** Hundredths of a percent of all shares, rounded down. */
  bps: bigint | null
}

const percent = (bps: bigint | null) => (bps === null ? '–' : `${(bps / 100n).toString()}.${(bps % 100n).toString().padStart(2, '0')} %`)

/**
 * The backstop vault: what it is worth, what it has set aside for books it took over, who provided its
 * capital, and per series what it had to pay and what was left unpaid.
 */
export function VaultScreen() {
  const { client, model, me, simulated, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const replay = useReplayable()
  const [amount, setAmount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const v = model.vault
  const units = parseUsdx(amount) ?? 0n
  const valid = units > 0n
  const pending = oracleView(model).pending.length > 0
  const scripted = replay.can('lp_deposit', (args) => args[0] === me)

  const shareRows: ShareRow[] = v.lpShares.map((l) => ({ lp: l.lp, shares: l.shares, bps: v.totalShares > 0n ? (l.shares * 10_000n) / v.totalShares : null }))
  const mine = me !== '' ? v.lpShares.find((l) => l.lp === me)?.shares : undefined
  const vaultBooks = model.books.filter((b) => b.owner === VAULT)
  const settlements = seriesSettlements(model).filter((s) => s.due > 0n && s.deficit !== null)
  const scale = settlements.reduce((max, s) => Math.max(max, toChartNumber(s.due)), 0)
  const seriesOf = (id: number) => model.series.find((s) => s.id === id)

  const shareColumns: ReadonlyArray<DeskColumn<ShareRow>> = [
    { id: 'lp', header: 'Provider', rowHeader: true, phone: 'title', cell: (r) => <Who id={r.lp} me={me} /> },
    { id: 'shares', header: 'Shares', numeric: true, cell: (r) => <Usdx v={r.shares} counts="shares" /> },
    { id: 'part', header: 'Part of the vault', numeric: true, cell: (r) => percent(r.bps) },
  ]

  const seriesColumns: ReadonlyArray<DeskColumn<SeriesView>> = [
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
    { id: 'shortfall', header: `Shortfall (${QUOTE})`, numeric: true, cell: (s) => <Usdx v={s.shortfall} /> },
    { id: 'paid', header: `Paid by the vault (${QUOTE})`, numeric: true, cell: (s) => <Usdx v={s.vaultPaid} /> },
    {
      id: 'deficit',
      header: `Deficit (${QUOTE})`,
      numeric: true,
      cell: (s) => (s.deficit !== null ? <Usdx v={s.deficit} tone="loss" /> : <span className={css.muted}>After settlement</span>),
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
  ]

  const bookColumns: ReadonlyArray<DeskColumn<BookView>> = [
    {
      id: 'contract',
      header: 'Contract',
      rowHeader: true,
      phone: 'title',
      cell: (b) => (
        <>
          {contractTitle(seriesOf(b.seriesId))} <Sub>Book {b.id}</Sub>
        </>
      ),
    },
    { id: 'qty', header: 'Quantity (lots)', numeric: true, cell: (b) => lots(b.qty) },
    { id: 'reserve', header: `Takeover payment reserved (${QUOTE})`, numeric: true, cell: (b) => <Usdx v={b.reserve} /> },
    { id: 'state', header: 'State', phone: 'aside', cell: (b) => <Tag state={b.settled ? 'Settled' : 'Open'} appearance={b.settled ? 'done' : 'live'} /> },
  ]

  const debtColumns: ReadonlyArray<DeskColumn<{ writer: string; owed: bigint }>> = [
    { id: 'writer', header: 'Writer', rowHeader: true, phone: 'title', cell: (d) => <Who id={d.writer} me={me} /> },
    { id: 'owed', header: `Owed (${QUOTE})`, numeric: true, cell: (d) => <Usdx v={d.owed} tone="loss" /> },
  ]

  return (
    <div className={css.root}>
      <div className={css.figures}>
        <Stat size="lg" label="Vault value" value={<Usdx v={v.value} none="No value at this moment" />} unit={v.value !== null ? QUOTE : undefined} />
        <Stat label="Cash" value={<Usdx v={v.cash} />} unit={QUOTE} hint={`Includes the ${bpsPercent(model.config.reserveFeeBps)} reserve fee taken from every premium.`} />
        <Stat label="Reserved for takeovers" value={<Usdx v={v.reserved} />} unit={QUOTE} hint="Takeover payments kept for the books it took over." />
        <Stat label="Owed by writers" value={<Usdx v={v.debtsOwed} tone="loss" />} unit={QUOTE} hint="Takeover shortfalls not collected yet." />
      </div>

      <div className={css.columns}>
        <div className={css.main}>
          <Section title="Shares" aside={mine !== undefined && mine > 0n ? `Yours ${usdx(mine)}` : undefined}>
            {v.totalShares === 0n ? (
              <EmptyNote title="Nobody has funded the vault yet." hint="Without capital in the vault, a shortfall goes straight to a deficit." />
            ) : (
              <>
                <DeskTable
                  caption="LP shares of the vault"
                  columns={shareColumns}
                  rows={shareRows}
                  rowKey={(r) => r.lp}
                  narrow
                  total={{ label: 'All shares', cells: { shares: <Usdx v={v.totalShares} counts="shares" /> } }}
                  empty={
                    <KeyValue variant="plain" figures="sans" className={css.total}>
                      <KeyValueItem label="All shares">{usdx(v.totalShares)}</KeyValueItem>
                    </KeyValue>
                  }
                />
                {!simulated ? <Footnote>The contract gives shares per account, not a list of providers: only the connected wallet and the accounts seen in this session can be listed.</Footnote> : null}
              </>
            )}
          </Section>

          {vaultBooks.length > 0 ? (
            <Section title="Books taken over" note="Short calls the vault now carries. They settle at expiry and cannot be exercised early.">
              <DeskTable caption="Books owned by the vault" columns={bookColumns} rows={vaultBooks} rowKey={(b) => b.id} empty={null} />
            </Section>
          ) : null}

          <Section title="Debts owed by writers" note="A takeover shortfall is collected from the writer cash at any later takeover, when its last expired position settles, and before any withdrawal.">
            <DeskTable caption="Debts owed to the vault" columns={debtColumns} rows={v.debtors} rowKey={(d) => d.writer} narrow empty={<EmptyNote size="sm" title="No writer owes the vault." />} />
          </Section>
        </div>

        <Card title="Deposit to the vault" headingLevel={2} className={css.form}>
          <AmountField
            label="Amount"
            unit={QUOTE}
            decimals={7}
            value={amount}
            onValueChange={setAmount}
            aside={model.wallets[me] !== undefined ? `Wallet ${usdx(model.wallets[me])} ${QUOTE}` : undefined}
            validate={(value) => (value.trim() === '' || (parseUsdx(value) ?? 0n) > 0n ? undefined : AMOUNT_ERROR)}
          />
          {canAct ? (
            <Button
              variant="primary"
              disabled={!valid || !scripted || busy}
              disabledReason={!valid ? 'Enter an amount first.' : !scripted ? replay.reason(`vault deposit by ${partyName(me)}`) : undefined}
              onClick={() => setConfirming(true)}
            >
              Deposit to the vault
            </Button>
          ) : (
            <Button variant="primary" onClick={connect}>
              Connect wallet
            </Button>
          )}
          <p className={css.lock}>{LP_LOCK_NOTE}</p>
        </Card>
      </div>

      <Section title="Series" note="What each series asked of the vault. A shortfall is what the writers could not pay; a deficit is what the vault could not pay either.">
        <DeskTable
          caption="Shortfall, vault payment and deficit per series"
          columns={seriesColumns}
          rows={model.series}
          rowKey={(s) => s.id}
          empty={<EmptyNote size="sm" title="No series is listed yet." />}
        />
        {settlements.length > 0 ? (
          <div className={css.settlements}>
            {settlements.map((s) => (
              <figure key={s.series.id} className={css.settlement}>
                <Waterfall
                  max={scale}
                  heading={`${contractTitle(s.series)}: owed ${usdx(s.due)} ${QUOTE} at settlement`}
                  paidLabel={`Paid ${usdx(s.due - (s.deficit ?? 0n))} of ${usdx(s.due)}`}
                  label={`${contractTitle(s.series)}. ${splitSentence(usdx(s.due), usdx(s.fromOwners), usdx(s.vaultPaid), (s.deficit ?? 0n) > 0n ? usdx(s.deficit) : null, QUOTE)}`}
                  segments={[
                    { id: 'owners', label: 'Writer margin', value: toChartNumber(s.fromOwners), valueLabel: usdx(s.fromOwners) },
                    { id: 'vault', label: 'Vault', value: toChartNumber(s.vaultPaid), valueLabel: usdx(s.vaultPaid) },
                    { id: 'deficit', label: 'Deficit', value: toChartNumber(s.deficit ?? 0n), valueLabel: usdx(s.deficit ?? 0n), kind: 'deficit' },
                  ]}
                />
              </figure>
            ))}
            <Footnote>Recorded at settlement by the contract. Writer margin includes takeover payments reserved for a book the vault owned.</Footnote>
          </div>
        ) : null}
      </Section>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Deposit to the vault"
        description="You provide capital to the backstop and receive shares of the vault."
        confirmLabel="Deposit to the vault"
        expectRefusal={pending}
        onConfirm={() =>
          void act({ label: 'LP deposit', done: 'Deposited to the vault' }, (opts) => client.lpDeposit(me, units, opts), (shares) => ({
            facts: [
              { label: 'Deposited', value: units },
              { label: 'Shares received', value: usdx(shares) },
            ],
          }))
        }
      >
        <KeyValue>
          <KeyValueItem label="Amount" marked>
            <Usdx v={units} unit figure="serif" />
          </KeyValueItem>
          <KeyValueItem label="Vault value now">
            <Usdx v={v.value} unit figure="serif" none="No value at this moment" />
          </KeyValueItem>
        </KeyValue>
        <p>{LP_LOCK_NOTE} The capital pays holders when a writer margin falls short, so it can be lost.</p>
        {pending ? (
          <Callout variant="warning" title="A settlement price is pending.">
            <p>
              {PRO_ERRORS[225].message} <span className={css.code}>{PRO_ERRORS[225].name} (225)</span>
            </p>
          </Callout>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
