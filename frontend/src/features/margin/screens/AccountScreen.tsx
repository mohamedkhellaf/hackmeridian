import { Link as RouterLink } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { usePro } from '../../../data'
import { AmountField, Button, Callout, Card, EmptyNote, KeyValue, KeyValueItem, Link, Stat } from '../../../ui'
import { HealthBar } from '../../../viz'
import { AMOUNT_ERROR, NO_VALUE_NOTE, REPLAY_NOTE } from '../copy'
import { HEALTH_WORD, healthOf, healthSentence } from '../model/health'
import { QUOTE, lots, toChartNumber, usdx, usdxExact, usdxInput } from '../model/money'
import { contractTitle, isAddress, partyName } from '../model/names'
import { parseUsdx } from '../model/write'
import { Usdx } from '../parts/figures'
import { useMarginUi } from '../parts/marginUi'
import { Footnote } from '../parts/Section'
import css from './AccountScreen.module.css'

/**
 * The margin account of the acting account: account value against the liquidation level and the opening
 * requirement, the distance in words, what is owed to the vault, and deposit and withdraw.
 */
export function AccountScreen() {
  const { client, model, me, simulated, busy } = usePro()
  const { act, canAct, connect } = useMarginUi()
  const [amount, setAmount] = useState('')
  const amountRef = useRef<HTMLInputElement | null>(null)

  if (!canAct) {
    return (
      <EmptyNote
        title="Connect a wallet to see your margin account."
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
  const wallet = model.wallets[me]
  const units = parseUsdx(amount) ?? 0n
  const valid = units > 0n
  const tooMuch = !simulated && valid && wallet !== undefined && units > wallet
  const blocked = account?.withdrawBlocked ?? false
  const amountReason = valid ? undefined : 'Enter an amount first.'
  const who = isAddress(me) ? 'This account' : partyName(me)

  const prefill = () => {
    setAmount(usdxInput(health.distance))
    amountRef.current?.focus()
  }

  return (
    <div className={css.root}>
      <section className={css.requirement} aria-label="Margin requirement">
        {untouched ? (
          <EmptyNote title={`${who} has no margin posted yet.`} hint="A first deposit opens the account. A call can be written once the account holds its opening requirement." />
        ) : (
          <>
            <div className={css.figures}>
              <Stat size="lg" label="Account value (NLV)" value={<Usdx v={req?.nlv} none="No value at this moment" />} unit={req ? QUOTE : undefined} hint="Cash less the short calls at the latest mark." />
              <Stat
                size="lg"
                label="Liquidation level (MM)"
                value={<Usdx v={req?.mm} none="No value at this moment" />}
                unit={req ? QUOTE : undefined}
                hint="The maintenance margin. Below it, anyone can take the account over."
              />
              <Stat
                size="lg"
                label="Opening requirement (IM)"
                value={<Usdx v={req?.im} none="No value at this moment" />}
                unit={req ? QUOTE : undefined}
                hint="The initial margin, needed before a new call can be sold."
              />
            </div>
            <HealthBar
              className={css.health}
              nlv={req ? toChartNumber(req.nlv) : Number.NaN}
              mm={req ? toChartNumber(req.mm) : Number.NaN}
              im={req ? toChartNumber(req.im) : Number.NaN}
              nlvLabel={req ? `Account value ${usdx(req.nlv)}` : 'Account value not available'}
              mmLabel={req ? `Liquidation (MM) ${usdx(req.mm)}` : 'Liquidation level not available'}
              imLabel={req ? `Opening (IM) ${usdx(req.im)}` : 'Opening requirement not available'}
              mmShortLabel={req ? `MM ${usdx(req.mm)}` : undefined}
              imShortLabel={req ? `IM ${usdx(req.im)}` : undefined}
              stateLabel={HEALTH_WORD[health.state]}
              status={healthSentence(health, simulated)}
            />
            {health.state === 'liquidatable' ? (
              <div className={css.restore}>
                <Button size="sm" onClick={prefill}>
                  Fill in {usdxExact(health.distance)} {QUOTE}
                </Button>
                <span className={css.restoreNote}>Puts that amount in the deposit field. Nothing is sent.</span>
              </div>
            ) : null}
            {!req ? <Footnote>{NO_VALUE_NOTE}</Footnote> : null}
          </>
        )}
      </section>

      {account ? (
        <Card title="In the contract" headingLevel={2} className={css.facts}>
          <KeyValue>
            <KeyValueItem label="Cash in the contract">
              <Usdx v={account.cash} unit />
            </KeyValueItem>
            <KeyValueItem label="Owed to the vault" hint={account.owed > 0n ? 'A takeover shortfall. It is collected from your free cash before any withdrawal.' : undefined}>
              <Usdx v={account.owed} unit tone="loss" />
            </KeyValueItem>
            <KeyValueItem label="In your wallet">{wallet !== undefined ? <Usdx v={wallet} unit /> : <Usdx v={null} none="Not read" />}</KeyValueItem>
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
        <AmountField
          label="Amount"
          unit={QUOTE}
          decimals={7}
          value={amount}
          onValueChange={setAmount}
          inputRef={amountRef}
          aside={wallet !== undefined ? `Wallet ${usdx(wallet)} ${QUOTE}` : undefined}
          validate={(v) => (v.trim() === '' || (parseUsdx(v) ?? 0n) > 0n ? undefined : AMOUNT_ERROR)}
          error={tooMuch ? `Your wallet has ${usdx(wallet)} ${QUOTE}; this deposit needs ${usdxExact(units)} ${QUOTE}. Lower the amount.` : undefined}
        />
        <div className={css.actions}>
          <Button
            variant="primary"
            disabled={!valid || tooMuch || busy}
            disabledReason={amountReason ?? (tooMuch ? 'The amount is more than the wallet holds.' : undefined)}
            onClick={() => void act({ label: 'Deposit', done: 'Deposited' }, (opts) => client.deposit(me, units, opts))}
          >
            Deposit
          </Button>
          <Button
            disabled={!valid || blocked || busy}
            disabledReason={blocked ? 'Blocked while an expired position is not settled.' : amountReason}
            onClick={() => void act({ label: 'Withdraw', done: 'Withdrawn' }, (opts) => client.withdraw(me, units, opts))}
          >
            Withdraw
          </Button>
        </div>
        {blocked ? (
          <Callout variant="warning" label="Withdrawals blocked" title="An expired position is not settled yet.">
            <p>
              The contract refuses a withdrawal until every expired short call of this account is settled (SeriesExpired, 205). Settle it on{' '}
              <Link render={<RouterLink to="/margin/positions" />}>Positions</Link>.
            </p>
          </Callout>
        ) : (
          <p className={css.muted}>A withdrawal is refused if it would leave the account value under the opening requirement.</p>
        )}
        {simulated ? <p className={css.replay}>{REPLAY_NOTE}</p> : null}
      </Card>
    </div>
  )
}
