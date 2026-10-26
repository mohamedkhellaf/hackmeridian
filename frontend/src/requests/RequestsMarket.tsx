import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { explorerTx } from '../config'
import '../market/market.css'
import { formatCountdown, formatExpiryShort } from '../market/series'
import type { OptionsClient } from '../options/client'
import { shortAddress } from '../options/format'
import type { SupportedAssets } from '../options/types'
import type { TxOutcome } from '../state/runTx'
import { Banner, Button, Dialog, Mono } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { RequestDialog } from './RequestDialog'
import { STATUS_LABEL, amt, fillBlockReason, fillCollateral, marketBids, perUnit } from './requests'
import './requests.css'
import type { Bid, NewBid } from './types'

const nowSec = () => Math.floor(Date.now() / 1000)
type Check = 'pending' | 'ok' | 'fail' | 'unknown'

function TxLink({ hash, mock }: { hash: string; mock: boolean }) {
  return mock ? (
    <>
      <Mono title={hash}>{hash.slice(0, 12)}…</Mono> <span className="mk-muted">(mock)</span>
    </>
  ) : (
    <a className="ui-mono" href={explorerTx(hash)} target="_blank" rel="noreferrer" title={hash}>
      {hash.slice(0, 12)}…
    </a>
  )
}

/** Maker confirms filling a buyer's request: shows the collateral locked, the premium received and the checks. */
export function FillDialog({
  bid: b,
  title: titleProp,
  header,
  client,
  me,
  busy,
  onConfirm,
  onClose,
  onOutcomeShown,
}: {
  bid: Bid
  title?: string
  /** Rendered above the terms (the Sell dialog's tabs). */
  header?: ReactNode
  client: OptionsClient
  me: string
  busy: boolean
  onConfirm: () => Promise<TxOutcome>
  onClose: () => void
  onOutcomeShown?: () => void
}) {
  const u = b.underlying
  const q = b.quote
  const coll = fillCollateral(b)
  const [stateCheck, setStateCheck] = useState<Check>('pending')
  const [eligCheck, setEligCheck] = useState<Check>('pending')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ hash: string; mock: boolean } | null>(null)

  // Re-read the request on open: it may have been filled, withdrawn or expired since the list was loaded.
  useEffect(() => {
    let live = true
    client
      .getBid(b.id)
      .then((fresh) => live && setStateCheck(fresh.state === 'open' && fresh.expiry > nowSec() ? 'ok' : 'fail'))
      .catch(() => live && setStateCheck('unknown'))
    return () => {
      live = false
    }
  }, [client, b.id])

  // The writer receives the underlying on a PUT exercise and locks it for a CALL: both need the issuer's authorization.
  useEffect(() => {
    let live = true
    client
      .isEligible(u.contractId, me)
      .then((ok) => live && setEligCheck(ok ? 'ok' : 'fail'))
      .catch(() => live && setEligCheck('unknown'))
    return () => {
      live = false
    }
  }, [client, me, u.contractId])

  const tokens = useMemo(() => [coll.token], [coll.token])
  const { balances } = useBalances(me, tokens)
  const balView = balances[coll.token.contractId]
  const bal = balView && balView.status === 'ok' ? balView.balance : null
  const short = bal !== null && bal < coll.amount
  const self = b.buyer === me
  const blocked = self || stateCheck === 'fail' || eligCheck === 'fail' || short
  const title = titleProp ?? `Fill ${u.code} ${b.kind} request`

  const close = () => {
    if (!submitting) onClose()
  }
  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await onConfirm()
      if (res.ok) {
        setDone({ hash: res.hash, mock: res.mock })
        onOutcomeShown?.()
      } else setError(res.error)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Dialog
        title={title}
        width={460}
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Back to markets
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                window.location.hash = '#/portfolio'
                onClose()
              }}
            >
              View in positions
            </Button>
          </>
        }
      >
        <p className="mk-done">Filled. You wrote this option; the buyer holds it.</p>
        <dl className="ui-kv">
          <div>
            <dt>Transaction</dt>
            <dd>
              <TxLink {...done} />
            </dd>
          </div>
        </dl>
      </Dialog>
    )
  }

  return (
    <Dialog
      title={title}
      width={500}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting} aria-label="Cancel fill">
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} disabled={blocked || busy} onClick={() => void confirm()}>
            {submitting ? 'Confirm in wallet…' : `Lock ${amt(coll.amount, coll.token)} and fill`}
          </Button>
        </>
      }
    >
      {header}
      <p className="rq-copy" data-testid="fill-line">
        You lock {amt(coll.amount, coll.token)} and receive {amt(b.totalPremium, q)} now.
      </p>
      <p className="rq-copy">
        <strong>You become the writer. The collateral stays locked until exercise or expiry.</strong>
      </p>
      <dl className="ui-kv">
        <div>
          <dt>Kind</dt>
          <dd>
            {b.kind === 'put' ? 'Put' : 'Call'} on {amt(b.underlyingQty, u)}
          </dd>
        </div>
        <div>
          <dt>Strike</dt>
          <dd className="num">
            {perUnit(b.totalStrike, b)} {q.code} per {u.code}, {amt(b.totalStrike, q)} total
          </dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>
            {formatExpiryShort(b.expiry)} <span className="mk-muted">{formatCountdown(b.expiry)}</span>
          </dd>
        </div>
        <div>
          <dt>Collateral you lock</dt>
          <dd className="num">{amt(coll.amount, coll.token)}</dd>
        </div>
        <div>
          <dt>Premium you receive</dt>
          <dd className="num">
            {amt(b.totalPremium, q)} ({perUnit(b.totalPremium, b)} per {u.code})
            <span className="mk-note">Set by the buyer, escrowed in the contract, paid to you on fill.</span>
          </dd>
        </div>
        <div>
          <dt>Buyer</dt>
          <dd>
            <Mono>{shortAddress(b.buyer)}</Mono>
          </dd>
        </div>
        <div>
          <dt>Request</dt>
          <dd className={stateCheck === 'fail' ? 'mk-bad' : undefined}>
            {stateCheck === 'ok' && 'Open'}
            {stateCheck === 'pending' && 'Checking'}
            {stateCheck === 'fail' && 'No longer open (filled, withdrawn or expired).'}
            {stateCheck === 'unknown' && 'Could not re-check. The contract rejects the fill if it is gone.'}
          </dd>
        </div>
        <div>
          <dt>Your account</dt>
          <dd className={eligCheck === 'fail' ? 'mk-bad' : undefined}>
            {eligCheck === 'ok' && `Authorized by the ${u.code} issuer`}
            {eligCheck === 'pending' && 'Checking'}
            {eligCheck === 'fail' && `Not authorized by the ${u.code} issuer. The fill would fail with NotEligible.`}
            {eligCheck === 'unknown' && 'Could not check'}
          </dd>
        </div>
        <div>
          <dt>{coll.token.code} balance</dt>
          <dd className={short ? 'mk-bad' : undefined}>
            {bal === null ? 'Not checked' : short ? `Need ${amt(coll.amount, coll.token)}, wallet has ${amt(bal, coll.token)}` : `${amt(bal, coll.token)}, enough`}
          </dd>
        </div>
      </dl>
      {self && <Banner tone="warn">This is your own request.</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
    </Dialog>
  )
}

