import { Button, Card } from '../ui'
import { proErrorName } from './errors'
import { lots } from './format'
import { Unknown, Usdx, Who } from './parts'
import { usePro } from './proCtx'

export function LiquidationsScreen() {
  const { client, model, me, run } = usePro()
  const writers = model.accounts.filter((a) => a.shorts.length > 0 || a.requirement)
  const takeovers = model.history.filter((h) => h.op === 'liquidate')

  return (
    <>
      <Card title="Accounts" flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Account</th>
                <th className="hide-sm">Short calls</th>
                <th className="num hide-sm">NLV (USDx)</th>
                <th className="num hide-sm">MM (USDx)</th>
                <th className="num">Distance (USDx)</th>
                <th className="hide-sm">Margin</th>
                <th>
                  <span className="pro-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {writers.length === 0 && (
                <tr>
                  <td colSpan={7}>No margin accounts.</td>
                </tr>
              )}
              {writers.map((a) => {
                const below = a.cushion != null && a.cushion < 0n
                const hasShorts = a.shorts.length > 0
                return (
                  <tr key={a.id}>
                    <td>
                      <Who id={a.id} />
                    </td>
                    <td className="hide-sm">{hasShorts ? a.shorts.map((s) => `${lots(s.qty)} lots, series ${s.seriesId}`).join('; ') : 'None'}</td>
                    <td className="num hide-sm">{a.requirement ? <Usdx v={a.requirement.nlv} /> : <Unknown />}</td>
                    <td className="num hide-sm">{a.requirement ? <Usdx v={a.requirement.mm} /> : <Unknown />}</td>
                    <td className={below ? 'num pro-bad' : 'num'}>{a.cushion != null ? <Usdx v={a.cushion} /> : <Unknown />}</td>
                    <td className={below ? 'pro-warn hide-sm' : 'hide-sm'}>{a.cushion == null ? <Unknown /> : below ? 'Below maintenance' : 'Above maintenance'}</td>
                    <td>
                      <div className="pro-actions">
                        <Button size="sm" variant={below ? 'primary' : 'secondary'} disabled={!hasShorts} onClick={() => void run('Take over to the vault', client.liquidate(me, a.id, null), 'Taken over by the vault')}>
                          Take over to the vault
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!hasShorts || a.id === me}
                          title={a.id === me ? 'You cannot take over your own account' : undefined}
                          onClick={() => void run('Private takeover', client.liquidate(me, a.id, me), 'Taken over privately')}
                        >
                          Private takeover
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Takeovers" flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="num hide-sm">Step</th>
                <th>Writer</th>
                <th>Taker</th>
                <th className="num">Price (USDx)</th>
                <th className="num">Paid (USDx)</th>
                <th className="num">Deficit (USDx)</th>
              </tr>
            </thead>
            <tbody>
              {takeovers.length === 0 && (
                <tr>
                  <td colSpan={6}>No takeovers.</td>
                </tr>
              )}
              {takeovers.map((h) => (
                <tr key={h.index}>
                  <td className="num hide-sm">{h.index + 1}</td>
                  <td>
                    <Who id={String(h.args[1])} />
                  </td>
                  <td>
                    <Who id={String(h.args[2])} />
                  </td>
                  {h.ok && h.result ? (
                    <>
                      <td className="num">
                        <Usdx v={h.result.x} />
                      </td>
                      <td className="num">
                        <Usdx v={h.result.paid} />
                      </td>
                      <td className={h.result.deficit > 0n ? 'num pro-bad' : 'num'}>
                        <Usdx v={h.result.deficit} />
                      </td>
                    </>
                  ) : (
                    <td colSpan={3} className="pro-warn">
                      Refused: {proErrorName(h.code ?? 0)} ({h.code ?? 0})
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
