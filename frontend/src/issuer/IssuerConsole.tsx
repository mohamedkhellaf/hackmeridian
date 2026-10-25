import { useCallback, useEffect, useRef, useState } from 'react'
import { Account, Asset, Horizon } from '@stellar/stellar-sdk'
import { config, explorerTx } from '../config'
import { server } from '../stellar/rpc'
import { describeError } from '../stellar/errors'
import { parseAmount, formatAmount } from '../options/format'
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
import './issuer.css'

const horizon = new Horizon.Server(config.horizonUrl)

interface Props {
  address: string | null
  sign: (xdr: string) => Promise<string>
  optionsContractId?: string
}

type Outcome = { label: string; hash: string } | { error: string } | null

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
  const [statusState, setStatusState] = useState<{ key: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null) // clawback confirmation is tied to its inputs
  const lock = useRef(false) // synchronous guard: state updates are too late to stop a double click

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
    const setStatus = (text: string) => setStatusState({ key, text })
    try {
      if (targetKind === 'account') {
        const acct = await horizon.loadAccount(target)
        const t = trustStatus(acct.balances, code, address)
        setStatus(`${STATUS_TEXT[t.status]}${t.balance ? ` · balance ${t.balance} ${code}` : ''}`)
      } else {
        const ok = await readSacAuthorized(server, sacContractId(code, address, config.networkPassphrase), target, config.networkPassphrase)
        setStatus(ok ? 'Contract is authorized on the SAC' : 'Contract is NOT authorized on the SAC')
      }
    } catch (e) {
      // Horizon 404 = account missing; SAC simulation errors carry the useful text.
      setStatus(`Could not read status: ${describeError(e)}`)
    }
  }, [address, code, codeOk, target, targetKind])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  async function run(label: string, fn: () => Promise<string>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setOutcome(null)
    try {
      const hash = await fn()
      setOutcome({ label, hash })
    } catch (e) {
      setOutcome({ error: describeError(e) })
    } finally {
      lock.current = false
      setBusy(false)
      setConfirmKey(null)
      void refreshStatus()
    }
  }

  const asset = () => new Asset(code, address as string)
  const source = async () => {
    const a = await horizon.loadAccount(address as string)
    return new Account(a.accountId(), a.sequenceNumber())
  }

  const setAuth = (authorize: boolean) =>
    run(`${authorize ? 'Authorize' : 'Revoke'} ${target.slice(0, 6)}…`, async () => {
      if (targetKind === 'account') {
        const tx = buildSetAuthorizedTx(await source(), asset(), target, authorize, config.networkPassphrase)
        return submitClassic(horizon, tx, sign, config.networkPassphrase)
      }
      const op = sacSetAuthorizedOp(sacId as string, target, authorize)
      const tx = buildSacTx(await source(), op, config.networkPassphrase)
      return submitSoroban(server, tx, sign, config.networkPassphrase)
    })

  const status = statusState?.key === `${code}|${target}` ? statusState.text : null
  const clawKey = `${code}|${target}|${amount}`
  const confirmClawback = confirmKey === clawKey
  const units = parseAmount(amount, STROOPS_DECIMALS)

  const clawback = () =>
    run(`Clawback ${amount} ${code}`, async () => {
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
      <section className="card issuer">
        <h2>Issuer console</h2>
        <p className="hint">Connect the asset issuer's account in Freighter (Testnet) to use the issuer console.</p>
      </section>
    )
  }

  const cur = flagState && flagState.address === address ? flagState : null
  const flags = cur?.flags ?? null
  const flagsError = cur?.error ?? null
  const missing = flags ? missingFlags(flags) : []
  const ready = !busy && codeOk && targetKind !== null
  const canClawback = ready && units !== null && units > 0n

  return (
    <section className="card issuer">
      <h2>Issuer console</h2>
      <p className="hint">
        Demo of issuer powers on a permissioned token. The connected account is the issuer of the asset below.
      </p>

      {flagsError && <div className="banner warn">Could not load issuer flags: {flagsError}</div>}
      {flags && missing.length > 0 && (
        <div className="banner warn">
          This account is missing {missing.join(', ')}. Authorization, freeze and clawback need all three flags on the issuer.
        </div>
      )}
      {flags && missing.length === 0 && <div className="banner ok">Issuer flags OK: AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_CLAWBACK_ENABLED.</div>}

      <div className="form">
        <label>
          Asset code (issuer = connected account)
          <input value={code} onChange={(e) => setCode(e.target.value.trim())} maxLength={12} />
        </label>
        {sacId && (
          <p className="hint issuer-mono">
            SAC: {sacId}
            <br />
            Contracts must be authorized on this SAC to hold the asset.
          </p>
        )}
        {!codeOk && <div className="form-error">Asset code must be 1 to 12 letters or digits.</div>}

        <label>
          Target address (G… account or C… contract)
          <input value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="G… or C…" spellCheck={false} />
        </label>
        {optionsContractId && (
          <button type="button" className="secondary" onClick={() => setTarget(optionsContractId)} disabled={busy}>
            Use options contract
          </button>
        )}
        {target && !targetKind && <div className="form-error">Not a valid account (G…) or contract (C…) address.</div>}
        {status && <p className="hint issuer-status">Status: {status}</p>}

        <div className="issuer-row">
          <button type="button" onClick={() => setAuth(true)} disabled={!ready}>
            Authorize
          </button>
          <button type="button" className="secondary" onClick={() => setAuth(false)} disabled={!ready}>
            Revoke / freeze
          </button>
        </div>
      </div>

      <div className="issuer-danger">
        <h3>Clawback</h3>
        <div className="banner err">
          Demo of issuer power: this removes tokens from the target without its consent. A clawback from a contract can leave
          its open positions under-collateralized.
        </div>
        <div className="form">
          <label>
            Amount ({code}, up to 7 decimals)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10" />
          </label>
          {amount && !units && <div className="form-error">Enter a positive amount with at most 7 decimals.</div>}
          {!confirmClawback ? (
            <button type="button" className="issuer-danger-btn" onClick={() => setConfirmKey(clawKey)} disabled={!canClawback}>
              Clawback…
            </button>
          ) : (
            <div className="issuer-confirm">
              <p>
                Claw back <strong>{units !== null ? formatAmount(units, STROOPS_DECIMALS, 7) : amount} {code}</strong> from{' '}
                <span className="issuer-mono">{target}</span>?
              </p>
              <div className="issuer-row">
                <button type="button" className="issuer-danger-btn" onClick={clawback} disabled={!canClawback}>
                  {busy ? 'Submitting…' : 'Confirm clawback'}
                </button>
                <button type="button" className="secondary" onClick={() => setConfirmKey(null)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {busy && <div className="banner warn">Waiting for signature and confirmation…</div>}
      {outcome && 'hash' in outcome && (
        <div className="banner ok">
          {outcome.label} confirmed.{' '}
          <a href={explorerTx(outcome.hash)} target="_blank" rel="noreferrer">
            {outcome.hash.slice(0, 10)}… on stellar.expert
          </a>
        </div>
      )}
      {outcome && 'error' in outcome && <div className="banner err">{outcome.error}</div>}
    </section>
  )
}
