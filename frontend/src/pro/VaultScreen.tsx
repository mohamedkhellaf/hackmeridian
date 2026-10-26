import { Fragment, useState } from 'react'
import { parseAmount } from '../options/format'
import { Banner, Button, Card, PageHeader, Stat, StatGrid } from '../ui'
import { DASH, lots, usdx } from './format'
import { Field, Unknown, Who } from './parts'
import { usePro } from './proCtx'
import { USDX_DECIMALS } from './types'

export function VaultScreen() {
  const { client, model, me, run } = usePro()
  const v = model.vault
  const [amount, setAmount] = useState('')
  const parsed = parseAmount(amount, USDX_DECIMALS)
  const mine = v.lpShares.find((l) => l.lp === me)

  return (
    <>
      <PageHeader
        title="Backstop vault"
        subtitle="LP-funded capital that pays holders when a writer's margin falls short. It can lose money: its value is shown below, and LP capital cannot be withdrawn in this version."
      />

      <StatGrid columns={4}>
        <Stat label="Vault value" hint="Cash if no shorts, otherwise its NLV">
          {v.value != null ? usdx(v.value) : <Unknown />}
        </Stat>
        <Stat label="Vault cash">{usdx(v.cash)}</Stat>
        <Stat label="Reserved takeover payments" hint="Held for books the vault took over">
          {usdx(v.reserved)}
        </Stat>
        <Stat label="Debts owed by writers" hint="Takeover shortfalls to collect">
          {usdx(v.debtsOwed)}
        </Stat>
      </StatGrid>
      {v.shorts.length > 0 && (
        <Banner tone="warn" title="The vault holds short calls">
          {v.shorts.map((s) => `${lots(s.qty)} lots on series #${s.seriesId}`).join(', ')}. Their losses are in the vault value above and are paid pro rata at settlement.
        </Banner>
      )}

      <div className="pro-grid">
        <Card title="Provide LP capital" subtitle="Deposit only. No withdrawal in v0 (WithdrawLocked).">
          <div className="pro-form">
            <Field label="Amount (USDx)" hint="Simulation: the amount is taken from the script, not from this field.">
              <input className="pro-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <Button variant="primary" onClick={() => void run('LP deposit', client.lpDeposit(me, parsed ?? 0n), 'LP deposit recorded.')}>
              Deposit to the vault
            </Button>
            <Banner tone="info">
              Known limit: a deposit made before a keeper takes over an insolvent writer can enter a loss that is not visible yet. LP deposits are refused while the vault value is zero or below.
            </Banner>
          </div>
        </Card>

        <Card title="LP shares" subtitle={`Total ${lots(v.totalShares)} shares`}>
          <dl className="pro-dl">
            {v.lpShares.length === 0 && (
              <>
                <dt>LPs</dt>
                <dd>None yet</dd>
              </>
            )}
            {v.lpShares.map((l) => (
              <Fragment key={l.lp}>
                <dt>
                  <Who id={l.lp} />
                </dt>
                <dd>{lots(l.shares)}</dd>
              </Fragment>
            ))}
            <dt>You ({me})</dt>
            <dd>{mine ? lots(mine.shares) : DASH}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Shortfalls and deficits per series" subtitle="A shortfall is what writer margin did not cover. The vault pays pro rata; what it cannot pay is the deficit, a cut on holders." flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Series</th>
                <th>Shortfall</th>
                <th>Paid by the vault</th>
                <th>Deficit</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {model.series.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={5}>
                    No series yet.
                  </td>
                </tr>
              )}
              {model.series.map((s) => (
                <tr key={s.id}>
                  <td className="ui-left ui-strong">#{s.id}</td>
                  <td>{usdx(s.shortfall)}</td>
                  <td>{usdx(s.vaultPaid)}</td>
                  <td className={s.deficit != null && s.deficit > 0n ? 'pro-bad' : undefined}>{s.deficit != null ? usdx(s.deficit) : 'After settlement'}</td>
                  <td>{s.closed ? 'Closed' : s.settlementPrice != null ? 'Settling' : 'Open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Debts owed to the vault" subtitle="Takeover shortfalls still unrecovered from writers." flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Writer</th>
                <th>Owed</th>
              </tr>
            </thead>
            <tbody>
              {v.debtors.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={2}>
                    None at this point of the simulation.
                  </td>
                </tr>
              )}
              {v.debtors.map((d) => (
                <tr key={d.writer}>
                  <td className="ui-left">
                    <Who id={d.writer} />
                  </td>
                  <td className="pro-bad">{usdx(d.owed)} USDx</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
