import { useCallback, useEffect, useRef, useState } from 'react'
import { Account, Asset, Horizon } from '@stellar/stellar-sdk'
import { config, explorerTx } from '../config'
import { server } from '../stellar/rpc'
import { describeError } from '../stellar/errors'
import { parseAmount, formatAmount, shortAddress } from '../options/format'
import { Banner, Button, Card, Dialog, Icon, Mono, StatusDot } from '../ui'
import {
  STROOPS_DECIMALS,
  buildClawbackTx,
  buildSacTx,
  buildSetAuthorizedTx,
  isAccountId,
  isContractId,
  isValidAssetCode,
  missingFlags,
  sacClawbackOp,
  sacContractId,
  sacSetAuthorizedOp,
  trustStatus,
} from './issuerTx'
import type { IssuerFlags, TrustStatus } from './issuerTx'
import { readSacAuthorized, submitClassic, submitSoroban } from './issuerNet'
import { actionsFor, authStateFromSac, authStateFromTrust, flagItems, isNotFound, stateTone, targetKindLabel } from './issuerView'
import type { AuthState } from './issuerView'
import './issuer.css'

const horizon = new Horizon.Server(config.horizonUrl)

interface Props {
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

const STATUS_TEXT: Record<TrustStatus, string> = {
  none: 'No trustline for this asset',
  authorized: 'Authorized',
  'maintain-liabilities': 'Authorized to maintain liabilities only',
  'not-authorized': 'Not authorized (frozen or pending approval)',
}

export function IssuerConsole({ address, sign, optionsContractId }: Props) {
  const [code, setCode] = useState('FUND')
  const [target, setTarget] = useState('')
  const [amount, setAmount] = useState('')
  const [flagState, setFlagState] = useState<{ address: string; flags?: IssuerFlags; error?: string } | null>(null)
  const [statusState, setStatusState] = useState<{ key: string; text: string; state: AuthState } | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [actions, setActions] = useState<SessionAction[]>([])
  const [contractAuth, setContractAuth] = useState<{ key: string; ok: boolean | null } | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null) // clawback confirmation is tied to its inputs
  const [typed, setTyped] = useState('')
  const lock = useRef(false) // synchronous guard: state updates are too late to stop a double click
  const typedRef = useRef<HTMLInputElement>(null)

  const codeOk = isValidAssetCode(code)
  const targetKind = isAccountId(target) ? 'account' : isContractId(target) ? 'contract' : null
  const sacId = address && codeOk ? sacContractId(code, address, config.networkPassphrase) : null

  useEffect(() => {
    if (!address) return
    let live = true
    horizon
      .loadAccount(address)
      .then((a) => live && setFlagState({ address, flags: a.flags }))
      .catch((e) => live && setFlagState({ address, error: describeError(e) }))
    return () => {
      live = false
    }
  }, [address])