/**
 * Markets: buyer requests (contract v1.5 bids). Each is a funded bid at a price the buyer set; a maker fills it by
 * locking the collateral. Hidden when the contract has no bids (bids === null).
 */
export function RequestsMarket({
  bids,
  assets,
  me,
  busy,
  busyId,
  bidBusyId,
  client,
  onCreate,
  onFill,
  onCancel,
  onOutcomeShown,
}: {
  bids: Bid[] | null
  assets: SupportedAssets | null
  me: string | null
  busy: boolean
  busyId: bigint | null
  bidBusyId: (id: bigint) => bigint
  client: OptionsClient
  onCreate: (bid: NewBid) => Promise<TxOutcome>
  onFill: (b: Bid) => Promise<TxOutcome>
  onCancel: (b: Bid) => Promise<TxOutcome>
  onOutcomeShown?: () => void
}) {
  const [filling, setFilling] = useState<Bid | null>(null)
  const [requesting, setRequesting] = useState(false)
  if (!bids) return null
  const rows = marketBids(bids)
  const now = nowSec()

  return (
    <section className="rsl-section rq-section" aria-label="Requests">
      <div className="rq-head">
        <h2>Requests</h2>
        <Button
          size="sm"
          variant="primary"
          disabled={!me || !assets || busy}
          reason={!me ? 'Connect a wallet to post a request' : busy ? 'Another transaction is in progress' : undefined}
          onClick={() => setRequesting(true)}
        >
          Request an option
        </Button>
      </div>
      <p className="rsl-lead">Funded bids from buyers. Each buyer set their own terms and escrowed the premium; a maker fills by locking the collateral.</p>
      {rows.length === 0 ? (
        <p className="mk-empty">No requests.</p>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table" aria-label="Requests">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Asset</th>
                <th className="num">Qty</th>
                <th className="num">Strike</th>
                <th className="num">Premium offered</th>
                <th>Expiry</th>
                <th className="hide-sm">Buyer</th>
                <th>Status</th>
                <th className="num">
                  <span className="mk-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const own = b.buyer === me
                const block = fillBlockReason(b, me, now)
                const rowBusy = busyId === bidBusyId(b.id)
                return (
                  <tr key={b.id.toString()}>
                    <td>{b.kind === 'put' ? 'Put' : 'Call'}</td>
                    <td>{b.underlying.code}</td>
                    <td className="num">{amt(b.underlyingQty, b.underlying)}</td>
                    <td className="num">
                      {perUnit(b.totalStrike, b)} <span className="mk-muted">/ {amt(b.totalStrike, b.quote)}</span>
                    </td>
                    <td className="num">
                      {perUnit(b.totalPremium, b)} <span className="mk-muted">/ {amt(b.totalPremium, b.quote)}</span>
                    </td>
                    <td>
                      {formatExpiryShort(b.expiry)} <span className="mk-muted">{formatCountdown(b.expiry)}</span>
                    </td>
                    <td className="hide-sm">
                      <Mono>{shortAddress(b.buyer)}</Mono>
                      {own && <span className="mk-you"> (you)</span>}
                    </td>
                    <td data-testid="request-status">{STATUS_LABEL[b.state]}</td>
                    <td className="num rsl-actions">
                      {own && (b.state === 'open' || b.state === 'expired') ? (
                        <Button size="sm" variant="secondary" disabled={busy} aria-label={`Cancel request ${b.id.toString()}`} onClick={() => void onCancel(b)}>
                          {rowBusy ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      ) : b.state === 'open' && !own ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || !!block}
                          reason={block ?? (busy ? 'Another transaction is in progress' : undefined)}
                          aria-label={`Fill request ${b.id.toString()}`}
                          onClick={() => setFilling(b)}
                        >
                          Fill
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {filling && me && (
        <FillDialog
          bid={filling}
          client={client}
          me={me}
          busy={busy}
          onConfirm={() => onFill(filling)}
          onClose={() => setFilling(null)}
          onOutcomeShown={onOutcomeShown}
        />
      )}
      {requesting && me && assets && (
        <RequestDialog assets={assets} client={client} me={me} busy={busy} onSubmit={onCreate} onClose={() => setRequesting(false)} />
      )}
    </section>
  )
}
