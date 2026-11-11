import { Link as RouterLink } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { countOf, formatCountdown, formatUtc, secondsUntil } from '../../../core/format'
import { PRO_ERRORS } from '../../../core/pro/errors'
import { positionRows } from '../../../core/pro/phase'
import type { Phase, PositionRow } from '../../../core/pro/phase'
import { usePro } from '../../../data'
import { Button, Callout, EmptyNote, IconInfo, KeyValue, KeyValueItem, Link, Popover, Segmented, Tag, Timeline, useIsPhone } from '../../../ui'
import type { TagAppearance, TimelineItem } from '../../../ui'
import { AFTER_EXPIRY_STEPS, EARLY_EXERCISE_REFUSALS, REFUSAL_SHORT } from '../copy'
import { QUOTE, lots, usdx } from '../model/money'
import { contractTitle, partyName } from '../model/names'
import { oracleView, spanText } from '../model/oracle'
import { callPayout } from '../model/payout'
import { expiredSeries } from '../model/settlement'
import type { ExpiredSeries } from '../model/settlement'
import { ConfirmDialog } from '../parts/ConfirmDialog'
import { DeskTable } from '../parts/DeskTable'
import type { DeskColumn } from '../parts/DeskTable'
import { NoValue, Sub, Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import type { ResultView } from '../parts/marginUi'
import { Section } from '../parts/Section'
import { useLast } from '../parts/useLast'
import css from './PositionsScreen.module.css'

const PHASE_LOOK: Record<Phase, TagAppearance> = {
  live: 'live',
  exercised: 'done',
  'await-price': 'ended',
  settle: 'ended',
  'settle-vault': 'open',
  claim: 'open',
  claimed: 'done',
}

type Scope = 'yours' | 'all'

/** The refusals the model already points to for an early exercise. The contract decides; this only says what to expect. */
function expectedRefusals(row: PositionRow, exerciseOpen: boolean, writerBelow: boolean): number[] {
  const out: number[] = []
  if (row.settlesAtExpiry) out.push(226)
  if (!exerciseOpen) out.push(207)
  const spot = row.series?.snapshot?.spot
  if (spot !== undefined && row.series && spot <= row.series.strike) out.push(223)
  if (writerBelow && !row.settlesAtExpiry) out.push(224)
  return out
}

/** A refusal is a sentence first; the contract's name and number follow as a quiet reference. */
function RefusalLine({ code }: { code: number }) {
  return (
    <li>
      {PRO_ERRORS[code].message}{' '}
      <span className={css.code}>
        {PRO_ERRORS[code].name} ({code})
      </span>
    </li>
  )
}

/** "Not yet", "Paid 1,600.00", or "Paid 15,671.46 of 30,000.00, deficit 14,328.53": what the holder got. */
function settlementText(r: PositionRow): string {
  if (r.paid === null) return 'Not yet'
  const deficit = r.deficit ?? 0n
  if (deficit === 0n) return `Paid ${usdx(r.paid)}`
  return `Paid ${usdx(r.paid)} of ${usdx(r.paid + deficit)}, deficit ${usdx(deficit)}`
}

const settleWhat = (v: { due: bigint; fromOwner: bigint; shortfall: bigint }): ResultView => ({
  facts: [],
  split: {
    due: v.due,
    parts: [
      { id: 'owner', label: 'Writer margin', value: v.fromOwner },
      { id: 'vault', label: 'Passed to the vault', value: v.shortfall },
    ],
  },
})

const settleVaultWhat = (v: { shortfall: bigint; vaultPaid: bigint; deficit: bigint }): ResultView => ({
  facts: [],
  split: {
    due: v.shortfall,
    parts: [
      { id: 'vault', label: 'Vault', value: v.vaultPaid },
      { id: 'deficit', label: 'Deficit', value: v.deficit, kind: 'deficit' },
    ],
  },
})

/**
 * Every Margin position with the call that moves it on. While live: early exercise. After expiry, a block per
 * series carries the two calls anyone can make (settle the books, settle the series), and each row its claim.
 */
export function PositionsScreen() {
  const { client, model, me, simulated, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const [exercising, setExercising] = useState<PositionRow | null>(null)
  const [chosenScope, setScope] = useState<Scope | null>(null)
  const oracle = oracleView(model)
  const phone = useIsPhone()
  const rowButton = { size: phone ? 'md' : 'sm', fullWidth: phone } as const

  const all = useMemo(() => positionRows(model), [model])
  const isMine = (r: PositionRow) => me !== '' && (r.position.holder === me || r.position.bookOwner === me)
  const mine = all.filter(isMine)
  const scope: Scope = chosenScope ?? (mine.length > 0 ? 'yours' : 'all')
  const rows = scope === 'yours' ? mine : all
  // A series with nothing left to settle or claim, or with no position and no open book, has no block.
  const expired = expiredSeries(model).filter((e) => e.step !== 'done' && (e.positions > 0 || e.books.some((b) => !b.settled)))
  const writerBelow = (row: PositionRow) => (model.accounts.find((a) => a.id === row.position.bookOwner)?.cushion ?? 0n) < 0n

  const claim = (row: PositionRow) => {
    const p = row.position
    void act({ label: 'Claim', done: 'Claimed' }, (opts) => client.claim(p.holder, p.id, opts), (v): ResultView => ({
      facts: [],
      split: {
        due: v.due,
        parts: [
          { id: 'paid', label: 'Paid', value: v.paid },
          { id: 'deficit', label: 'Deficit', value: v.deficit, kind: 'deficit' },
        ],
      },
    }))
  }

  const exercise = (row: PositionRow) => {
    const p = row.position
    void act({ label: 'Early exercise', done: 'Exercised' }, (opts) => client.exercise(p.holder, p.id, opts), (v): ResultView => ({
      facts: [
        { label: 'Paid to the holder', value: v.due },
        { label: 'At the publisher price', value: v.spot },
      ],
    }))
  }

  const actionCell = (row: PositionRow) => {
    const p = row.position
    const a = row.action
    // Settling a book or a series is one call for many rows: it is made in the block above the table.
    if (!a || a.kind === 'settle' || a.kind === 'settle-vault') return row.waiting ? <span className={css.waiting}>{row.waiting}</span> : null
    if (!canAct) {
      return (
        <Button {...rowButton} onClick={connect}>
          Connect wallet
        </Button>
      )
    }
    const other = a.holderOnly && p.holder !== me
    // On the Testnet contract only the holder can make a holder call. In the replay any recorded step can be run.
    if (other && !simulated) return <span className={css.waiting}>Holder only</span>
    const name = `${a.label}, position ${p.id}${other ? `, as ${partyName(p.holder)}` : ''}`
    const expected = a.kind === 'exercise' ? expectedRefusals(row, oracle.exerciseOpen, writerBelow(row)) : []
    return (
      <span className={css.act}>
        <span className={css.actRow}>
          <Button {...rowButton} disabled={busy} aria-label={name} onClick={() => (a.kind === 'exercise' ? setExercising(row) : claim(row))}>
            {a.label}
          </Button>
          {other ? <span className={css.as}>as {partyName(p.holder)}</span> : null}
        </span>
        {expected.length > 0 ? (
          <span className={css.why}>
            {REFUSAL_SHORT[expected[0]]}
            {expected[0] === 224 ? (
              <>
                {' '}
                <Link render={<RouterLink to="/margin/liquidations" />}>Liquidations</Link>
              </>
            ) : null}
          </span>
        ) : null}
      </span>
    )
  }

  const columns: ReadonlyArray<DeskColumn<PositionRow>> = [
    {
      id: 'contract',
      header: 'Contract',
      rowHeader: true,
      phone: 'title',
      cell: (r) => (
        <>
          {contractTitle(r.series)} <Sub>Position {r.position.id}</Sub>
        </>
      ),
    },
    { id: 'qty', header: 'Quantity (lots)', numeric: true, cell: (r) => lots(r.position.qty) },
    { id: 'holder', header: 'Holder', cell: (r) => <Who id={r.position.holder} me={me} /> },
    {
      id: 'from',
      header: 'Paid from',
      cell: (r) => (
        <>
          {r.position.bookOwner ? <Who id={r.position.bookOwner} me={me} /> : <NoValue />}
          {r.settlesAtExpiry ? <span className={css.hint}>Settles at expiry</span> : null}
        </>
      ),
    },
    {
      id: 'left',
      header: 'Time left',
      cell: (r) => (r.series && model.now < r.series.expiry ? formatCountdown(secondsUntil(r.series.expiry, model.now)) : 'Expired'),
      phoneSkip: (r) => r.phase !== 'live',
    },
    {
      id: 'now',
      header: `If exercised now (${QUOTE})`,
      numeric: true,
      cell: (r) => {
        const s = r.series
        if (r.phase !== 'live' || !s?.snapshot) return <NoValue label={r.phase === 'live' ? 'No snapshot' : 'Not open'} />
        return <Usdx v={callPayout(r.position.qty, s.snapshot.spot, s.strike)} />
      },
      phoneSkip: (r) => r.phase !== 'live',
    },
    { id: 'settlement', header: 'Settlement', cell: (r) => <span className={css.wrap}>{settlementText(r)}</span> },
    { id: 'state', header: 'State', phone: 'aside', cell: (r) => <Tag state={r.state.label} appearance={PHASE_LOOK[r.phase]} /> },
    { id: 'action', header: 'Action', hideHeader: true, pinned: true, phone: 'actions', cell: actionCell },
  ]

  // The dialog keeps its content while it closes.
  const target = useLast(exercising)
  const expected = target ? expectedRefusals(target, oracle.exerciseOpen, writerBelow(target)) : []
  const snap = target?.series?.snapshot ?? null
  const pays = target && snap && target.series ? callPayout(target.position.qty, snap.spot, target.series.strike) : null
  const writerCash = target ? model.accounts.find((a) => a.id === target.position.bookOwner)?.cash : undefined

  return (
    <div className={css.root}>
      {expired.length > 0 ? (
        <Section title="After expiry" note={AFTER_EXPIRY_STEPS.anyone}>
          <div className={css.expired}>
            {expired.map((e) => (
              <SettleBlock key={e.series.id} e={e} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="Positions"
        aside={
          <>
            {me !== '' && all.length > 0 ? (
              <Segmented
                label="Positions shown"
                size="sm"
                value={scope}
                onValueChange={(v) => setScope(v)}
                options={[
                  { value: 'yours', label: 'Yours', count: mine.length },
                  { value: 'all', label: 'All', count: all.length },
                ]}
              />
            ) : all.length > 0 ? (
              <span>{countOf(all.length, { one: 'position', other: 'positions' })}</span>
            ) : null}
            <Popover
              title="When early exercise is refused"
              trigger={
                <Button size="sm" variant="quiet" iconStart={<IconInfo />}>
                  When early exercise is refused
                </Button>
              }
            >
              <ul className={css.reasons}>
                {EARLY_EXERCISE_REFUSALS.map((code) => (
                  <RefusalLine key={code} code={code} />
                ))}
              </ul>
            </Popover>
          </>
        }
      >
        <DeskTable
          caption="Margin positions"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.position.id}
          empty={
            all.length > 0 ? (
              <EmptyNote size="sm" title={`${partyName(me)} holds no position and wrote none that was bought.`} />
            ) : (
              <EmptyNote title="No position has been opened yet." action={<Link render={<RouterLink to="/margin/trade" />}>See the open offers</Link>} />
            )
          }
        />
      </Section>

      <ConfirmDialog
        open={exercising !== null}
        onClose={() => setExercising(null)}
        title="Exercise early"
        description={target ? `${contractTitle(target.series)}, ${lots(target.position.qty)} lots, held by ${partyName(target.position.holder)}.` : undefined}
        confirmLabel="Exercise early"
        expectRefusal={expected.length > 0}
        onConfirm={() => target && exercise(target)}
      >
        {target ? (
          <>
            <KeyValue>
              <KeyValueItem label="Publisher price" hint={snap && oracle.age !== null ? `Snapshot No. ${snap.seq}, ${spanText(oracle.age)} old` : undefined}>
                <Usdx v={snap?.spot} unit figure="serif" none="No snapshot" />
              </KeyValueItem>
              <KeyValueItem label="Strike">
                <Usdx v={target.series?.strike} unit figure="serif" />
              </KeyValueItem>
              <KeyValueItem label="You receive" hint={snap ? `At snapshot No. ${snap.seq}` : undefined} marked>
                <Usdx v={pays} unit figure="serif" none="No snapshot" />
              </KeyValueItem>
              <KeyValueItem label="Paid from">{target.position.bookOwner ? <Who id={target.position.bookOwner} me={me} length="medium" /> : <NoValue />}</KeyValueItem>
              <KeyValueItem label="Writer cash in the contract">
                <Usdx v={writerCash} unit figure="serif" none="Not available" />
              </KeyValueItem>
              <KeyValueItem label="Expiry">{target.series ? formatUtc(target.series.expiry) : <NoValue />}</KeyValueItem>
            </KeyValue>
            <p>The contract pays quantity times the publisher price over the strike at the snapshot current when the call runs, from the writer margin. An early exercise never draws on the vault.</p>
            {expected.length > 0 ? (
              <Callout variant="warning" title="As things stand, the contract will refuse this.">
                <ul className={css.reasons}>
                  {expected.map((code) => (
                    <RefusalLine key={code} code={code} />
                  ))}
                </ul>
              </Callout>
            ) : null}
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

/** One expired series: the three calls in order, where it stands, and the one call that applies now. */
function SettleBlock({ e }: { e: ExpiredSeries }) {
  const { client, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const title = contractTitle(e.series)
  const status = (mine: number): TimelineItem['status'] => {
    const order = { 'await-price': 0, 'settle-books': 0, 'settle-series': 1, claim: 2, done: 3 }[e.step]
    return order > mine ? 'done' : order === mine ? 'current' : 'upcoming'
  }
  const action = (node: ReactNode) => (canAct ? node : <Button size="sm" onClick={connect}>Connect wallet</Button>)

  const items: TimelineItem[] = [
    {
      title: AFTER_EXPIRY_STEPS.books,
      actor: 'Anyone',
      status: status(0),
      description:
        e.step === 'await-price' ? (
          <span>Waiting for the publisher&apos;s settlement price. Nothing can be settled until it is published.</span>
        ) : (
          <span className={css.stepLine}>
            <span>
              {e.booksSettled} of {e.books.length} settled
            </span>
            {e.step === 'settle-books' && e.nextBook
              ? action(
                  <Button
                    size="sm"
                    disabled={busy}
                    aria-label={`Settle book ${e.nextBook.id}, ${title}`}
                    onClick={() => void act({ label: 'Settle book', done: 'Book settled' }, (opts) => client.settle(e.nextBook!.id, opts), settleWhat)}
                  >
                    Settle book {e.nextBook.id}
                  </Button>,
                )
              : null}
          </span>
        ),
    },
    {
      title: AFTER_EXPIRY_STEPS.series,
      actor: 'Anyone',
      status: status(1),
      description:
        e.step === 'settle-series'
          ? action(
              <Button
                size="sm"
                disabled={busy}
                aria-label={`Settle series ${e.series.id}, ${title}`}
                onClick={() => void act({ label: 'Settle series', done: 'Series settled' }, (opts) => client.settleVault(e.series.id, opts), settleVaultWhat)}
              >
                Settle the series
              </Button>,
            )
          : undefined,
    },
    {
      title: AFTER_EXPIRY_STEPS.claims,
      actor: 'Each holder',
      status: status(2),
      description: e.positions > 0 ? `${e.claimed} of ${e.positions} claimed. Claim is in each position's row.` : undefined,
    },
  ]

  return (
    <div className={css.block}>
      <h3 className={css.blockTitle}>
        {title} <Sub>Series {e.series.id}</Sub>
      </h3>
      <Timeline label={`Settlement of ${title}`} items={items} />
    </div>
  )
}
