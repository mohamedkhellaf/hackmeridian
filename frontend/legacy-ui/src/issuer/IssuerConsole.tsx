import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Account, Asset, Horizon } from '@stellar/stellar-sdk'
import { config, explorerTx } from '../config'
import { server } from '../stellar/rpc'
import { describeError } from '../stellar/errors'
import { parseAmount, formatAmount, shortAddress } from '../options/format'
import { Banner, Button, Card, Dialog, Mono, shortContractId } from '../ui'
import {
  STROOPS_DECIMALS,
  buildClawbackTx,
  buildSacTx,
  buildSetAuthorizedTx,
  isAccountId,
  isContractId,
  missingFlags,
  sacClawbackOp,
  sacContractId,
  sacSetAuthorizedOp,
  trustStatus,
} from './issuerTx'
import type { IssuerFlags, TrustStatus } from './issuerTx'
import { readSacAuthorized, submitClassic, submitSoroban } from './issuerNet'
import { actionsFor, authStateFromSac, authStateFromTrust, isNotFound } from './issuerView'
import type { AuthState } from './issuerView'
import './issuer.css'

const horizon = new Horizon.Server(config.horizonUrl)
const expertContract = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`
const shortHash = (h: string) => `${h.slice(0, 4)}…${h.slice(-4)}`

interface Props {
  /** Asset code; the issuer is the connected account. */
  code: string
  /** The asset's SAC contract id as the app knows it. If it differs from code + connected account,
   * the connected account is not this asset's issuer. */
  contractId?: string
  /** No options contract configured: read nothing from Testnet, sign nothing. */
  mock?: boolean
  address: string | null
  sign: (xdr: string) => Promise<string>
  optionsContractId?: string
}

type Outcome = { label: string; hash: string } | { error: string } | null

interface SessionAction {
  action: string
  target: string
  hash: string
}

interface RowStatus {
  trustline: string
  authorized: string
  state: AuthState
  balance?: string
  error?: string
}

const AUTHORIZED_TEXT: Record<TrustStatus, string> = {
  none: 'No',
  authorized: 'Yes',
  'maintain-liabilities': 'Liabilities only',
  'not-authorized': 'No',
}

async function readRow(code: string, issuer: string, target: string): Promise<RowStatus> {
  try {
    if (isAccountId(target)) {
      const acct = await horizon.loadAccount(target)
      const t = trustStatus(acct.balances, code, issuer)
      return {
        trustline: t.status === 'none' ? 'None' : 'Yes',
        authorized: AUTHORIZED_TEXT[t.status],
        state: authStateFromTrust(t.status),
        balance: t.balance,
      }
    }
    const ok = await readSacAuthorized(server, sacContractId(code, issuer, config.networkPassphrase), target, config.networkPassphrase)
    return { trustline: 'n/a', authorized: ok ? 'Yes' : 'No', state: authStateFromSac(ok) }
  } catch (e) {
    const error = describeError(e)
    // Horizon 404: the account was never funded, so it cannot hold the asset.
    if (isNotFound(error)) return { trustline: 'No account', authorized: 'No', state: 'no-trustline' }
    return { trustline: 'Unknown', authorized: 'Unknown', state: 'unknown', error }
  }
}

const onOff = (v: boolean | undefined) => (v ? 'On' : 'Off')
const MOCK_ROW: RowStatus = { trustline: 'Mock', authorized: 'Mock', state: 'unknown' }
const UNKNOWN_ROW: RowStatus = { trustline: 'Unknown', authorized: 'Unknown', state: 'unknown' }

export function IssuerConsole({ code, contractId, mock = false, address, sign, optionsContractId }: Props) {
  const [draft, setDraft] = useState('')
  const [accounts, setAccounts] = useState<string[]>([])
  const [flagState, setFlagState] = useState<{ address: string; flags?: IssuerFlags; error?: string } | null>(null)
  const [reads, setReads] = useState<{ key: string; rows: Record<string, RowStatus> }>({ key: '', rows: {} })
  const [rev, setRev] = useState(0) // bumped after each issuer action so every row is read again
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [actions, setActions] = useState<SessionAction[]>([])
  const [confirm, setConfirm] = useState<{ kind: 'freeze' | 'clawback'; target: string } | null>(null)
  const [amount, setAmount] = useState('')
  const [typed, setTyped] = useState('')
  const lock = useRef(false) // synchronous guard: state updates are too late to stop a double click
  const amountRef = useRef<HTMLInputElement>(null)

  const sacId = address ? sacContractId(code, address, config.networkPassphrase) : null
  const notIssuer = !mock && !!contractId && !!sacId && contractId !== sacId
  const canAct = !mock && !notIssuer // rows are read from Testnet and actions can be signed
  const rows = optionsContractId ? [optionsContractId, ...accounts.filter((a) => a !== optionsContractId)] : accounts
  const rowsKey = rows.join(',')
  const readKey = `${address}|${code}|${rev}`

  useEffect(() => {
    if (!address || mock) return
    let live = true
    horizon
      .loadAccount(address)
      .then((a) => live && setFlagState({ address, flags: a.flags }))
      .catch((e) => live && setFlagState({ address, error: describeError(e) }))
    return () => {
      live = false
    }
  }, [address, mock])

  useEffect(() => {
    if (!address || !rowsKey || !canAct) return
    let live = true
    for (const t of rowsKey.split(',')) {
      void readRow(code, address, t).then((r) => {
        if (!live) return
        setReads((prev) => ({ key: readKey, rows: { ...(prev.key === readKey ? prev.rows : {}), [t]: r } }))
      })
    }
    return () => {
      live = false
    }
  }, [address, code, rowsKey, readKey, canAct])

  async function run(label: string, record: { action: string; target: string }, fn: () => Promise<string>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setOutcome(null)
    try {
      const hash = await fn()
      setOutcome({ label, hash })
      setActions((a) => [{ ...record, hash }, ...a])
    } catch (e) {
      setOutcome({ error: describeError(e) })
    } finally {
      lock.current = false
      setBusy(false)
      closeConfirm()
      setRev((r) => r + 1)
    }
  }

  function closeConfirm() {
    setConfirm(null)
    setAmount('')
    setTyped('')
  }

  const asset = () => new Asset(code, address as string)
  const source = async () => {
    const a = await horizon.loadAccount(address as string)
    return new Account(a.accountId(), a.sequenceNumber())
  }

  const setAuth = (target: string, authorize: boolean) =>
    run(`${authorize ? 'Authorized' : 'Frozen'} ${shortAddress(target)}`, { action: authorize ? 'Authorize' : 'Freeze', target }, async () => {
      if (isAccountId(target)) {
        const tx = buildSetAuthorizedTx(await source(), asset(), target, authorize, config.networkPassphrase)
        return submitClassic(horizon, tx, sign, config.networkPassphrase)
      }
      const op = sacSetAuthorizedOp(sacId as string, target, authorize)
      const tx = buildSacTx(await source(), op, config.networkPassphrase)
      return submitSoroban(server, tx, sign, config.networkPassphrase)
    })

  const units = parseAmount(amount, STROOPS_DECIMALS)
  const canClawback = !busy && units !== null && units > 0n

  const clawback = (target: string) =>
    run(`Clawed back ${amount.trim()} ${code}`, { action: `Claw back ${amount.trim()} ${code}`, target }, async () => {
      if (isAccountId(target)) {
        const tx = buildClawbackTx(await source(), asset(), target, amount.trim(), config.networkPassphrase)
        return submitClassic(horizon, tx, sign, config.networkPassphrase)
      }
      const op = sacClawbackOp(sacId as string, target, units as bigint)
      const tx = buildSacTx(await source(), op, config.networkPassphrase)
      return submitSoroban(server, tx, sign, config.networkPassphrase)
    })

  if (!address) {
    return <p className="is-muted">Connect the asset issuer's account in your wallet.</p>
  }

  const addAccount = (e: FormEvent) => {
    e.preventDefault()
    const t = draft.trim()
    if (!isAccountId(t) && !isContractId(t)) return
    setAccounts((a) => (a.includes(t) ? a : [t, ...a]))
    setDraft('')
  }
  const draftOk = isAccountId(draft) || isContractId(draft)

  const cur = flagState && flagState.address === address ? flagState : null
  const flags = cur?.flags ?? null
  const flagsError = cur?.error ?? null
  const missing = flags ? missingFlags(flags) : []
  const flagValue = (v: boolean | undefined) => (mock ? 'Mock' : notIssuer ? 'Unknown' : !cur ? 'Loading' : flags ? onOff(v) : 'Unknown')
  const rowStatus = (t: string): RowStatus | undefined => (mock ? MOCK_ROW : notIssuer ? UNKNOWN_ROW : reads.key === readKey ? reads.rows[t] : undefined)
  const shownSac = mock ? null : (contractId ?? sacId)
  const rowErrors = rows.flatMap((t) => {
    const err = rowStatus(t)?.error
    return err ? [{ t, err }] : []
  })
  const typedOk = typed.trim().toUpperCase() === code.toUpperCase()
  const confirmTarget = confirm?.target ?? ''
  const confirmIsOptions = !!optionsContractId && confirmTarget === optionsContractId
  const confirmBalance = confirm ? rowStatus(confirmTarget)?.balance : undefined

  return (
    <div className="is-layout">
      <Card title="Flags" className="is-flags" flush>
        <div className="is-flags-body">
          <dl className="ui-kv">
            <div>
              <dt>Auth required</dt>
              <dd>{flagValue(flags?.auth_required)}</dd>
            </div>
            <div>
              <dt>Revocable</dt>
              <dd>{flagValue(flags?.auth_revocable)}</dd>
            </div>
            <div>
              <dt>Clawback</dt>
              <dd>{flagValue(flags?.auth_clawback_enabled)}</dd>
            </div>
            {shownSac && (
              <div>
                <dt>Asset contract</dt>
                <dd>
                  <a href={expertContract(shownSac)} target="_blank" rel="noreferrer">
                    <Mono>{shortContractId(shownSac)}</Mono>
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {notIssuer && <Banner tone="warn">The connected account is not the {code} issuer.</Banner>}
          {!notIssuer && flagsError && isNotFound(flagsError) && <Banner tone="warn">The connected account does not exist on Testnet.</Banner>}
          {!notIssuer && flagsError && !isNotFound(flagsError) && <Banner tone="warn">Could not load flags: {flagsError}</Banner>}
          {!notIssuer && flags && missing.length > 0 && <Banner tone="warn">Authorize, freeze and clawback need all three flags On.</Banner>}
        </div>
      </Card>

      <div className="is-main">
        <Card title="Accounts" flush>
          <form className="is-add" onSubmit={addAccount}>
            <input
              className="is-input is-mono-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.trim())}
              placeholder="G… or C…"
              spellCheck={false}
              aria-label="Target address"
            />
            <Button type="submit" size="sm" disabled={!draftOk}>
              Add
            </Button>
          </form>
          {draft && !draftOk && <p className="is-error is-pad">Not an account (G…) or contract (C…) address.</p>}

          {rows.length === 0 ? (
            <p className="is-muted is-pad">No accounts added.</p>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table is-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="hide-sm">Trustline</th>
                    <th>Authorized</th>
                    <th>
                      <span className="is-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const s = rowStatus(t)
                    const acts = actionsFor(s?.state ?? 'unknown')
                    const short = shortAddress(t)
                    return (
                      <tr key={t}>
                        <td>
                          <Mono title={t}>{short}</Mono>
                          {t === optionsContractId && <span className="is-sub">Options contract</span>}
                        </td>
                        <td className="hide-sm">{s ? s.trustline : 'Reading'}</td>
                        <td>{s ? s.authorized : 'Reading'}</td>
                        <td className="is-row-actions">
                          <div className="is-acts">
                            <Button size="sm" onClick={() => setAuth(t, true)} disabled={busy || !canAct || !acts.authorize} aria-label={`Authorize ${short}`}>
                              Authorize
                            </Button>
                            <Button size="sm" onClick={() => setConfirm({ kind: 'freeze', target: t })} disabled={busy || !canAct || !acts.freeze} aria-label={`Freeze ${short}`}>
                              Freeze
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setConfirm({ kind: 'clawback', target: t })}
                              disabled={busy || !canAct || s?.state === 'no-trustline'}
                              aria-label={`Claw back from ${short}`}
                            >
                              Claw back
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {rowErrors.map(({ t, err }) => (
          <Banner key={t} tone="warn">
            Could not read {shortAddress(t)}: {err}
          </Banner>
        ))}
        {busy && <Banner>Waiting for signature and confirmation.</Banner>}
        {outcome && 'hash' in outcome && (
          <Banner>
            {outcome.label}.{' '}
            <a href={explorerTx(outcome.hash)} target="_blank" rel="noreferrer">
              <Mono>{shortHash(outcome.hash)}</Mono>
            </a>
          </Banner>
        )}
        {outcome && 'error' in outcome && <Banner tone="danger">{outcome.error}</Banner>}

        {actions.length > 0 && (
          <Card title="Recent actions" flush>
            <div className="ui-table-wrap">
              <table className="ui-table is-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Account</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.hash}>
                      <td>{a.action}</td>
                      <td>
                        <Mono>{shortAddress(a.target)}</Mono>
                      </td>
                      <td>
                        <a href={explorerTx(a.hash)} target="_blank" rel="noreferrer">
                          <Mono>{shortHash(a.hash)}</Mono>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {confirm?.kind === 'freeze' && (
        <Dialog
          title={`Freeze ${shortAddress(confirmTarget)}`}
          onClose={() => !busy && closeConfirm()}
          width={520}
          footer={
            <>
              <Button variant="secondary" onClick={closeConfirm} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setAuth(confirmTarget, false)} loading={busy}>
                Freeze
              </Button>
            </>
          }
        >
          <div className="is-stack">
            <dl className="ui-kv">
              <div>
                <dt>Asset</dt>
                <dd>{code}</dd>
              </div>
              <div>
                <dt>{isAccountId(confirmTarget) ? 'Account' : 'Contract'}</dt>
                <dd>
                  <Mono className="is-break">{confirmTarget}</Mono>
                </dd>
              </div>
            </dl>
            <Banner tone="danger">
              {confirmIsOptions
                ? `A frozen options contract cannot move ${code}, so no ${code} option can settle.`
                : 'A frozen holder cannot exercise, and a frozen writer cannot claim delivery or reclaim.'}
            </Banner>
          </div>
        </Dialog>
      )}

      {confirm?.kind === 'clawback' && (
        <Dialog
          title={`Claw back ${code}`}
          onClose={() => !busy && closeConfirm()}
          width={520}
          initialFocusRef={amountRef}
          footer={
            <>
              <Button variant="secondary" onClick={closeConfirm} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => clawback(confirmTarget)} disabled={!canClawback || !typedOk} loading={busy}>
                Claw back
              </Button>
            </>
          }
        >
          <div className="is-stack">
            <dl className="ui-kv">
              <div>
                <dt>From</dt>
                <dd>
                  <Mono className="is-break">{confirmTarget}</Mono>
                </dd>
              </div>
              {confirmBalance !== undefined && (
                <div>
                  <dt>Balance</dt>
                  <dd>
                    {formatAmount(parseAmount(confirmBalance, STROOPS_DECIMALS) ?? 0n, STROOPS_DECIMALS, 7)} {code}
                  </dd>
                </div>
              )}
            </dl>
            <label className="is-field">
              <span className="is-field-label">Amount</span>
              <span className="is-unit-row">
                <input
                  ref={amountRef}
                  className="is-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="10"
                  aria-label="Clawback amount"
                />
                <span className="is-unit">{code}</span>
              </span>
            </label>
            {amount && !units && <p className="is-error">Enter a positive amount with at most 7 decimals.</p>}
            <label className="is-field">
              <span className="is-field-label">Type {code} to confirm</span>
              <input className="is-input" value={typed} onChange={(e) => setTyped(e.target.value)} spellCheck={false} autoComplete="off" aria-label="Type the asset code to confirm" />
            </label>
            <Banner tone="danger">
              {confirmIsOptions
                ? 'This takes collateral from the options contract without consent and leaves its open positions short.'
                : "This takes the tokens without the holder's consent and cannot be undone."}
            </Banner>
          </div>
        </Dialog>
      )}
    </div>
  )
}
