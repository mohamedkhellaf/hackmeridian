import { Link as RouterLink } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { usePro } from '../../../data'
import { AmountField, Button, Callout, Card, EmptyNote, IconInfo, KeyValue, KeyValueItem, Link, Popover, useIsPhone } from '../../../ui'
import { HealthBar } from '../../../viz'
import { AMOUNT_ERROR } from '../copy'
import { HEALTH_WORD, healthLead, healthNext, healthOf } from '../model/health'
import { QUOTE, lots, toChartNumber, usdx, usdxExact, usdxInput, withUnit } from '../model/money'
import { contractTitle, isAddress, partyName, runsFirstText } from '../model/names'
import { oracleView } from '../model/oracle'
import { parseUsdx } from '../model/write'
import { Usdx } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import { RecordedField } from '../parts/RecordedField'
import { useReplayable } from '../parts/useReplayable'
import type { RecordedStep } from '../parts/useReplayable'
import css from './AccountScreen.module.css'

/** The amount argument of a recorded deposit or withdrawal, in exact units. */
const stepAmount = (step: RecordedStep): bigint => BigInt(step.args[1] as number)

/** Of two recorded steps, the one the replay reaches first. */
const earliest = (a: RecordedStep | null, b: RecordedStep | null): RecordedStep | null => (a && b ? (a.number < b.number ? a : b) : (a ?? b))

/** What the three requirement figures are. Behind one button: the labels already carry the standard names. */
const DEFINITIONS: readonly { term: string; text: string }[] = [
  { term: 'Account value (NLV)', text: 'Cash less the short calls at the latest mark.' },
  { term: 'Liquidation level (MM)', text: 'The maintenance margin. Below it, anyone can take the account over.' },
  { term: 'Opening requirement (IM)', text: 'The initial margin, needed before a new call can be sold.' },
]

/**
 * The margin account of the acting account: where it stands against the liquidation level (the lead line and
 * the bar), the three requirement figures, what is in the contract, and deposit and withdraw in the rail.
 */
