import { useState } from 'react'
import { parseAmount } from '../options/format'
import { Banner, Button, Card, PageHeader, Stat, StatGrid, Tag } from '../ui'
import { DASH, lots, usdx } from './format'
import { seriesLabel } from './helpers'
import { Field, Unknown } from './parts'
import { usePro } from './proCtx'
import { USDX_DECIMALS } from './types'

export function MarginScreen() {
  const { client, model, me, run } = usePro()
  const acct = model.accounts.find((a) => a.id === me)
  const req = acct?.requirement ?? null
  const [amount, setAmount] = useState('')
  const parsed = parseAmount(amount, USDX_DECIMALS)
  const wallet = model.wallets[me]
  const below = acct?.cushion != null && acct.cushion < 0n

  return (
    <>
      <PageHeader
        title="Margin account"
        subtitle="Collateral that backs the calls you write. Partial margin: it can be exhausted by a price jump, and then positions are taken over."
      />

      {!acct && (
        <Banner tone="info">
          {me} has no margin account at this point of the simulation. Deposit to open one, or switch the acting account or step in the simulation controls.
        </Banner>
      )}
      {acct && acct.owed > 0n && (
        <Banner tone="warn" title="Debt owed to the vault">
          A takeover left a shortfall of {usdx(acct.owed)} USDx. It is collected from your free cash at takeovers, when your last expired position settles and before any withdrawal. Any part your
          cash cannot cover stays recorded as unrecovered debt.
        </Banner>
      )}
      {acct?.withdrawBlocked && (
        <Banner tone="warn" title="Withdrawal blocked">
          This account holds an expired position that is not settled yet. Withdrawals fail (SeriesExpired) until every expired book is settled.
        </Banner>
      )}

      <StatGrid columns={4}>
        <Stat label="NLV" hint="Net liquidation value">
          {req ? usdx(req.nlv) : <Unknown />}
        </Stat>
        <Stat label="MM" hint="Maintenance margin: NLV below this means takeover">
          {req ? usdx(req.mm) : <Unknown />}
        </Stat>
        <Stat label="IM" hint="Initial margin: needed to sell or withdraw">
          {req ? usdx(req.im) : <Unknown />}
        </Stat>
        <Stat label="Distance to liquidation" hint="NLV minus MM">
          {acct?.cushion != null ? usdx(acct.cushion) : <Unknown />}
        </Stat>
      </StatGrid>
      {acct?.cushion != null && (
        <p className="pro-status">
          <Tag tone={below ? 'warn' : 'ok'}>{below ? 'Below maintenance margin' : 'Above maintenance margin'}</Tag>
          {below ? ' Anyone can take this account over to the vault.' : ' No takeover can be triggered at the latest snapshot.'}
        </p>
      )}
      {acct && !req && <p className="pro-hint">Margin figures come from get_requirement. The fixtures have no current value for this account in this state, so they are not shown.</p>}

      <div className="pro-grid">
        <Card title="Account" subtitle="Cash and debts in the Pro contract">
          <dl className="pro-dl">
            <dt>Cash in the contract</dt>
            <dd>{acct ? `${usdx(acct.cash)} USDx` : DASH}</dd>
            <dt>Debt owed to the vault</dt>
            <dd>{acct ? `${usdx(acct.owed)} USDx` : DASH}</dd>
            <dt>Wallet balance</dt>
            <dd>{wallet != null ? `${usdx(wallet)} USDx` : DASH}</dd>
            <dt>Open short calls</dt>
            <dd>
              {acct && acct.shorts.length > 0
                ? acct.shorts.map((s) => (
                    <div key={s.seriesId}>
                      {lots(s.qty)} lots · {seriesLabel(model.series.find((x) => x.id === s.seriesId))}
                    </div>
                  ))
                : 'None'}
            </dd>
          </dl>
        </Card>

        <Card title="Deposit or withdraw" subtitle="USDx margin. Withdrawing needs NLV to stay at or above IM, and no unsettled expired position.">
          <div className="pro-form">
            <Field label="Amount (USDx)" hint="Simulation: the amount is taken from the script, not from this field.">
              <input className="pro-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <div className="pro-actions">
              <Button variant="primary" onClick={() => void run('Deposit', client.deposit(me, parsed ?? 0n), 'Deposit recorded.')}>
                Deposit
              </Button>
              <Button variant="secondary" disabled={acct?.withdrawBlocked} onClick={() => void run('Withdraw', client.withdraw(me, parsed ?? 0n), 'Withdrawal recorded.')}>
                Withdraw
              </Button>
            </div>
            {amount && !parsed && <span className="pro-hint">Enter a number with at most 7 decimals.</span>}
          </div>
        </Card>
      </div>
    </>
  )

}
