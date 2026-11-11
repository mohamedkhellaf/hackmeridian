import { Link as RouterLink } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { countOf, formatUtc } from '../../../core/format'
import { PRO_ERRORS } from '../../../core/pro/errors'
import { positionRows } from '../../../core/pro/phase'
import type { Phase, PositionRow } from '../../../core/pro/phase'
import { usePro } from '../../../data'
import { Button, Callout, EmptyNote, IconInfo, KeyValue, KeyValueItem, Link, Popover, Tag, useIsPhone } from '../../../ui'
import type { TagAppearance } from '../../../ui'
import { AFTER_EXPIRY_NOTE, EARLY_EXERCISE_REFUSALS, NO_VALUE_NOTE } from '../copy'
import { QUOTE, lots, usdx } from '../model/money'
import { contractName, partyName } from '../model/names'
import { oracleView, spanText } from '../model/oracle'
import { ConfirmDialog } from '../parts/ConfirmDialog'
import { DeskTable } from '../parts/DeskTable'
import type { DeskColumn } from '../parts/DeskTable'
import { NoValue, Sub, Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import type { ResultFact } from '../parts/marginUi'
import { Footnote, Section } from '../parts/Section'
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

const refusal = (code: number) => `${PRO_ERRORS[code].name} (${code})`

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

/**
 * Every Margin position with the one call that moves it on: early exercise while it is live; after expiry,
 * settle the book, settle the series, then claim. What was due, what was paid and any deficit stay on the row.
 */
export function PositionsScreen() {
  const { client, model, me, simulated, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const [exercising, setExercising] = useState<PositionRow | null>(null)
  const oracle = oracleView(model)
  const phone = useIsPhone()
  const rowButton = { size: phone ? 'md' : 'sm', fullWidth: phone } as const

  const rows = useMemo(() => {
    const mine = (r: PositionRow) => (me !== '' && (r.position.holder === me || r.position.bookOwner === me) ? 1 : 0)
    return [...positionRows(model)].sort((a, b) => mine(b) - mine(a))
  }, [model, me])

  const run = (row: PositionRow) => {
    const p = row.position
    const a = row.action
    if (!a) return
    const what = { label: a.runLabel, done: a.done }
    if (a.kind === 'settle') {
      void act(what, (opts) => client.settle(p.book, opts), (v): ResultFact[] => [
        { label: 'Owed by the book', value: v.due },
        { label: 'Paid from the owner margin', value: v.fromOwner },
        { label: 'Shortfall, passed to the vault', value: v.shortfall, loss: v.shortfall > 0n },
      ])
    } else if (a.kind === 'settle-vault') {
      void act(what, (opts) => client.settleVault(p.seriesId, opts), (v): ResultFact[] => [
        { label: 'Shortfall of the series', value: v.shortfall },
        { label: 'Paid by the vault', value: v.vaultPaid },
        { label: 'Deficit', value: v.deficit, loss: v.deficit > 0n },
      ])
    } else if (a.kind === 'claim') {
      void act(what, (opts) => client.claim(p.holder, p.id, opts), (v): ResultFact[] => [
        { label: 'Due', value: v.due },
        { label: 'Paid', value: v.paid },
        { label: 'Deficit', value: v.deficit, loss: v.deficit > 0n },
      ])
    }
  }

  const exercise = (row: PositionRow) => {
    const p = row.position
    void act({ label: 'Early exercise', done: 'Exercised' }, (opts) => client.exercise(p.holder, p.id, opts), (v): ResultFact[] => [
      { label: 'Paid to the holder', value: v.due },
      { label: 'At the publisher price', value: v.spot },
    ])
  }

  const actionCell = (row: PositionRow) => {
    const p = row.position
    const a = row.action
    if (!a) return row.waiting ? <span className={css.waiting}>{row.waiting}</span> : null
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
    return (
      <span className={css.act}>
        <Button {...rowButton} disabled={busy} aria-label={name} onClick={() => (a.kind === 'exercise' ? setExercising(row) : run(row))}>
          {a.label}
        </Button>
        {other ? <span className={css.as}>as {partyName(p.holder)}</span> : null}
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
          {contractName(r.series)} <Sub>Position {r.position.id}</Sub>
        </>
      ),
    },
    { id: 'qty', header: 'Quantity (lots)', numeric: true, cell: (r) => lots(r.position.qty) },
    { id: 'holder', header: 'Holder', cell: (r) => <Who id={r.position.holder} me={me} /> },
    {
      id: 'book',
      header: 'Writer book',
      cell: (r) => (
        <>
          {r.position.bookOwner ? <Who id={r.position.bookOwner} me={me} /> : <NoValue />}
          {r.settlesAtExpiry ? <span className={css.hint}>, settles at expiry</span> : null}
        </>
      ),
    },
    { id: 'due', header: `Due (${QUOTE})`, numeric: true, cell: (r) => <Usdx v={r.due} none="Known once claimed" />, phoneSkip: (r) => r.due === null },
    { id: 'paid', header: `Paid (${QUOTE})`, numeric: true, cell: (r) => <Usdx v={r.paid} none="Nothing paid yet" />, phoneSkip: (r) => r.paid === null },
    { id: 'deficit', header: `Deficit (${QUOTE})`, numeric: true, cell: (r) => <Usdx v={r.deficit} tone="loss" none="None recorded yet" />, phoneSkip: (r) => r.deficit === null },
    { id: 'state', header: 'State', phone: 'aside', cell: (r) => <Tag state={r.state.label} appearance={PHASE_LOOK[r.phase]} /> },
    { id: 'action', header: 'Action', hideHeader: true, pinned: true, phone: 'actions', cell: actionCell },
  ]

  // The dialog keeps its content while it closes.
  const target = useLast(exercising)
  const expected = target ? expectedRefusals(target, oracle.exerciseOpen, (model.accounts.find((a) => a.id === target.position.bookOwner)?.cushion ?? 0n) < 0n) : []
  const snap = target?.series?.snapshot ?? null

  return (
    <div className={css.root}>
      <Section
        title="Positions"
        aside={
          <>
            {rows.length > 0 ? <span>{countOf(rows.length, { one: 'position', other: 'positions' })}</span> : null}
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
                  <li key={code}>
                    <span className={css.code}>{refusal(code)}</span> {PRO_ERRORS[code].message}
                  </li>
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
            <EmptyNote
              title="No position has been opened yet."
              hint="A position appears here when someone buys an offer."
              action={<Link render={<RouterLink to="/margin/trade" />}>See the open offers</Link>}
            />
          }
        />
        {rows.length > 0 ? (
          <>
            <Footnote>{AFTER_EXPIRY_NOTE}</Footnote>
            <Footnote>{NO_VALUE_NOTE}</Footnote>
          </>
        ) : null}
      </Section>

      <ConfirmDialog
        open={exercising !== null}
        onClose={() => setExercising(null)}
        title="Exercise early"
        description={target ? `${contractName(target.series)}, ${lots(target.position.qty)} lots, held by ${partyName(target.position.holder)}.` : undefined}
        confirmLabel="Exercise early"
        onConfirm={() => target && exercise(target)}
      >
        {target ? (
          <>
            <KeyValue>
              <KeyValueItem label="Publisher price" hint={snap && oracle.age !== null ? `Snapshot No. ${snap.seq}, ${spanText(oracle.age)} old` : undefined}>
                {snap ? `${usdx(snap.spot)} ${QUOTE}` : <NoValue label="No snapshot" />}
              </KeyValueItem>
              <KeyValueItem label="Strike">{target.series ? `${usdx(target.series.strike)} ${QUOTE}` : <NoValue />}</KeyValueItem>
              <KeyValueItem label="Expiry">{target.series ? formatUtc(target.series.expiry) : <NoValue />}</KeyValueItem>
              <KeyValueItem label="Paid from">{target.position.bookOwner ? <Who id={target.position.bookOwner} me={me} length="medium" /> : <NoValue />}</KeyValueItem>
            </KeyValue>
            <p>
              The contract pays the quantity times the publisher price over the strike, in {QUOTE}, from the writer margin, and the position ends. The amount is in the result. An early exercise never
              draws on the vault.
            </p>
            {expected.length > 0 ? (
              <Callout variant="warning" label="Expect a refusal" title="As things stand, the contract will refuse this.">
                <ul>
                  {expected.map((code) => (
                    <li key={code}>
                      <span className={css.code}>{refusal(code)}</span> {PRO_ERRORS[code].message}
                    </li>
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
