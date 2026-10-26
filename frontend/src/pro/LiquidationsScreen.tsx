import { Banner, Button, Card, PageHeader, Tag } from '../ui'
import { DASH, lots, usdx } from './format'
import { Unknown, Who } from './parts'
import { usePro } from './proCtx'
import { VAULT } from './types'

export function LiquidationsScreen() {
  const { client, model, me, run } = usePro()
  const writers = model.accounts.filter((a) => a.shorts.length > 0 || a.requirement)
  const takeovers = model.history.filter((h) => h.op === 'liquidate')

  return (
    <>
      <PageHeader
        title="Liquidations"
        subtitle="An account whose NLV falls below its maintenance margin (MM) can be taken over. Anyone can trigger a takeover to the vault; a solvent maker can take it over privately."
      />

      <Banner tone="warn" title="Takeover price and deficit">
        The taker pays the takeover price from the writer's cash. If the writer's cash cannot cover it, the shortfall is a recorded deficit: the vault absorbs it and the writer owes it back to the vault.
      </Banner>

      <Card title="Accounts" subtitle="Margin figures come from get_requirement; a dash means the source has no current value." flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Account</th>
                <th>Short calls</th>
                <th>NLV</th>
                <th>MM</th>
                <th>Distance</th>
                <th>Status</th>
                <th>
                  <span className="pro-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {writers.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={7}>
                    No margin accounts at this point of the simulation.
                  </td>
                </tr>
              )}
              {writers.map((a) => {
                const below = a.cushion != null && a.cushion < 0n
                const hasShorts = a.shorts.length > 0
                return (
                  <tr key={a.id} className={below ? 'is-risk' : undefined}>
                    <td className="ui-left ui-strong">
                      <Who id={a.id} />
                    </td>
                    <td>{hasShorts ? a.shorts.map((s) => `${lots(s.qty)} lots (#${s.seriesId})`).join(', ') : 'None'}</td>
                    <td>{a.requirement ? usdx(a.requirement.nlv) : <Unknown />}</td>
                    <td>{a.requirement ? usdx(a.requirement.mm) : <Unknown />}</td>
                    <td>{a.cushion != null ? usdx(a.cushion) : <Unknown />}</td>
                    <td>
                      {a.cushion == null ? <Tag>No value</Tag> : <Tag tone={below ? 'warn' : 'ok'}>{below ? 'Below maintenance' : 'Healthy'}</Tag>}
                    </td>
                    <td>
                      <div className="pro-actions">
                        <Button size="sm" variant={below ? 'primary' : 'secondary'} disabled={!hasShorts} onClick={() => void run('Take over to the vault', client.liquidate(me, a.id, null), 'Taken over to the vault.')}>
                          Take over to the vault
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!hasShorts || a.id === me}
                          title={a.id === me ? 'You cannot take over your own account' : undefined}
                          onClick={() => void run('Private takeover', client.liquidate(me, a.id, me), 'Taken over privately.')}
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

      <Card title="Takeovers so far" subtitle="Takeover price, what the writer's cash paid, and any deficit." flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Step</th>
                <th>Writer</th>
                <th>Taker</th>
                <th>Takeover price</th>
                <th>Paid</th>
                <th>Deficit</th>
              </tr>
            </thead>
            <tbody>
              {takeovers.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={6}>
                    No takeover yet at this point of the simulation.
                  </td>
                </tr>
              )}
              {takeovers.map((h) => (
                <tr key={h.index}>
                  <td className="ui-left">#{h.index + 1}</td>
                  <td>{String(h.args[1])}</td>
                  <td>{h.args[2] === VAULT ? <Tag tone="call">Vault</Tag> : String(h.args[2])}</td>
                  {h.ok && h.result ? (
                    <>
                      <td>{usdx(h.result.x)}</td>
                      <td>{usdx(h.result.paid)}</td>
                      <td className={h.result.deficit > 0n ? 'pro-bad' : undefined}>{usdx(h.result.deficit)}</td>
                    </>
                  ) : (
                    <td colSpan={3}>Refused (error {h.code ?? DASH})</td>
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
