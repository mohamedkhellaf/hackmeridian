import { useState } from 'react'
import { countOf } from '../../../core/format'
import { PRO_ERRORS, proErrorName } from '../../../core/pro/errors'
import type { AccountView } from '../../../core/pro/types'
import { usePro } from '../../../data'
import { Button, Callout, EmptyNote, KeyValue, KeyValueItem, useIsPhone } from '../../../ui'
import { HealthBar } from '../../../viz'
import { NO_VALUE_NOTE } from '../copy'
import { HEALTH_WORD, healthOf } from '../model/health'
import { QUOTE, lots, toChartNumber, usdx } from '../model/money'
import { contractName, partyName } from '../model/names'
import { takeovers } from '../model/settlement'
import type { Takeover } from '../model/settlement'
import { ConfirmDialog } from '../parts/ConfirmDialog'
import { DeskTable } from '../parts/DeskTable'
import type { DeskColumn } from '../parts/DeskTable'
import { NoValue, Usdx, Who } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import type { ResultFact } from '../parts/marginUi'
import { Footnote, Section } from '../parts/Section'
import { useLast } from '../parts/useLast'
import css from './LiquidationsScreen.module.css'

type Mode = 'vault' | 'private'

const isBelow = (a: AccountView) => a.cushion !== null && a.cushion < 0n

/**
 * Writers and their distance to the liquidation level. An account below it can be taken over: by the vault
 * (anyone can make that call) or privately, onto the caller's own margin. The log keeps the price of each
 * takeover and any shortfall.
 */
