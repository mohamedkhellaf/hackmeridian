import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import type { AssetSearch } from '../../../app/search'
import type { TxErrorKind } from '../../../core/tx/errors'
import { useAsks, useAssets, useBids, useMe, useNowSec, useOptions, useOptionsClient } from '../../../data'
import { Button, EmptyNote } from '../../../ui'
import { useWallet, E2E_ADDRESSES } from '../../../wallet'
import { moneyText, priceText } from '../fmt'
import { TicketHost, searchFromTicketIntent, ticketIntentFromSearch } from '../index'
import type { TicketIntent } from '../index'
import { parseId } from '../intent'
import { premiumPerUnit, strikePerUnit } from '../terms'
import styles from './Harness.module.css'

type Raw = Record<string, string | undefined>

const TICKET_KEYS = ['side', 'offer', 'bid', 'ask', 'list', 'step', 'qty', 'premium'] as const
const OUTCOMES: TxErrorKind[] = ['declined', 'refused', 'failed', 'expired', 'unknown']

/** What a test or a screenshot needs around the ticket: who is connected, what can be opened, how the next transaction ends. */
export function Harness() {
  const raw = useSearch({ strict: false }) as Raw
  const location = useLocation()
  const navigate = useNavigate()
  const wallet = useWallet()
  const me = useMe()
  const nowSec = useNowSec(30)
  const { getClient } = useOptionsClient()
  const assets = useAssets()
  const options = useOptions()
  const bids = useBids()
  const asks = useAsks()

  const underlyings = assets.data?.underlyings ?? []
  const token = underlyings.find((t) => t.code.toLowerCase() === (raw.asset ?? '').toLowerCase() || t.contractId === raw.asset) ?? underlyings[0]
  const placement = raw.placement === 'overlay' ? 'overlay' : 'rail'

  const intent = useMemo<TicketIntent | null>(() => {
    const listId = parseId(raw.list)
    if (listId !== null) return { mode: 'list', optionId: listId }
    return token ? ticketIntentFromSearch(raw as AssetSearch, token.contractId) : null
  }, [raw, token])

  const patch = (next: Raw, replace = false) =>
    void navigate({ to: '.', search: ((prev: Raw) => ({ ...prev, ...next })) as never, replace, resetScroll: false })
  const open = (next: Raw) => patch({ ...Object.fromEntries(TICKET_KEYS.map((k) => [k, undefined])), kind: undefined, strike: undefined, expiry: undefined, ...next })
  const close = () => patch({ ...Object.fromEntries(TICKET_KEYS.map((k) => [k, undefined])), ...searchFromTicketIntent(null) })
  const change = (next: TicketIntent) => patch({ ...Object.fromEntries(TICKET_KEYS.map((k) => [k, undefined])), ...searchFromTicketIntent(next) } as Raw, true)

  const connectAs = async (address: string) => {
    wallet.disconnect()
    await navigate({ to: '.', search: ((prev: Raw) => ({ ...prev, as: address === E2E_ADDRESSES.a ? undefined : address })) as never, replace: true, resetScroll: false })
    await wallet.connect()
  }
  const stage = async (kind: TxErrorKind) => {
    const client = (await getClient()) as unknown as { failNextWith?: (kind: TxErrorKind | null) => void }
    client.failNextWith?.(kind)
  }

  const offers = (options.data ?? []).filter((o) => o.state === 'offered' && o.expiry > nowSec && o.underlying.contractId === token?.contractId)
  const openBids = (bids.data ?? []).filter((b) => b.state === 'open' && b.expiry > nowSec)
  const listings = (asks.data ?? []).map((a) => ({ ask: a, option: (options.data ?? []).find((o) => o.id === a.id) })).filter((r) => r.option)
  const held = me ? (options.data ?? []).filter((o) => o.state === 'active' && o.holder === me && o.expiry > nowSec) : []

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="ui-h2">Ticket harness</h1>
        <p className="ui-caption" data-testid="harness-path">
          {location.pathname}
        </p>
        <p className="ui-caption" data-testid="harness-wallet">
          {me ? `Connected as ${me === E2E_ADDRESSES.a ? 'wallet A' : me === E2E_ADDRESSES.b ? 'wallet B' : me}` : 'Guest'}
        </p>
        <div className={styles.row}>
          <Button size="sm" onClick={() => void connectAs(E2E_ADDRESSES.a)}>
            Use wallet A
          </Button>
          <Button size="sm" onClick={() => void connectAs(E2E_ADDRESSES.b)}>
            Use wallet B
          </Button>
          <Button size="sm" onClick={() => wallet.disconnect()}>
            Use no wallet
          </Button>
        </div>
        <div className={styles.row}>
          {OUTCOMES.map((kind) => (
            <Button key={kind} size="sm" variant="quiet" onClick={() => void stage(kind)}>
              {`Next ends ${kind}`}
            </Button>
          ))}
        </div>
      </header>
      <div className={styles.body}>
        <main className={styles.main}>
          <section aria-labelledby="h-open">
            <h2 id="h-open" className="ui-h3">
              Open a ticket
            </h2>
            <div className={styles.row}>
              {underlyings.map((t) => (
                <Button key={t.contractId} size="sm" variant={t.contractId === token?.contractId ? 'secondary' : 'quiet'} onClick={() => patch({ asset: t.code })}>
                  {`Asset ${t.code}`}
                </Button>
              ))}
              <Button size="sm" onClick={() => patch({ placement: placement === 'rail' ? 'overlay' : 'rail' })}>
                {`Placement: ${placement}`}
              </Button>
            </div>
            <div className={styles.row}>
              <Button size="sm" onClick={() => open({ side: 'write', kind: 'put' })}>
                Write a put
              </Button>
              <Button size="sm" onClick={() => open({ side: 'write', kind: 'call' })}>
                Write a call
              </Button>
              <Button size="sm" onClick={() => open({ side: 'bid', kind: 'put' })}>
                Request a put
              </Button>
              <Button size="sm" onClick={() => open({ side: 'bid', kind: 'call' })}>
                Request a call
              </Button>
            </div>
          </section>
          <section aria-labelledby="h-offers">
            <h2 id="h-offers" className="ui-h3">
              Open offers
            </h2>
            <ul className={styles.list} data-testid="harness-offers">
              {offers.map((o) => (
                <li key={o.id.toString()}>
                  <Button size="sm" onClick={() => open({ offer: o.id.toString() })} data-kind={o.kind} data-mine={o.writer === me || undefined} data-maker={o.writer.startsWith('GMAKER') || undefined}>
                    {`Buy offer ${o.id}: ${o.kind} ${priceText(strikePerUnit(o), o.quote)}, ${moneyText({ token: o.underlying, amount: o.underlyingQty })}, ${priceText(premiumPerUnit(o), o.quote)} per unit`}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="h-bids">
            <h2 id="h-bids" className="ui-h3">
              Open requests
            </h2>
            <ul className={styles.list} data-testid="harness-bids">
              {openBids.map((b) => (
                <li key={b.id.toString()}>
                  <Button size="sm" onClick={() => open({ bid: b.id.toString(), asset: b.underlying.code })} data-mine={b.buyer === me || undefined}>
                    {`Fill request ${b.id}: ${b.kind} on ${moneyText({ token: b.underlying, amount: b.underlyingQty })}, premium ${moneyText({ token: b.quote, amount: b.totalPremium })}`}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="h-asks">
            <h2 id="h-asks" className="ui-h3">
              Resale listings
            </h2>
            <ul className={styles.list} data-testid="harness-asks">
              {listings.map(({ ask, option }) => (
                <li key={ask.id.toString()}>
                  <Button size="sm" onClick={() => open({ ask: ask.id.toString(), asset: option!.underlying.code })}>
                    {`Buy listing ${ask.id}: ${option!.kind} on ${moneyText({ token: option!.underlying, amount: option!.underlyingQty })} for ${moneyText({ token: option!.quote, amount: ask.askTotal })}`}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="h-held">
            <h2 id="h-held" className="ui-h3">
              Options you hold
            </h2>
            <ul className={styles.list} data-testid="harness-held">
              {held.map((o) => (
                <li key={o.id.toString()}>
                  <Button size="sm" onClick={() => open({ list: o.id.toString(), asset: o.underlying.code })}>
                    {`Sell option ${o.id}: ${o.kind} on ${moneyText({ token: o.underlying, amount: o.underlyingQty })}`}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </main>
        <aside className={styles.rail} aria-label="Order ticket">
          <TicketHost
            placement={placement}
            intent={intent}
            startAt={raw.step === 'review' ? 'review' : undefined}
            onClose={close}
            onIntentChange={change}
            idle={<EmptyNote title="Pick an offer to see its terms." hint="The ticket opens here." />}
          />
        </aside>
      </div>
    </div>
  )
}