export function AccountScreen() {
  const { client, model, me, simulated, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const replay = useReplayable()
  const phone = useIsPhone()
  const [amount, setAmount] = useState('')
  const amountRef = useRef<HTMLInputElement | null>(null)

  if (!canAct) {
    return (
      <EmptyNote
        title="Connect a wallet to see your margin account."
        headingLevel={2}
        hint="Series, offers, positions, liquidations and the vault can be read without one."
        action={
          <Button variant="primary" onClick={connect}>
            Connect wallet
          </Button>
        }
      />
    )
  }

  const account = model.accounts.find((a) => a.id === me)
  // Nothing posted, nothing written, nothing owed: there is no health to show yet.
  const untouched = !account || (account.cash === 0n && account.owed === 0n && account.shorts.length === 0)
  const req = untouched ? null : (account?.requirement ?? null)
  const health = healthOf(req)
  const next = healthNext(health)
  const wallet = model.wallets[me]
  const who = isAddress(me) ? 'This account' : partyName(me)
  // Fixtures: the field holds the amount of the step a press replays, locked; the action whose step comes later
  // waits for it (ruling F11). On the contract the amount is typed and sent as typed.
  const nextDeposit = replay.next('deposit', (args) => args[0] === me)
  const nextWithdraw = replay.next('withdraw', (args) => args[0] === me)
  const recorded = simulated ? earliest(nextDeposit, nextWithdraw) : null
  const units = simulated ? (recorded ? stepAmount(recorded) : 0n) : (parseUsdx(amount) ?? 0n)
  const valid = units > 0n
  const tooMuch = !simulated && valid && wallet !== undefined && units > wallet
  const blocked = account?.withdrawBlocked ?? false
  const amountReason = valid ? undefined : 'Enter an amount first.'
  const canDeposit = simulated ? recorded?.op === 'deposit' : true
  const canWithdraw = simulated ? recorded?.op === 'withdraw' : true
  /** Why a replayed action waits: no later step of its kind, or another step of this account comes first. */
  const waitReason = (mine: RecordedStep | null, kind: string, other: string) =>
    !mine ? replay.reason(`${kind} by ${partyName(me)}`) : `Step ${recorded?.number}, a ${other}, comes first. The next ${kind} is step ${mine.number}.`
  const fieldHint = simulated
    ? recorded
      ? `Recorded amount for step ${recorded.number}. ${runsFirstText(recorded.before)}`.trim()
      : replay.reason(`deposit or withdrawal by ${partyName(me)}`)
    : undefined
  const describe = (_: null, step: { args: unknown[] } | null) => ({ facts: [{ label: 'Amount', value: step ? BigInt(step.args[1] as number) : units }] })
  // Fixtures: where the scenario next records this account's requirement, said in place of the empty figures.
  const recordedAt = replay.requirementAt(me)
  const noRequirement = simulated
    ? recordedAt !== null
      ? `The scenario records ${partyName(me)}'s margin requirement at step ${recordedAt}.`
      : `The scenario records no margin requirement for ${partyName(me)} after step ${replay.position}.`
    : healthLead(health)
  // The expired series of this account that still wait for the publisher's settlement price.
  const waiting = oracleView(model).pending.filter((s) => account?.shorts.some((x) => x.seriesId === s.id))

  const prefill = () => {
    setAmount(usdxInput(health.distance))
    amountRef.current?.focus()
  }

  return (
    <div className={css.root}>
      <section className={css.requirement} aria-label="Margin requirement">
        {untouched ? (
          <EmptyNote headingLevel={2} title={`${who} has no margin posted yet.`} hint="A first deposit opens the account. A call can be written once the account holds its opening requirement." />
        ) : !req ? (
          <p className={css.lead} data-state="unknown">
            {noRequirement}
          </p>
        ) : (
          <>
            <p className={css.lead} data-state={health.state}>
              {healthLead(health)}
            </p>
            <HealthBar
              nlv={toChartNumber(req.nlv)}
              mm={toChartNumber(req.mm)}
              im={toChartNumber(req.im)}
              nlvLabel={`Account value ${usdx(req.nlv)}`}
              mmLabel={`Liquidation (MM) ${usdx(req.mm)}`}
              imLabel={`Opening (IM) ${usdx(req.im)}`}
              mmShortLabel={`MM ${usdx(req.mm)}`}
              imShortLabel={`IM ${usdx(req.im)}`}
              stateLabel={HEALTH_WORD[health.state]}
              status={next ?? undefined}
            />
            {health.state === 'liquidatable' && !simulated ? (
              <div>
                <Button size="sm" onClick={prefill}>
                  Fill in {withUnit(usdxExact(health.distance))}
                </Button>
              </div>
            ) : null}
            <div className={css.figures}>
              <KeyValue variant={phone ? 'ruled' : 'plain'} layout={phone ? 'row' : 'stacked'} className={phone ? undefined : css.figureRow}>
                <KeyValueItem label="Account value (NLV)">
                  <Usdx v={req.nlv} unit figure="serif" />
                </KeyValueItem>
                <KeyValueItem label="Liquidation level (MM)">
                  <Usdx v={req.mm} unit figure="serif" />
                </KeyValueItem>
                <KeyValueItem label="Opening requirement (IM)">
                  <Usdx v={req.im} unit figure="serif" />
                </KeyValueItem>
              </KeyValue>
              <Popover
                title="The three figures"
                trigger={
                  <Button size="sm" variant="quiet" iconStart={<IconInfo />}>
                    What these figures are
                  </Button>
                }
              >
                <dl className={css.definitions}>
                  {DEFINITIONS.map((d) => (
                    <div key={d.term}>
                      <dt>{d.term}</dt>
                      <dd>{d.text}</dd>
                    </div>
                  ))}
                </dl>
              </Popover>
            </div>
          </>
        )}
      </section>

      {account ? (
        <Card title="In the contract" headingLevel={2} className={css.facts}>
          <KeyValue>
            <KeyValueItem label="Cash in the contract">
              <Usdx v={account.cash} unit figure="serif" />
            </KeyValueItem>
            <KeyValueItem label="Owed to the vault" hint={account.owed > 0n ? 'A takeover shortfall. It is collected from your free cash before any withdrawal.' : undefined}>
              <Usdx v={account.owed} unit figure="serif" tone="loss" />
            </KeyValueItem>
            <KeyValueItem label={simulated ? `In ${partyName(me)}'s wallet` : 'In your wallet'}>
              {wallet !== undefined ? <Usdx v={wallet} unit figure="serif" /> : <Usdx v={null} none="Not read" />}
            </KeyValueItem>
            <KeyValueItem label="Short calls">
              {account.shorts.length === 0 ? (
                'None'
              ) : (
                <span className={css.shorts}>
                  {account.shorts.map((s) => (
                    <span key={s.seriesId}>
                      {lots(s.qty)} lots, {contractTitle(model.series.find((x) => x.id === s.seriesId))}
                    </span>
                  ))}
                </span>
              )}
            </KeyValueItem>
          </KeyValue>
        </Card>
      ) : null}

      <Card title="Deposit or withdraw" headingLevel={2} className={css.form}>
        {simulated ? (
          <RecordedField
            label="Amount"
            unit={QUOTE}
            value={recorded ? usdxInput(units) : ''}
            aside={wallet !== undefined ? `Wallet ${withUnit(usdx(wallet))}` : undefined}
            hint={fieldHint}
          />
        ) : (
          <AmountField
            label="Amount"
            unit={QUOTE}
            decimals={7}
            value={amount}
            onValueChange={setAmount}
            inputRef={amountRef}
            aside={wallet !== undefined ? `Wallet ${withUnit(usdx(wallet))}` : undefined}
            validate={(v) => (v.trim() === '' || (parseUsdx(v) ?? 0n) > 0n ? undefined : AMOUNT_ERROR)}
            error={tooMuch ? `Your wallet has ${withUnit(usdx(wallet))}; this deposit needs ${withUnit(usdxExact(units))}. Lower the amount.` : undefined}
          />
        )}
        <div className={css.actions} data-recorded={simulated && recorded ? true : undefined}>
          <Button
            variant="primary"
            disabled={!canDeposit || !valid || tooMuch || busy}
            disabledReason={
              simulated && !canDeposit
                ? waitReason(nextDeposit, 'deposit', 'withdrawal')
                : (amountReason ?? (tooMuch ? 'The amount is more than the wallet holds.' : undefined))
            }
            onClick={() => void act({ label: 'Deposit', done: 'Deposited' }, (opts) => client.deposit(me, units, opts), describe)}
          >
            {simulated && canDeposit ? `Deposit ${withUnit(usdx(units))}` : 'Deposit'}
          </Button>
          <Button
            disabled={!canWithdraw || !valid || blocked || busy}
            disabledReason={
              blocked ? 'Blocked while an expired position is not settled.' : simulated && !canWithdraw ? waitReason(nextWithdraw, 'withdrawal', 'deposit') : amountReason
            }
            onClick={() => void act({ label: 'Withdraw', done: 'Withdrawn' }, (opts) => client.withdraw(me, units, opts), describe)}
          >
            {simulated && canWithdraw ? `Withdraw ${withUnit(usdx(units))}` : 'Withdraw'}
          </Button>
        </div>
        {blocked ? (
          <Callout variant="warning" title="Withdrawals are blocked: an expired position is not settled yet.">
            <p>
              The contract refuses a withdrawal until every expired short call of this account is settled (SeriesExpired, 205).{' '}
              {waiting.length > 0 ? (
                <>
                  Waiting for the publisher&apos;s settlement price for series {waiting.map((s) => s.id).join(', ')}: nothing can be settled until it is published.
                </>
              ) : (
                <>
                  Settle it on <Link render={<RouterLink to="/margin/positions" />}>Positions</Link>.
                </>
              )}
            </p>
          </Callout>
        ) : (
          <p className={css.muted}>A withdrawal is refused if it would leave the account value under the opening requirement.</p>
        )}
      </Card>
    </div>
  )
}