  const refreshStatus = useCallback(async () => {
    if (!address || !codeOk || !targetKind) return
    const key = `${code}|${target}`
    const setStatus = (text: string, state: AuthState) => setStatusState({ key, text, state })
    try {
      if (targetKind === 'account') {
        const acct = await horizon.loadAccount(target)
        const t = trustStatus(acct.balances, code, address)
        setStatus(`${STATUS_TEXT[t.status]}${t.balance ? ` · balance ${t.balance} ${code}` : ''}`, authStateFromTrust(t.status))
      } else {
        const ok = await readSacAuthorized(server, sacContractId(code, address, config.networkPassphrase), target, config.networkPassphrase)
        setStatus(ok ? 'Contract is authorized on the SAC' : 'Contract is NOT authorized on the SAC', authStateFromSac(ok))
      }
    } catch (e) {
      // Horizon 404 = account missing; SAC simulation errors carry the useful text.
      setStatus(`Could not read status: ${describeError(e)}`, 'unknown')
    }
  }, [address, code, codeOk, target, targetKind])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  // Is the options contract authorized to hold this asset? Re-read after each issuer action.
  const doneCount = actions.length
  useEffect(() => {
    if (!address || !sacId || !optionsContractId) return
    let live = true
    const key = `${sacId}|${optionsContractId}|${doneCount}`
    readSacAuthorized(server, sacId, optionsContractId, config.networkPassphrase)
      .then((ok) => live && setContractAuth({ key, ok }))
      .catch(() => live && setContractAuth({ key, ok: null }))
    return () => {
      live = false
    }
  }, [address, sacId, optionsContractId, doneCount])

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
      setConfirmKey(null)
      setTyped('')
      void refreshStatus()
    }
  }

  const closeConfirm = () => {
    setConfirmKey(null)
    setTyped('')
  }

  const asset = () => new Asset(code, address as string)
  const source = async () => {
    const a = await horizon.loadAccount(address as string)
    return new Account(a.accountId(), a.sequenceNumber())
  }

  const setAuth = (authorize: boolean) =>
    run(`${authorize ? 'Authorize' : 'Revoke'} ${target.slice(0, 6)}…`, { action: authorize ? 'Authorize' : 'Freeze', target }, async () => {
      if (targetKind === 'account') {
        const tx = buildSetAuthorizedTx(await source(), asset(), target, authorize, config.networkPassphrase)
        return submitClassic(horizon, tx, sign, config.networkPassphrase)
      }
      const op = sacSetAuthorizedOp(sacId as string, target, authorize)
      const tx = buildSacTx(await source(), op, config.networkPassphrase)
      return submitSoroban(server, tx, sign, config.networkPassphrase)
    })

  const status = statusState?.key === `${code}|${target}` ? statusState : null
  const clawKey = `${code}|${target}|${amount}`
  const confirmClawback = confirmKey === clawKey
  const units = parseAmount(amount, STROOPS_DECIMALS)

  const clawback = () =>
    run(`Clawback ${amount} ${code}`, { action: `Clawback ${amount.trim()} ${code}`, target }, async () => {
      if (targetKind === 'account') {
        const tx = buildClawbackTx(await source(), asset(), target, amount.trim(), config.networkPassphrase)
        return submitClassic(horizon, tx, sign, config.networkPassphrase)
      }
      const op = sacClawbackOp(sacId as string, target, units as bigint)
      const tx = buildSacTx(await source(), op, config.networkPassphrase)
      return submitSoroban(server, tx, sign, config.networkPassphrase)
    })

  if (!address) {
    return (
      <Card title="Issuer console">
        <p className="is-muted">Connect the asset issuer's account in your wallet (Testnet) to use the issuer console.</p>
      </Card>
    )
  }

  const cur = flagState && flagState.address === address ? flagState : null
  const flags = cur?.flags ?? null
  const flagsError = cur?.error ?? null
  const missing = flags ? missingFlags(flags) : []
  const ready = !busy && codeOk && targetKind !== null
  const canClawback = ready && units !== null && units > 0n
  const acts = actionsFor(status?.state ?? 'unknown')
  const optAuth = contractAuth?.key === `${sacId}|${optionsContractId}|${doneCount}` ? contractAuth.ok : undefined
  const typedOk = typed.trim().toUpperCase() === code.toUpperCase()

  return (
    <div className="is-layout">
      <div className="is-col">
        <Card
          title="Authorization"
          actions={
            <label className="is-asset">
              <span>Asset</span>
              <input value={code} onChange={(e) => setCode(e.target.value.trim())} maxLength={12} aria-label="Asset code (issuer = connected account)" spellCheck={false} />
            </label>
          }
        >
          <div className="is-stack">
            {!codeOk && <div className="is-error">Asset code must be 1 to 12 letters or digits.</div>}

            <label className="is-field">
              <span className="is-field-label">Account or contract address</span>
              <span className="is-input">
                <input value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="G… or C…" spellCheck={false} aria-label="Target address" className="is-mono-input" />
                {targetKindLabel(targetKind) && <span className="is-pill">{targetKindLabel(targetKind)}</span>}
              </span>
            </label>
            {target && !targetKind && <div className="is-error">Not a valid account (G…) or contract (C…) address.</div>}

            <div className="is-status">
              <StatusDot tone={status ? stateTone(status.state) : 'neutral'} />
              <span className="is-status-text">{status ? status.text : targetKind ? 'Reading status…' : 'Enter an address to read its status.'}</span>
              {optionsContractId && (
                <button type="button" className="is-link" onClick={() => setTarget(optionsContractId)} disabled={busy}>
                  Use options contract
                </button>
              )}
            </div>

            <div className="is-actions">
              <Button variant="secondary" onClick={() => setAuth(true)} disabled={!ready || !acts.authorize}>
                Authorize
              </Button>
              <Button variant="primary" onClick={() => setAuth(false)} disabled={!ready || !acts.freeze}>
                Freeze {targetKind === 'contract' ? 'contract' : 'account'}
              </Button>
            </div>
            <p className="is-note">
              A frozen holder cannot exercise. A frozen writer can still be exercised against, but cannot claim delivery or reclaim until authorized again.
            </p>
            {sacId && (
              <p className="is-note">
                {code} asset contract: <Mono className="is-break">{sacId}</Mono>. Contracts must be authorized on it to hold the asset.
              </p>
            )}
          </div>
        </Card>

        <Card className="is-danger-card">
          <div className="is-stack">
            <div className="is-danger-title">
              <Icon name="alert" size={16} />
              <h2>Clawback</h2>
            </div>
            <p className="is-note is-note--body">
              Removes tokens from the target without its consent. Demo of issuer power: clawing back from the options contract leaves its open positions
              under-collateralized; the Reserves page will show the shortfall.
            </p>
            <div className="is-claw-row">
              <label className="is-input is-input--grow">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10" aria-label="Clawback amount" />
                <span className="is-unit">{code}</span>
              </label>
              <Button variant="danger" onClick={() => setConfirmKey(clawKey)} disabled={!canClawback}>
                Review clawback
              </Button>
            </div>
            {amount && !units && <div className="is-error">Enter a positive amount with at most 7 decimals.</div>}
          </div>
        </Card>
      </div>

      <div className="is-col">
        <Card title={`${code} issuer flags`}>
          <div className="is-stack">
            {flagsError && isNotFound(flagsError) && (
              <Banner tone="info">This account has not issued {code} on Testnet. Connect the issuer account to use the console.</Banner>
            )}
            {flagsError && !isNotFound(flagsError) && <Banner tone="warn">Could not load issuer flags: {flagsError}</Banner>}
            {!cur && <p className="is-muted">Loading flags…</p>}
            {flags && (
              <ul className="is-flags">
                {flagItems(flags).map((f) => (
                  <li key={f.label} className={f.ok ? 'is-flag is-flag--ok' : 'is-flag is-flag--bad'}>
                    <Icon name={f.ok ? 'check' : 'alert'} size={16} />
                    <span>{f.label}</span>
                    {!f.ok && <span className="is-flag-missing">missing</span>}
                  </li>
                ))}
              </ul>
            )}
            {flags && missing.length > 0 && (
              <Banner tone="warn">This account is missing {missing.join(', ')}. Authorization, freeze and clawback need all three flags on the issuer.</Banner>
            )}
            <div className="is-sep">
              <span className="ui-label">Options contract</span>
              <span className="is-status-text">
                {!optionsContractId ? (
                  <>
                    <StatusDot tone="neutral" /> No options contract connected (mock mode)
                  </>
                ) : optAuth === undefined ? (
                  <>
                    <StatusDot tone="neutral" /> Reading…
                  </>
                ) : optAuth === null ? (
                  <>
                    <StatusDot tone="neutral" /> Could not read status
                  </>
                ) : optAuth ? (
                  <>
                    <StatusDot tone="ok" /> Authorized to hold {code}
                  </>
                ) : (
                  <>
                    <StatusDot tone="danger" /> Not authorized to hold {code}
                  </>
                )}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Recent issuer actions" subtitle="This session only" flush={actions.length > 0}>
          {actions.length === 0 ? (
            <p className="is-muted">No issuer actions yet in this session.</p>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.hash}>
                      <td className="ui-left">{a.action}</td>
                      <td>
                        <Mono>{shortAddress(a.target)}</Mono>
                      </td>
                      <td>
                        <a href={explorerTx(a.hash)} target="_blank" rel="noreferrer">
                          {a.hash.slice(0, 4)}…{a.hash.slice(-4)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {busy && <Banner tone="warn">Waiting for signature and confirmation…</Banner>}
        {outcome && 'hash' in outcome && (
          <Banner tone="ok">
            {outcome.label} confirmed.{' '}
            <a href={explorerTx(outcome.hash)} target="_blank" rel="noreferrer">
              {outcome.hash.slice(0, 10)}… on stellar.expert
            </a>
          </Banner>
        )}
        {outcome && 'error' in outcome && <Banner tone="danger">{outcome.error}</Banner>}
      </div>

      {confirmClawback && (
        <Dialog
          title="Review clawback"
          onClose={() => !busy && closeConfirm()}
          initialFocusRef={typedRef}
          footer={
            <>
              <Button variant="secondary" onClick={closeConfirm} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={clawback} disabled={!canClawback || !typedOk} loading={busy}>
                {busy ? 'Submitting…' : 'Confirm clawback'}
              </Button>
            </>
          }
        >
          <div className="is-stack">
            <p className="is-confirm-text">
              Claw back{' '}
              <strong>
                {units !== null ? formatAmount(units, STROOPS_DECIMALS, 7) : amount} {code}
              </strong>{' '}
              from <Mono className="is-break">{target}</Mono> ({targetKindLabel(targetKind)?.toLowerCase()}).
            </p>
            <p className="is-note is-note--body">This removes the tokens without the target's consent and cannot be undone.</p>
            <label className="is-field">
              <span className="is-field-label">Type {code} to confirm</span>
              <span className="is-input">
                <input ref={typedRef} value={typed} onChange={(e) => setTyped(e.target.value)} spellCheck={false} autoComplete="off" aria-label="Type the asset code to confirm" />
              </span>
            </label>
          </div>
        </Dialog>
      )}
    </div>
  )
}