export function LiquidationsScreen() {
  const { client, model, me, simulated, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const [taking, setTaking] = useState<{ account: AccountView; mode: Mode } | null>(null)
  const shown = useLast(taking)
  // Row actions are 28 px on a desk and full touch height, full width, in the phone list.
  const phone = useIsPhone()
  const row = { size: phone ? 'md' : 'sm', fullWidth: phone } as const

  const writers = model.accounts
    .filter((a) => a.shorts.length > 0 || a.requirement)
    .sort((a, b) => Number(isBelow(b)) - Number(isBelow(a)))
  const below = writers.filter(isBelow)
  const log = takeovers(model.history)
  const seriesOf = (id: number) => model.series.find((s) => s.id === id)
  const shortsText = (a: AccountView) => (a.shorts.length === 0 ? 'None' : a.shorts.map((s) => `${lots(s.qty)} lots, ${contractName(seriesOf(s.seriesId))}`).join('; '))

  const takeOver = (account: AccountView, mode: Mode) => {
    const what = mode === 'vault' ? { label: 'Take over to the vault', done: 'Taken over by the vault' } : { label: 'Private takeover', done: 'Taken over privately' }
    void act(what, (opts) => client.liquidate(me, account.id, mode === 'vault' ? null : me, opts), (v): ResultFact[] => [
      { label: 'Takeover price', value: v.x },
      { label: 'Paid by the account', value: v.paid },
      { label: 'Shortfall, now its debt to the vault', value: v.deficit, loss: v.deficit > 0n },
    ])
  }

  const accountColumns: ReadonlyArray<DeskColumn<AccountView>> = [
    { id: 'account', header: 'Account', rowHeader: true, phone: 'title', cell: (a) => <Who id={a.id} me={me} /> },
    { id: 'shorts', header: 'Short calls', cell: shortsText },
    { id: 'nlv', header: `Account value (${QUOTE})`, numeric: true, cell: (a) => <Usdx v={a.requirement?.nlv} /> },
    { id: 'mm', header: `Liquidation level (${QUOTE})`, numeric: true, cell: (a) => <Usdx v={a.requirement?.mm} /> },
    { id: 'distance', header: `Distance (${QUOTE})`, numeric: true, cell: (a) => <Usdx v={a.cushion} tone={isBelow(a) ? 'loss' : undefined} /> },
    {
      id: 'health',
      header: 'Health',
      phone: 'aside',
      cell: (a) => {
        const h = healthOf(a.requirement)
        const req = a.requirement
        return (
          <span className={css.health} data-state={h.state}>
            {req ? (
              <HealthBar
                variant="compact"
                nlv={toChartNumber(req.nlv)}
                mm={toChartNumber(req.mm)}
                im={toChartNumber(req.im)}
                nlvLabel={`Account value ${usdx(req.nlv)}`}
                mmLabel={`Liquidation level ${usdx(req.mm)}`}
                imLabel={`Opening requirement ${usdx(req.im)}`}
                stateLabel={HEALTH_WORD[h.state]}
              />
            ) : null}
            <span className={css.word}>{HEALTH_WORD[h.state]}</span>
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      hideHeader: true,
      pinned: true,
      phone: 'actions',
      cell: (a) => {
        if (a.shorts.length === 0) return <span className={css.muted}>No short calls</span>
        if (!canAct) {
          return (
            <Button {...row} onClick={connect}>
              Connect wallet
            </Button>
          )
        }
        const own = a.id === me
        return (
          <span className={css.actions}>
            <Button {...row} variant={isBelow(a) ? 'primary' : 'secondary'} disabled={busy} aria-label={`Take over to the vault: ${partyName(a.id)}`} onClick={() => setTaking({ account: a, mode: 'vault' })}>
              Take over to the vault
            </Button>
            <Button
              {...row}
              disabled={own || busy}
              disabledReason={own ? (simulated ? 'You cannot take over your own account. Act as another writer in the replay.' : 'You cannot take over your own account.') : undefined}
              aria-label={`Private takeover: ${partyName(a.id)}`}
              onClick={() => setTaking({ account: a, mode: 'private' })}
            >
              Private takeover
            </Button>
          </span>
        )
      },
    },
  ]

  const logColumns: ReadonlyArray<DeskColumn<Takeover>> = [
    { id: 'step', header: simulated ? 'Step' : 'Call', numeric: true, cell: (t) => t.index + 1 },
    { id: 'writer', header: 'Account', rowHeader: true, phone: 'title', cell: (t) => <Who id={t.writer} me={me} /> },
    { id: 'taker', header: 'Taken over by', cell: (t) => <Who id={t.taker} me={me} /> },
    { id: 'price', header: `Takeover price (${QUOTE})`, numeric: true, cell: (t) => <Usdx v={t.price} none="Refused" />, phoneSkip: (t) => !t.ok },
    { id: 'paid', header: `Paid by the account (${QUOTE})`, numeric: true, cell: (t) => <Usdx v={t.paid} none="Refused" />, phoneSkip: (t) => !t.ok },
    { id: 'deficit', header: `Shortfall (${QUOTE})`, numeric: true, cell: (t) => <Usdx v={t.deficit} tone="loss" none="Refused" />, phoneSkip: (t) => !t.ok },
    {
      id: 'result',
      header: 'Result',
      phone: 'aside',
      cell: (t) => (t.ok ? 'Done' : <span className={css.refused}>Refused: {proErrorName(t.code ?? 0)} ({t.code ?? 0})</span>),
    },
  ]

  const account = shown?.account
  const mode = shown?.mode ?? 'vault'
  const notBelow = account ? account.cushion !== null && account.cushion >= 0n : false

  return (
    <div className={css.root}>
      <Section
        title="Accounts"
        note={
          writers.length === 0
            ? undefined
            : below.length === 0
              ? 'No account is below its liquidation level.'
              : `${countOf(below.length, { one: 'account is', other: 'accounts are' })} below the liquidation level and can be taken over.`
        }
      >
        <DeskTable
          caption="Margin accounts and their distance to liquidation"
          columns={accountColumns}
          rows={writers}
          rowKey={(a) => a.id}
          empty={<EmptyNote size="sm" title="No margin account has a short call." hint="An account is listed here once it has written a call." />}
        />
        {writers.some((a) => !a.requirement) ? <Footnote>{NO_VALUE_NOTE}</Footnote> : null}
        {!simulated ? <Footnote>The contract has no list of accounts. This table shows the accounts that appear in offers, positions and books, and the connected wallet.</Footnote> : null}
      </Section>

      <Section title="Takeovers" note={simulated ? undefined : 'Takeovers made from this browser. The contract keeps no history of them.'}>
        <DeskTable
          caption="Takeovers"
          columns={logColumns}
          rows={log}
          rowKey={(t) => t.index}
          empty={<EmptyNote size="sm" title="No takeover has been made." hint="Each one is listed here with its price and any shortfall." />}
        />
      </Section>

      <ConfirmDialog
        open={taking !== null}
        onClose={() => setTaking(null)}
        destructive
        title={mode === 'vault' ? 'Take over to the vault' : 'Private takeover'}
        description={account ? `${partyName(account.id)}: ${shortsText(account)}.` : undefined}
        confirmLabel={mode === 'vault' ? 'Take over to the vault' : 'Take over privately'}
        onConfirm={() => account && takeOver(account, mode)}
      >
        {account ? (
          <>
            <KeyValue>
              <KeyValueItem label="Account value (NLV)">{account.requirement ? `${usdx(account.requirement.nlv)} ${QUOTE}` : <NoValue />}</KeyValueItem>
              <KeyValueItem label="Liquidation level (MM)">{account.requirement ? `${usdx(account.requirement.mm)} ${QUOTE}` : <NoValue />}</KeyValueItem>
              <KeyValueItem label="Distance">
                <Usdx v={account.cushion} unit tone={isBelow(account) ? 'loss' : undefined} figure="serif" />
              </KeyValueItem>
              <KeyValueItem label="Cash in the contract">
                <Usdx v={account.cash} unit figure="serif" />
              </KeyValueItem>
              <KeyValueItem label="Taken over by">{mode === 'vault' ? 'The vault' : <Who id={me} me={me} length="medium" />}</KeyValueItem>
            </KeyValue>
            {mode === 'vault' ? (
              <p>
                The vault takes every short call of this account at the takeover price the contract sets from the latest snapshot. The account pays that price from its cash; what it cannot pay becomes
                its debt to the vault. Anyone can make this call.
              </p>
            ) : (
              <p>
                You take every short call of this account onto your own margin and receive the takeover price from its cash. The contract refuses if the account cannot pay the price in full (
                {PRO_ERRORS[218].name}, 218), or if your account value would end under your opening requirement.
              </p>
            )}
            <p>The price, what was paid and any shortfall are in the result and in the takeovers list.</p>
            {notBelow ? (
              <Callout variant="warning" label="Expect a refusal" title="This account is not below its liquidation level.">
                <p>
                  {PRO_ERRORS[211].name} (211). {PRO_ERRORS[211].message}
                </p>
              </Callout>
            ) : null}
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
