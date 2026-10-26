import { useState } from 'react'
import { parseAmount } from '../options/format'
import { Button, Card, Stat, StatGrid } from '../ui'
import { DASH, lots } from './format'
import { Field, Unknown, Usdx, Who } from './parts'
import { AMOUNT_HINT } from './copy'
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
      <StatGrid columns={4}>
        <Stat label="Vault value (USDx)">{v.value != null ? <Usdx v={v.value} /> : <Unknown />}</Stat>
        <Stat label="Cash (USDx)">
          <Usdx v={v.cash} />
        </Stat>
        <Stat label="Reserved for takeovers (USDx)">
          <Usdx v={v.reserved} />
        </Stat>
        <Stat label="Owed by writers (USDx)">
          <Usdx v={v.debtsOwed} />
        </Stat>
      </StatGrid>

      <div className="pro-grid">
        <Card title="LP deposit">
          <div className="pro-form">
            <Field label="Amount" unit="USDx" hint={amount && !parsed ? AMOUNT_HINT : undefined}>
              <input inputMode="decimal" aria-label="Amount (USDx)" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <div className="pro-actions">
              <Button variant="primary" onClick={() => void run('LP deposit', client.lpDeposit(me, parsed ?? 0n), 'Deposited to the vault')}>
                Deposit to the vault
              </Button>
            </div>
            <p className="pro-muted">No LP withdrawal in v0 (WithdrawLocked).</p>
          </div>
        </Card>

        <Card title="LP shares">
          <dl className="ui-kv">
            {v.lpShares.map((l) => (
              <div key={l.lp}>
                <dt>
                  <Who id={l.lp} />
                </dt>
                <dd>{lots(l.shares)}</dd>
              </div>
            ))}
            <div>
              <dt>Total</dt>
              <dd>{lots(v.totalShares)}</dd>
            </div>
            <div>
              <dt>You ({me})</dt>
              <dd>{mine ? lots(mine.shares) : DASH}</dd>
            </div>
            <div>
              <dt>Vault short calls</dt>
              <dd className={v.shorts.length > 0 ? 'pro-warn' : undefined}>
                {v.shorts.length > 0 ? v.shorts.map((s) => `${lots(s.qty)} lots, series ${s.seriesId}`).join('; ') : 'None'}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Series" flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="num">Series</th>
                <th className="num">Shortfall (USDx)</th>
                <th className="num hide-sm">Paid by vault (USDx)</th>
                <th className="num">Deficit (USDx)</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {model.series.length === 0 && (
                <tr>
                  <td colSpan={5}>No series listed.</td>
                </tr>
              )}
              {model.series.map((s) => (
                <tr key={s.id}>
                  <td className="num">{s.id}</td>
                  <td className="num">
                    <Usdx v={s.shortfall} />
                  </td>
                  <td className="num hide-sm">
                    <Usdx v={s.vaultPaid} />
                  </td>
                  <td className={s.deficit != null && s.deficit > 0n ? 'num pro-bad' : 'num'}>{s.deficit != null ? <Usdx v={s.deficit} /> : <span className="pro-muted">After settlement</span>}</td>
                  <td>{s.closed ? 'Closed' : s.settlementPrice != null ? 'Settling' : 'Open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Debts owed to the vault" flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Writer</th>
                <th className="num">Owed (USDx)</th>
              </tr>
            </thead>
            <tbody>
              {v.debtors.length === 0 && (
                <tr>
                  <td colSpan={2}>No debts.</td>
                </tr>
              )}
              {v.debtors.map((d) => (
                <tr key={d.writer}>
                  <td>
                    <Who id={d.writer} />
                  </td>
                  <td className="num pro-bad">
                    <Usdx v={d.owed} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
