import { useState } from 'react'
import { parseAmount } from '../options/format'
import { Button, Card, Stat, StatGrid } from '../ui'
import { DASH, lots } from './format'
import { seriesLabel } from './helpers'
import { Field, Unknown, Usdx } from './parts'
import { AMOUNT_HINT } from './copy'
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
      <StatGrid columns={4}>
        <Stat label="NLV (USDx)">{req ? <Usdx v={req.nlv} /> : <Unknown />}</Stat>
        <Stat label="Maintenance margin (USDx)">{req ? <Usdx v={req.mm} /> : <Unknown />}</Stat>
        <Stat label="Initial margin (USDx)">{req ? <Usdx v={req.im} /> : <Unknown />}</Stat>
        <Stat label="Distance to MM (USDx)">{acct?.cushion != null ? <span className={below ? 'pro-bad' : undefined}><Usdx v={acct.cushion} /></span> : <Unknown />}</Stat>
      </StatGrid>

      <div className="pro-grid">
        <Card title="Account">
          {!acct ? (
            <p className="pro-muted">No margin account for {me}.</p>
          ) : (
            <dl className="ui-kv">
              <div>
                <dt>Status</dt>
                <dd className={below ? 'pro-warn' : undefined}>{acct.cushion == null ? <Unknown why="No get_requirement value in this state" /> : below ? 'Below maintenance margin' : 'Above maintenance margin'}</dd>
              </div>
              <div>
                <dt>Cash in contract</dt>
                <dd>
                  <Usdx v={acct.cash} /> USDx
                </dd>
              </div>
              <div>
                <dt>Owed to the vault</dt>
                <dd className={acct.owed > 0n ? 'pro-bad' : undefined}>
                  <Usdx v={acct.owed} /> USDx
                </dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>{wallet != null ? <><Usdx v={wallet} /> USDx</> : DASH}</dd>
              </div>
              <div>
                <dt>Short calls</dt>
                <dd>
                  {acct.shorts.length > 0
                    ? acct.shorts.map((s) => (
                        <div key={s.seriesId}>
                          {lots(s.qty)} lots, {seriesLabel(model.series.find((x) => x.id === s.seriesId))}
                        </div>
                      ))
                    : 'None'}
                </dd>
              </div>
            </dl>
          )}
        </Card>

        <Card title="Deposit or withdraw">
          <div className="pro-form">
            <Field label="Amount" unit="USDx" hint={amount && !parsed ? AMOUNT_HINT : undefined}>
              <input inputMode="decimal" aria-label="Amount (USDx)" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <div className="pro-actions">
              <Button variant="primary" onClick={() => void run('Deposit', client.deposit(me, parsed ?? 0n), 'Deposited')}>
                Deposit
              </Button>
              <Button variant="secondary" disabled={acct?.withdrawBlocked} onClick={() => void run('Withdraw', client.withdraw(me, parsed ?? 0n), 'Withdrawn')}>
                Withdraw
              </Button>
            </div>
            {acct?.withdrawBlocked && <p className="pro-muted">Withdraw blocked: an expired position is not settled (SeriesExpired).</p>}
          </div>
        </Card>
      </div>
    </>
  )
}
